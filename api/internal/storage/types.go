// Package storage wraps Cloudflare R2 (S3-compatible) for object uploads
// and pre-signed URL issuance. Per ADR 0002 it is used only when a feature
// requires it; today the active triggers are dataexport (off-DB JSON
// artifacts) and profile avatars (user-uploaded media).
package storage

import "time"

// PresignedURL is the contract returned by PresignGet/PresignPut.
type PresignedURL struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}
