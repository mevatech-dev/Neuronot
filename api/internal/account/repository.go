// api/internal/account/repository.go
package account

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetEmailAndHash(ctx context.Context, userID uuid.UUID) (email, passwordHash string, err error) {
	var emailPtr, hashPtr *string
	row := r.pool.QueryRow(ctx, `SELECT email, password_hash FROM users WHERE id = $1`, userID)
	if err := row.Scan(&emailPtr, &hashPtr); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrUserNotFound
		}
		return "", "", err
	}
	if emailPtr != nil {
		email = *emailPtr
	}
	if hashPtr != nil {
		passwordHash = *hashPtr
	}
	return email, passwordHash, nil
}

// GetPreferredLanguage reads the user's locale so callers (e.g. email
// dispatch) can pick the matching template.
func (r *Repository) GetPreferredLanguage(ctx context.Context, userID uuid.UUID) (string, error) {
	var locale string
	row := r.pool.QueryRow(ctx, `SELECT preferred_language FROM users WHERE id = $1`, userID)
	if err := row.Scan(&locale); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrUserNotFound
		}
		return "", err
	}
	return locale, nil
}

func (r *Repository) UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, newHash, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

// DeleteUser removes the user. FK cascades drop profiles, daily_logs,
// events, insights, consents, and refresh_tokens.
func (r *Repository) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}
