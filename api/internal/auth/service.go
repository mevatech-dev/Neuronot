package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/time/rate"

	"github.com/neuronot/api/internal/consents"
)

const (
	accessTokenTTL    = 15 * time.Minute
	refreshTokenTTL   = 30 * 24 * time.Hour
	bcryptCost        = 10
	minPasswordLength = 8
	defaultLanguage   = "en"
)

var supportedLanguages = map[string]bool{
	"tr": true, "en": true, "es": true, "de": true, "fr": true, "pt": true,
	"it": true, "ar": true, "ru": true, "ja": true, "zh": true,
}

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrWeakPassword       = errors.New("weak password")
	ErrInvalidEmail       = errors.New("invalid email")
	ErrRateLimited        = errors.New("rate limited")
	ErrAIConsentRequired  = errors.New("ai_usage consent required")
)

// consentService is the auth-local view of the consents service. We keep
// the dependency narrow to avoid pulling all of consents.Service into
// auth's interface; only GrantTx is needed during registration.
type consentService interface {
	GrantTx(ctx context.Context, tx consents.DBTX, userID uuid.UUID, t consents.ConsentType, rc consents.RecordContext) error
}

// RegisterContext carries audit fields for the consent rows we insert
// during registration.
type RegisterContext struct {
	IP        string
	DeviceID  string
	UserAgent string
}

type Service struct {
	repo      *Repository
	consents  consentService
	jwtSecret []byte

	// In-memory rate limiter — 5 attempts per minute per IP.
	// Switches to Redis when MVP outgrows in-memory; bucket map TTL
	// is naive (we let it grow until restart, fine at MVP scale).
	limiterMu sync.Mutex
	limiters  map[string]*rate.Limiter
}

func NewService(repo *Repository, consentSvc consentService, jwtSecret []byte) *Service {
	return &Service{
		repo:      repo,
		consents:  consentSvc,
		jwtSecret: jwtSecret,
		limiters:  make(map[string]*rate.Limiter),
	}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest, rc RegisterContext) (*TokenResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, ErrInvalidEmail
	}
	if len(req.Password) < minPasswordLength {
		return nil, ErrWeakPassword
	}

	lang := strings.ToLower(strings.TrimSpace(req.PreferredLanguage))
	if !supportedLanguages[lang] {
		lang = defaultLanguage
	}

	if !aiConsentGranted(req.Consents) {
		return nil, ErrAIConsentRequired
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	pool := s.repo.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	user, err := s.repo.CreateUserTx(ctx, tx, email, string(hash), lang)
	if err != nil {
		return nil, err
	}

	consentRC := consents.RecordContext{
		IP:        rc.IP,
		DeviceID:  rc.DeviceID,
		UserAgent: rc.UserAgent,
		Source:    consents.SourceRegister,
	}
	for _, t := range consents.AllTypes {
		// Persist the granted state the client supplied. AI is required to
		// be true (checked above); ToS/Privacy default to true on register.
		granted := true
		if g, ok := findConsent(req.Consents, t); ok {
			granted = g
		}
		if !granted && t == consents.ConsentTypeAIUsage {
			return nil, ErrAIConsentRequired
		}
		if granted {
			if err := s.consents.GrantTx(ctx, tx, user.ID, t, consentRC); err != nil {
				return nil, fmt.Errorf("record consent %s: %w", t, err)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.issueTokens(ctx, user)
}

func aiConsentGranted(in []ConsentInput) bool {
	for _, c := range in {
		if c.Type == string(consents.ConsentTypeAIUsage) && c.Granted {
			return true
		}
	}
	return false
}

func findConsent(in []ConsentInput, t consents.ConsentType) (bool, bool) {
	for _, c := range in {
		if c.Type == string(t) {
			return c.Granted, true
		}
	}
	return false, false
}

func (s *Service) Login(ctx context.Context, req LoginRequest, ip string) (*TokenResponse, error) {
	if !s.allow(ip) {
		return nil, ErrRateLimited
	}

	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			// Same error so we don't reveal which is wrong.
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.issueTokens(ctx, user)
}

func (s *Service) Refresh(ctx context.Context, req RefreshRequest) (*TokenResponse, error) {
	hash := hashRefreshToken(req.RefreshToken)
	tok, err := s.repo.FindRefreshToken(ctx, hash)
	if err != nil {
		return nil, ErrRefreshTokenInvalid
	}
	if tok.RevokedAt != nil {
		// Token reuse — revoke the whole family for this user.
		_ = s.repo.RevokeAllForUser(ctx, tok.UserID)
		return nil, ErrRefreshTokenInvalid
	}
	if time.Now().After(tok.ExpiresAt) {
		return nil, ErrRefreshTokenInvalid
	}

	user, err := s.repo.FindUserByID(ctx, tok.UserID)
	if err != nil {
		return nil, ErrRefreshTokenInvalid
	}

	// Rotation: revoke old, issue new.
	if err := s.repo.RevokeRefreshToken(ctx, tok.ID); err != nil {
		return nil, fmt.Errorf("revoke old refresh: %w", err)
	}

	return s.issueTokens(ctx, user)
}

func (s *Service) Logout(ctx context.Context, req LogoutRequest) error {
	hash := hashRefreshToken(req.RefreshToken)
	tok, err := s.repo.FindRefreshToken(ctx, hash)
	if err != nil {
		// Treat unknown token as success — logout is idempotent.
		return nil
	}
	return s.repo.RevokeRefreshToken(ctx, tok.ID)
}

func (s *Service) issueTokens(ctx context.Context, user *User) (*TokenResponse, error) {
	now := time.Now()
	accessExp := now.Add(accessTokenTTL)
	refreshExp := now.Add(refreshTokenTTL)

	access, err := s.signAccessToken(user.ID, accessExp)
	if err != nil {
		return nil, err
	}

	refreshRaw, err := generateRefreshToken()
	if err != nil {
		return nil, err
	}
	if err := s.repo.StoreRefreshToken(ctx, user.ID, hashRefreshToken(refreshRaw), refreshExp); err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:       access,
		RefreshToken:      refreshRaw,
		AccessExpiresAt:   accessExp,
		RefreshExpiresAt:  refreshExp,
		UserID:            user.ID.String(),
		Email:             user.Email,
		PreferredLanguage: user.PreferredLanguage,
	}, nil
}

func (s *Service) signAccessToken(userID uuid.UUID, exp time.Time) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"iat": time.Now().Unix(),
		"exp": exp.Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return tok.SignedString(s.jwtSecret)
}

func (s *Service) allow(ip string) bool {
	if ip == "" {
		return true
	}
	s.limiterMu.Lock()
	defer s.limiterMu.Unlock()
	lim, ok := s.limiters[ip]
	if !ok {
		// 5 attempts per minute, burst 5.
		lim = rate.NewLimiter(rate.Every(12*time.Second), 5)
		s.limiters[ip] = lim
	}
	return lim.Allow()
}

func generateRefreshToken() (string, error) {
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashRefreshToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

func normalizeEmail(raw string) (string, error) {
	trimmed := strings.TrimSpace(strings.ToLower(raw))
	if trimmed == "" {
		return "", ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", ErrInvalidEmail
	}
	return addr.Address, nil
}
