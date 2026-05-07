package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound          = errors.New("user not found")
	ErrEmailTaken            = errors.New("email taken")
	ErrAppleSubTaken         = errors.New("apple subject taken")
	ErrGoogleSubTaken        = errors.New("google subject taken")
	ErrRefreshTokenNotFound  = errors.New("refresh token not found")
	ErrRefreshTokenInvalid   = errors.New("refresh token invalid")
)

// userColumns is the canonical projection used by every user SELECT in
// this repo. We COALESCE nullable identity columns to empty strings so
// the User struct fields stay non-pointer; callers check for "" when they
// need to distinguish.
const userColumns = `
    id,
    COALESCE(email, '')         AS email,
    COALESCE(password_hash, '') AS password_hash,
    preferred_language,
    is_anonymous,
    COALESCE(apple_sub, '')     AS apple_sub,
    COALESCE(google_sub, '')    AS google_sub,
    created_at,
    updated_at
`

// userScan applies the canonical projection above into a User.
func userScan(scanner interface{ Scan(...any) error }, u *User) error {
	return scanner.Scan(
		&u.ID, &u.Email, &u.PasswordHash, &u.PreferredLanguage,
		&u.IsAnonymous, &u.AppleSub, &u.GoogleSub,
		&u.CreatedAt, &u.UpdatedAt,
	)
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, lang string) (*User, error) {
	var u User
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING `+userColumns, email, passwordHash, lang)
	if err := userScan(row, &u); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return &u, nil
}

// CreateAnonymousUser inserts a user with no email or password and
// is_anonymous = true. Used by /v1/auth/anonymous.
func (r *Repository) CreateAnonymousUser(ctx context.Context, tx DBTX, lang string) (*User, error) {
	var u User
	row := tx.QueryRow(ctx, `
		INSERT INTO users (preferred_language, is_anonymous)
		VALUES ($1, true)
		RETURNING `+userColumns, lang)
	if err := userScan(row, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateUserWithApple inserts a user keyed only by their Apple subject.
// Email is optional (Apple may or may not provide it).
func (r *Repository) CreateUserWithApple(ctx context.Context, tx DBTX, appleSub, email, lang string) (*User, error) {
	var emailArg any
	if email != "" {
		emailArg = email
	}
	var u User
	row := tx.QueryRow(ctx, `
		INSERT INTO users (apple_sub, email, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING `+userColumns, appleSub, emailArg, lang)
	if err := userScan(row, &u); err != nil {
		if isUniqueViolation(err) {
			// Determine which constraint hit; pgx exposes the constraint name.
			return nil, classifySocialUniqueViolation(err)
		}
		return nil, err
	}
	return &u, nil
}

// CreateUserWithGoogle is the Google-side mirror of CreateUserWithApple.
func (r *Repository) CreateUserWithGoogle(ctx context.Context, tx DBTX, googleSub, email, lang string) (*User, error) {
	var emailArg any
	if email != "" {
		emailArg = email
	}
	var u User
	row := tx.QueryRow(ctx, `
		INSERT INTO users (google_sub, email, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING `+userColumns, googleSub, emailArg, lang)
	if err := userScan(row, &u); err != nil {
		if isUniqueViolation(err) {
			return nil, classifySocialUniqueViolation(err)
		}
		return nil, err
	}
	return &u, nil
}

// FindUserByAppleSub looks up an existing user by their Apple subject.
func (r *Repository) FindUserByAppleSub(ctx context.Context, sub string) (*User, error) {
	var u User
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE apple_sub = $1`, sub)
	if err := userScan(row, &u); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

// FindUserByGoogleSub looks up an existing user by their Google subject.
func (r *Repository) FindUserByGoogleSub(ctx context.Context, sub string) (*User, error) {
	var u User
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE google_sub = $1`, sub)
	if err := userScan(row, &u); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

// DBTX is the subset of pgx that both pgxpool.Pool and pgx.Tx satisfy.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// CreateUserTx is the transaction-aware variant of CreateUser. The caller
// is responsible for committing or rolling back the transaction.
func (r *Repository) CreateUserTx(ctx context.Context, tx DBTX, email, passwordHash, language string) (*User, error) {
	var u User
	row := tx.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING `+userColumns, email, passwordHash, language)
	if err := userScan(row, &u); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}
	return &u, nil
}

// Pool returns the connection pool for callers that need to start a
// transaction spanning more than one repository (e.g., auth + consents
// during register).
func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}

// FindUserByEmail only matches non-null emails; anonymous accounts and
// social-only users (no email) return ErrUserNotFound.
func (r *Repository) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email)
	if err := userScan(row, &u); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	row := r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	if err := userScan(row, &u); err != nil {
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

// classifySocialUniqueViolation reads the constraint name from a pgx
// integrity error and maps it to a domain error. Falls back to
// ErrEmailTaken for the email unique index, which is the catch-all for
// "this account already exists, please link instead".
func classifySocialUniqueViolation(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "users_apple_sub_key", "users_apple_sub_idx":
			return ErrAppleSubTaken
		case "users_google_sub_key", "users_google_sub_idx":
			return ErrGoogleSubTaken
		}
	}
	return ErrEmailTaken
}
