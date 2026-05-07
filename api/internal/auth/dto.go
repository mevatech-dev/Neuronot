package auth

import "time"

type ConsentInput struct {
	Type    string `json:"type"`
	Granted bool   `json:"granted"`
	Version string `json:"version"`
}

type RegisterRequest struct {
	Email             string         `json:"email"`
	Password          string         `json:"password"`
	PreferredLanguage string         `json:"preferred_language,omitempty"`
	Consents          []ConsentInput `json:"consents"`
}

// AnonymousRequest creates a guest account. ToS + Privacy must be granted;
// AI usage is optional and gates AI insight generation later.
type AnonymousRequest struct {
	PreferredLanguage string         `json:"preferred_language,omitempty"`
	Consents          []ConsentInput `json:"consents"`
}

// AppleRequest carries the Apple identity token plus the raw nonce the
// mobile generated (server hashes it and compares against the JWT claim).
type AppleRequest struct {
	IdentityToken     string         `json:"identity_token"`
	Nonce             string         `json:"nonce"`
	PreferredLanguage string         `json:"preferred_language,omitempty"`
	Consents          []ConsentInput `json:"consents"`
}

// GoogleRequest carries the Google ID token. Google does not issue nonces
// in the standard mobile flow, so we don't enforce one.
type GoogleRequest struct {
	IDToken           string         `json:"id_token"`
	PreferredLanguage string         `json:"preferred_language,omitempty"`
	Consents          []ConsentInput `json:"consents"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type TokenResponse struct {
	AccessToken       string    `json:"access_token"`
	RefreshToken      string    `json:"refresh_token"`
	AccessExpiresAt   time.Time `json:"access_expires_at"`
	RefreshExpiresAt  time.Time `json:"refresh_expires_at"`
	UserID            string    `json:"user_id"`
	Email             string    `json:"email"`
	PreferredLanguage string    `json:"preferred_language"`
	IsAnonymous       bool      `json:"is_anonymous"`
}
