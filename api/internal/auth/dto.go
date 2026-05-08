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

// UpgradeEmailRequest is the body for /v1/auth/upgrade/email — the caller
// must already hold an anonymous-account JWT. Consents are not collected
// here since ToS+Privacy were already granted at the anonymous-create step.
type UpgradeEmailRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// UpgradeAppleRequest mirrors AppleRequest minus the consent block (the
// anon user already accepted ToS+Privacy when the account was created).
type UpgradeAppleRequest struct {
	IdentityToken string `json:"identity_token"`
	Nonce         string `json:"nonce"`
}

type UpgradeGoogleRequest struct {
	IDToken string `json:"id_token"`
}

// LinkAppleRequest / LinkGoogleRequest match the sign-in shape minus the
// consent block (the user is already authenticated and has consents on
// record).
type LinkAppleRequest struct {
	IdentityToken string `json:"identity_token"`
	Nonce         string `json:"nonce"`
}

type LinkGoogleRequest struct {
	IDToken string `json:"id_token"`
}

// LinksResponse summarizes which identity methods the current user has.
// Drives the "Linked: Apple ✓ / Google ✗ / Email ✓" block in Settings →
// Account.
type LinksResponse struct {
	HasPassword bool `json:"has_password"`
	HasApple    bool `json:"has_apple"`
	HasGoogle   bool `json:"has_google"`
	IsAnonymous bool `json:"is_anonymous"`
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
