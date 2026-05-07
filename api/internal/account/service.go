// api/internal/account/service.go
package account

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost        = 10
	minPasswordLength = 8
)

type repository interface {
	GetEmailAndHash(ctx context.Context, userID uuid.UUID) (string, string, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error
	DeleteUser(ctx context.Context, userID uuid.UUID) error
}

type tokenRevoker interface {
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	repo   repository
	tokens tokenRevoker
}

func NewService(repo repository, tokens tokenRevoker) *Service {
	return &Service{repo: repo, tokens: tokens}
}

func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, current, next string) error {
	if len(next) < minPasswordLength {
		return ErrPasswordWeak
	}
	_, hash, err := s.repo.GetEmailAndHash(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(current)); err != nil {
		return ErrPasswordIncorrect
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(next), bcryptCost)
	if err != nil {
		return err
	}
	if err := s.repo.UpdatePassword(ctx, userID, string(newHash)); err != nil {
		return err
	}
	// Invalidate all existing refresh tokens — other devices must re-login.
	// Failure to revoke is non-fatal: the password is already updated.
	_ = s.tokens.RevokeAllForUser(ctx, userID)
	return nil
}

func (s *Service) DeleteSelf(ctx context.Context, userID uuid.UUID, confirmEmail string) error {
	email, _, err := s.repo.GetEmailAndHash(ctx, userID)
	if err != nil {
		return err
	}
	if !emailMatches(email, confirmEmail) {
		return ErrEmailMismatch
	}
	return s.repo.DeleteUser(ctx, userID)
}

func emailMatches(stored, confirm string) bool {
	return strings.EqualFold(strings.TrimSpace(stored), strings.TrimSpace(confirm))
}
