package auth

import (
	"time"

	"github.com/google/uuid"
)

// User mirrors the users table after migration 00010.
//
// Email and PasswordHash are empty strings when NULL in the DB (nullable
// for anonymous and social-only accounts). Repository SELECTs use COALESCE
// so callers don't need null-safe scanning. AppleSub / GoogleSub follow
// the same convention.
type User struct {
	ID                uuid.UUID
	Email             string
	PasswordHash      string
	PreferredLanguage string
	IsAnonymous       bool
	AppleSub          string
	GoogleSub         string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}
