// api/internal/account/service.go
package account

import (
	"context"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/neuronot/api/internal/email"
)

const (
	bcryptCost        = 10
	minPasswordLength = 8
)

type repository interface {
	GetEmailAndHash(ctx context.Context, userID uuid.UUID) (string, string, error)
	GetPreferredLanguage(ctx context.Context, userID uuid.UUID) (string, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error
	DeleteUser(ctx context.Context, userID uuid.UUID) error
}

type tokenRevoker interface {
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	repo   repository
	tokens tokenRevoker
	emails *email.Service
}

// NewService composes the account slice. emails may be nil — the
// post-deletion confirmation send is best-effort and skips when the
// service is unavailable.
func NewService(repo repository, tokens tokenRevoker, emails *email.Service) *Service {
	return &Service{repo: repo, tokens: tokens, emails: emails}
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
	storedEmail, _, err := s.repo.GetEmailAndHash(ctx, userID)
	if err != nil {
		return err
	}
	// Anonymous accounts have no email to retype — accept an empty
	// confirm_email as the explicit "yes I want to delete this anon
	// account" signal. Any non-empty confirm against an empty stored
	// email is treated as a mismatch (refuses the silent EqualFold
	// "" == "" backdoor).
	switch {
	case storedEmail == "" && confirmEmail != "":
		return ErrEmailMismatch
	case storedEmail != "" && !emailMatches(storedEmail, confirmEmail):
		return ErrEmailMismatch
	}
	// Capture locale before the delete cascades the row.
	locale, _ := s.repo.GetPreferredLanguage(ctx, userID)
	if err := s.repo.DeleteUser(ctx, userID); err != nil {
		return err
	}
	// Best-effort confirmation mail. Anonymous accounts have no email and
	// silently skip; resend errors are logged inside SendAsync, never raised.
	if storedEmail != "" {
		email.SendAsync(s.emails, email.SendInput{
			To:       storedEmail,
			Locale:   locale,
			Template: email.TemplateAccountDeleted,
		})
	}
	return nil
}

func emailMatches(stored, confirm string) bool {
	return strings.EqualFold(strings.TrimSpace(stored), strings.TrimSpace(confirm))
}
