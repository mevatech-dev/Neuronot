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

	"github.com/neuronot/api/internal/auth/oidc"
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
	ErrInvalidCredentials       = errors.New("invalid credentials")
	ErrWeakPassword             = errors.New("weak password")
	ErrInvalidEmail             = errors.New("invalid email")
	ErrRateLimited              = errors.New("rate limited")
	ErrAIConsentRequired        = errors.New("ai_usage consent required")
	ErrTosOrPrivacyConsentMissing = errors.New("terms and privacy consent required")
	ErrAppleTokenInvalid        = errors.New("apple token invalid")
	ErrAppleNonceMismatch       = errors.New("apple nonce mismatch")
	ErrGoogleTokenInvalid       = errors.New("google token invalid")
	ErrGoogleEmailUnverified    = errors.New("google email unverified")
	ErrLinkRequired             = errors.New("link required: email already in use")
	ErrProviderDisabled         = errors.New("auth provider disabled by config")
	ErrNotAnonymous             = errors.New("user is not anonymous")
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

// OIDCVerifier is the narrow surface auth needs from the oidc package.
// Exported so wiring code in cmd/api/main.go can pass *oidc.Verifier
// directly without an extra adapter; tests can drop in a stub.
type OIDCVerifier interface {
	VerifyApple(ctx context.Context, idToken, rawNonce string) (*oidc.Claims, error)
	VerifyGoogle(ctx context.Context, idToken string) (*oidc.Claims, error)
}

type Service struct {
	repo      *Repository
	consents  consentService
	jwtSecret []byte
	verifier  OIDCVerifier

	// In-memory rate limiter — 5 attempts per minute per IP.
	// Switches to Redis when MVP outgrows in-memory; bucket map TTL
	// is naive (we let it grow until restart, fine at MVP scale).
	limiterMu sync.Mutex
	limiters  map[string]*rate.Limiter
}

// NewService wires the existing email/password flows. Use NewServiceWithOIDC
// to additionally enable /v1/auth/{anonymous,apple,google}.
func NewService(repo *Repository, consentSvc consentService, jwtSecret []byte) *Service {
	return NewServiceWithOIDC(repo, consentSvc, jwtSecret, nil)
}

