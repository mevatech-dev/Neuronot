package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound          = errors.New("user not found")
	ErrEmailTaken            = errors.New("email taken")
	ErrRefreshTokenNotFound  = errors.New("refresh token not found")
	ErrRefreshTokenInvalid   = errors.New("refresh token invalid")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, lang string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING id, email, password_hash, preferred_language, created_at, updated_at
	`, email, passwordHash, lang).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.PreferredLanguage, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, password_hash, preferred_language, created_at, updated_at
		FROM users WHERE email = $1
	`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.PreferredLanguage, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		SELECT id, email, password_hash, preferred_language, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.PreferredLanguage, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) StoreRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, tokenHash, expiresAt)
	return err
}

// FindRefreshToken returns the token row if it is unrevoked and unexpired.
// Hash lookup, not raw token — keeps the secret out of the DB.
func (r *Repository) FindRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	var t RefreshToken
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, tokenHash).Scan(&t.ID, &t.UserID, &t.TokenHash, &t.ExpiresAt, &t.RevokedAt, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) RevokeRefreshToken(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL
	`, id)
	return err
}

func (r *Repository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	return err
}

// isUniqueViolation translates the pgx error into our domain ErrEmailTaken.
// 23505 is the SQLSTATE code for unique_violation.
func isUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	if errors.As(err, &pgErr) {
		return pgErr.SQLState() == "23505"
	}
	return false
}
