package auth

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                uuid.UUID
	Email             string
	PasswordHash      string
	PreferredLanguage string
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