// NewServiceWithOIDC returns a Service that can verify Apple/Google ID
// tokens. Pass nil to keep social endpoints disabled (they will return
// ErrProviderDisabled — the handler maps that to 503).
func NewServiceWithOIDC(repo *Repository, consentSvc consentService, jwtSecret []byte, verifier OIDCVerifier) *Service {
	return &Service{
		repo:      repo,
		consents:  consentSvc,
		jwtSecret: jwtSecret,
		verifier:  verifier,
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

// tosAndPrivacyGranted enforces the universal floor: every account creation
// path (register, anonymous, apple, google) requires the user to actively
// accept Terms of Service and Privacy Policy. AI usage is treated separately
// per flow.
func tosAndPrivacyGranted(in []ConsentInput) bool {
	tos := false
	priv := false
	for _, c := range in {
		if !c.Granted {
			continue
		}
		switch c.Type {
		case string(consents.ConsentTypeTermsOfService):
			tos = true
		case string(consents.ConsentTypePrivacyPolicy):
			priv = true
		}
	}
	return tos && priv
}

// recordConsents writes a row for every consent the client granted in this
// request. Used by Anonymous / Apple / Google paths where AI consent is
// optional (unlike Register where AI is required).
func (s *Service) recordConsents(ctx context.Context, tx consents.DBTX, userID uuid.UUID, in []ConsentInput, rc consents.RecordContext) error {
	for _, c := range in {
		if !c.Granted {
			continue
		}
		t := consents.ConsentType(c.Type)
		// Skip unknown consent types silently — they have no row to grant.
		var known bool
		for _, allowed := range consents.AllTypes {
			if allowed == t {
				known = true
				break
			}
		}
		if !known {
			continue
		}
		if err := s.consents.GrantTx(ctx, tx, userID, t, rc); err != nil {
			return err
		}
	}
	return nil
}

func findConsent(in []ConsentInput, t consents.ConsentType) (bool, bool) {
	for _, c := range in {
		if c.Type == string(t) {
			return c.Granted, true
		}
	}
	return false, false
}

// Anonymous creates a new user with no email/password and is_anonymous = true.
// ToS and Privacy consents are required; AI usage is optional and gates the
// /v1/insights/generate endpoint until granted.
func (s *Service) Anonymous(ctx context.Context, req AnonymousRequest, rc RegisterContext) (*TokenResponse, error) {
	if !tosAndPrivacyGranted(req.Consents) {
		return nil, ErrTosOrPrivacyConsentMissing
	}
	lang := normalizeLanguage(req.PreferredLanguage)

	pool := s.repo.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	user, err := s.repo.CreateAnonymousUser(ctx, tx, lang)
	if err != nil {
		return nil, err
	}
	consentRC := consents.RecordContext{
		IP: rc.IP, DeviceID: rc.DeviceID, UserAgent: rc.UserAgent,
		Source: consents.SourceRegister,
	}
	if err := s.recordConsents(ctx, tx, user.ID, req.Consents, consentRC); err != nil {
		return nil, fmt.Errorf("record consents: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return s.issueTokens(ctx, user)
}

// Apple verifies an Apple identity token. If the apple_sub already maps to
// a user, that user is logged in. If the token's email is already on a
// different user record, ErrLinkRequired is returned (manual link only —
// see ADR 0003). Otherwise a new account is created.
func (s *Service) Apple(ctx context.Context, req AppleRequest, rc RegisterContext) (*TokenResponse, error) {
	if s.verifier == nil {
		return nil, ErrProviderDisabled
	}
	claims, err := s.verifier.VerifyApple(ctx, req.IdentityToken, req.Nonce)
	if err != nil {
		return nil, mapAppleVerifyErr(err)
	}
	return s.signInWithSocial(ctx, socialClaims{
		provider:        oidc.ProviderApple,
		subject:         claims.Subject,
		email:           strings.ToLower(strings.TrimSpace(claims.Email)),
		preferredLang:   req.PreferredLanguage,
		consents:        req.Consents,
		registerContext: rc,
	})
}

// Google verifies a Google ID token; same flow shape as Apple.
func (s *Service) Google(ctx context.Context, req GoogleRequest, rc RegisterContext) (*TokenResponse, error) {
	if s.verifier == nil {
		return nil, ErrProviderDisabled
	}
	claims, err := s.verifier.VerifyGoogle(ctx, req.IDToken)
	if err != nil {
		return nil, mapGoogleVerifyErr(err)
	}
	return s.signInWithSocial(ctx, socialClaims{
		provider:        oidc.ProviderGoogle,
		subject:         claims.Subject,
		email:           strings.ToLower(strings.TrimSpace(claims.Email)),
		preferredLang:   req.PreferredLanguage,
		consents:        req.Consents,
		registerContext: rc,
	})
}

type socialClaims struct {
	provider        oidc.Provider
	subject         string
	email           string
	preferredLang   string
	consents        []ConsentInput
	registerContext RegisterContext
}

// signInWithSocial is the shared "sign in or sign up" path for Apple and
// Google. Note: existing accounts (matched by social subject) skip the
// consent check; only new-account creation enforces ToS+Privacy.
func (s *Service) signInWithSocial(ctx context.Context, c socialClaims) (*TokenResponse, error) {
	// 1. Existing match by social subject → straight sign-in.
	var existing *User
	var err error
	switch c.provider {
	case oidc.ProviderApple:
		existing, err = s.repo.FindUserByAppleSub(ctx, c.subject)
	case oidc.ProviderGoogle:
		existing, err = s.repo.FindUserByGoogleSub(ctx, c.subject)
	}
	if err != nil && !errors.Is(err, ErrUserNotFound) {
		return nil, err
	}
	if existing != nil {
		return s.issueTokens(ctx, existing)
	}

	// 2. New account creation requires ToS + Privacy consents.
	if !tosAndPrivacyGranted(c.consents) {
		return nil, ErrTosOrPrivacyConsentMissing
	}

	// 3. Email collision check — refuse to auto-link to an existing
	//    password account (account-takeover defense per ADR 0003).
	if c.email != "" {
		if existingByEmail, err := s.repo.FindUserByEmail(ctx, c.email); err == nil && existingByEmail != nil {
			return nil, ErrLinkRequired
		} else if err != nil && !errors.Is(err, ErrUserNotFound) {
			return nil, err
		}
	}

	lang := normalizeLanguage(c.preferredLang)

	pool := s.repo.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var newUser *User
	switch c.provider {
	case oidc.ProviderApple:
		newUser, err = s.repo.CreateUserWithApple(ctx, tx, c.subject, c.email, lang)
	case oidc.ProviderGoogle:
		newUser, err = s.repo.CreateUserWithGoogle(ctx, tx, c.subject, c.email, lang)
	}
	if err != nil {
		// EmailTaken here covers a race against an email-based sign-up
		// committed between the check above and the INSERT.
		if errors.Is(err, ErrEmailTaken) {
			return nil, ErrLinkRequired
		}
		return nil, err
	}

	consentRC := consents.RecordContext{
		IP: c.registerContext.IP, DeviceID: c.registerContext.DeviceID,
		UserAgent: c.registerContext.UserAgent,
		Source:    consents.SourceRegister,
	}
	if err := s.recordConsents(ctx, tx, newUser.ID, c.consents, consentRC); err != nil {
		return nil, fmt.Errorf("record consents: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return s.issueTokens(ctx, newUser)
}

// mapAppleVerifyErr translates the OIDC verifier sentinels into auth's
// domain errors so handlers don't need to reach across packages.
func mapAppleVerifyErr(err error) error {
	switch {
	case errors.Is(err, oidc.ErrInvalidNonce):
		return ErrAppleNonceMismatch
	case errors.Is(err, oidc.ErrInvalidToken),
		errors.Is(err, oidc.ErrInvalidAudience),
		errors.Is(err, oidc.ErrInvalidIssuer),
		errors.Is(err, oidc.ErrUnsupportedAlg),
		errors.Is(err, oidc.ErrKeyNotFound),
		errors.Is(err, oidc.ErrJWKSUnavailable):
		return ErrAppleTokenInvalid
	default:
		return err
	}
}

func mapGoogleVerifyErr(err error) error {
	switch {
	case errors.Is(err, oidc.ErrEmailUnverified):
		return ErrGoogleEmailUnverified
	case errors.Is(err, oidc.ErrInvalidToken),
		errors.Is(err, oidc.ErrInvalidAudience),
		errors.Is(err, oidc.ErrInvalidIssuer),
		errors.Is(err, oidc.ErrUnsupportedAlg),
		errors.Is(err, oidc.ErrKeyNotFound),
		errors.Is(err, oidc.ErrJWKSUnavailable):
		return ErrGoogleTokenInvalid
	default:
		return err
	}
}

// UpgradeToEmail converts the calling anonymous user into an email/password
// account. user_id stays the same so all daily_logs/events/insights move
// with the user. Caller must hold the JWT for the anon account.
func (s *Service) UpgradeToEmail(ctx context.Context, userID uuid.UUID, req UpgradeEmailRequest) (*TokenResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, ErrInvalidEmail
	}
	if len(req.Password) < minPasswordLength {
		return nil, ErrWeakPassword
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	user, err := s.repo.UpgradeAnonymousToEmail(ctx, userID, email, string(hash))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrNotAnonymous
		}
		return nil, err
	}
	// Rotate refresh tokens — the previous anon refresh tokens stay revoked
	// so the upgraded user starts a clean family.
	if err := s.repo.RevokeAllForUser(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("revoke old refresh tokens: %w", err)
	}
	return s.issueTokens(ctx, user)
}

// UpgradeToApple attaches an Apple identity to the calling anonymous user.
// The token must verify; we never auto-link to a non-anon account.
func (s *Service) UpgradeToApple(ctx context.Context, userID uuid.UUID, req UpgradeAppleRequest) (*TokenResponse, error) {
	if s.verifier == nil {
		return nil, ErrProviderDisabled
	}
	claims, err := s.verifier.VerifyApple(ctx, req.IdentityToken, req.Nonce)
	if err != nil {
		return nil, mapAppleVerifyErr(err)
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	user, err := s.repo.UpgradeAnonymousToApple(ctx, userID, claims.Subject, email)
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			return nil, ErrNotAnonymous
		case errors.Is(err, ErrAppleSubTaken):
			return nil, ErrLinkRequired
		case errors.Is(err, ErrEmailTaken):
			return nil, ErrLinkRequired
		}
		return nil, err
	}
	if err := s.repo.RevokeAllForUser(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("revoke old refresh tokens: %w", err)
	}
	return s.issueTokens(ctx, user)
}

// UpgradeToGoogle is the Google mirror of UpgradeToApple.
func (s *Service) UpgradeToGoogle(ctx context.Context, userID uuid.UUID, req UpgradeGoogleRequest) (*TokenResponse, error) {
	if s.verifier == nil {
		return nil, ErrProviderDisabled
	}
	claims, err := s.verifier.VerifyGoogle(ctx, req.IDToken)
	if err != nil {
		return nil, mapGoogleVerifyErr(err)
	}
	email := strings.ToLower(strings.TrimSpace(claims.Email))
	user, err := s.repo.UpgradeAnonymousToGoogle(ctx, userID, claims.Subject, email)
	if err != nil {
		switch {
		case errors.Is(err, ErrUserNotFound):
			return nil, ErrNotAnonymous
		case errors.Is(err, ErrGoogleSubTaken):
			return nil, ErrLinkRequired
		case errors.Is(err, ErrEmailTaken):
			return nil, ErrLinkRequired
		}
		return nil, err
	}
	if err := s.repo.RevokeAllForUser(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("revoke old refresh tokens: %w", err)
	}
	return s.issueTokens(ctx, user)
}

func normalizeLanguage(raw string) string {
	lang := strings.ToLower(strings.TrimSpace(raw))
	if !supportedLanguages[lang] {
		lang = defaultLanguage
	}
	return lang
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
		IsAnonymous:       user.IsAnonymous,
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
