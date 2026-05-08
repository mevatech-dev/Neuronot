package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "github.com/neuronot/api/internal/http"
	"github.com/neuronot/api/internal/http/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Mount(r chi.Router) {
	r.Post("/register", h.register)
	r.Post("/login", h.login)
	r.Post("/refresh", h.refresh)
	r.Post("/logout", h.logout)
	r.Post("/anonymous", h.anonymous)
	r.Post("/apple", h.apple)
	r.Post("/google", h.google)
}

// MountUpgrade mounts the authenticated upgrade routes. Wired separately
// from Mount so router.go can place these inside the JWT-required group.
func (h *Handler) MountUpgrade(r chi.Router) {
	r.Post("/email", h.upgradeEmail)
	r.Post("/apple", h.upgradeApple)
	r.Post("/google", h.upgradeGoogle)
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	rc := RegisterContext{
		IP:        httpx.ClientIP(r),
		DeviceID:  r.Header.Get("X-Device-Id"),
		UserAgent: r.UserAgent(),
	}
	resp, err := h.svc.Register(r.Context(), req, rc)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, resp)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	resp, err := h.svc.Login(r.Context(), req, httpx.ClientIP(r))
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	resp, err := h.svc.Refresh(r.Context(), req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) anonymous(w http.ResponseWriter, r *http.Request) {
	var req AnonymousRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	rc := RegisterContext{
		IP: httpx.ClientIP(r), DeviceID: r.Header.Get("X-Device-Id"), UserAgent: r.UserAgent(),
	}
	resp, err := h.svc.Anonymous(r.Context(), req, rc)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, resp)
}

func (h *Handler) apple(w http.ResponseWriter, r *http.Request) {
	var req AppleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if req.IdentityToken == "" {
		httpx.ValidationFailed(w, "identity_token is required")
		return
	}
	rc := RegisterContext{
		IP: httpx.ClientIP(r), DeviceID: r.Header.Get("X-Device-Id"), UserAgent: r.UserAgent(),
	}
	resp, err := h.svc.Apple(r.Context(), req, rc)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) google(w http.ResponseWriter, r *http.Request) {
	var req GoogleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if req.IDToken == "" {
		httpx.ValidationFailed(w, "id_token is required")
		return
	}
	rc := RegisterContext{
		IP: httpx.ClientIP(r), DeviceID: r.Header.Get("X-Device-Id"), UserAgent: r.UserAgent(),
	}
	resp, err := h.svc.Google(r.Context(), req, rc)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) upgradeEmail(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req UpgradeEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	resp, err := h.svc.UpgradeToEmail(r.Context(), uid, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) upgradeApple(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req UpgradeAppleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if req.IdentityToken == "" {
		httpx.ValidationFailed(w, "identity_token is required")
		return
	}
	resp, err := h.svc.UpgradeToApple(r.Context(), uid, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) upgradeGoogle(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req UpgradeGoogleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if req.IDToken == "" {
		httpx.ValidationFailed(w, "id_token is required")
		return
	}
	resp, err := h.svc.UpgradeToGoogle(r.Context(), uid, req)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if err := h.svc.Logout(r.Context(), req); err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_INVALID_CREDENTIALS", "errors.auth.invalid_credentials", "Invalid email or password")
	case errors.Is(err, ErrEmailTaken):
		httpx.WriteError(w, http.StatusConflict, "AUTH_EMAIL_TAKEN", "errors.auth.email_taken", "This email is already registered")
	case errors.Is(err, ErrWeakPassword):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_WEAK_PASSWORD", "errors.auth.weak_password", "Password must be at least 8 characters")
	case errors.Is(err, ErrInvalidEmail):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_INVALID_EMAIL", "errors.auth.invalid_email", "Invalid email address")
	case errors.Is(err, ErrRefreshTokenInvalid):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_TOKEN_INVALID", "errors.auth.token_invalid", "Invalid or expired refresh token")
	case errors.Is(err, ErrRateLimited):
		httpx.WriteError(w, http.StatusTooManyRequests, "AUTH_RATE_LIMITED", "errors.auth.rate_limited", "Too many login attempts")
	case errors.Is(err, ErrAIConsentRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_AI_CONSENT_REQUIRED", "errors.auth.ai_consent_required", "AI consent is required to register")
	case errors.Is(err, ErrTosOrPrivacyConsentMissing):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_CONSENT_REQUIRED", "errors.auth.consent_required", "Terms and Privacy must be accepted")
	case errors.Is(err, ErrAppleTokenInvalid):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_APPLE_TOKEN_INVALID", "errors.auth.apple_invalid", "Apple identity token is invalid")
	case errors.Is(err, ErrAppleNonceMismatch):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_APPLE_NONCE_MISMATCH", "errors.auth.apple_nonce", "Apple nonce mismatch")
	case errors.Is(err, ErrGoogleTokenInvalid):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_GOOGLE_TOKEN_INVALID", "errors.auth.google_invalid", "Google ID token is invalid")
	case errors.Is(err, ErrGoogleEmailUnverified):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_GOOGLE_EMAIL_UNVERIFIED", "errors.auth.google_email_unverified", "Google account email is not verified")
	case errors.Is(err, ErrLinkRequired):
		httpx.WriteError(w, http.StatusConflict, "AUTH_LINK_REQUIRED", "errors.auth.link_required", "An account already exists for this email; sign in with password to link")
	case errors.Is(err, ErrProviderDisabled):
		httpx.WriteError(w, http.StatusServiceUnavailable, "AUTH_PROVIDER_DISABLED", "errors.auth.provider_disabled", "This sign-in method is not configured")
	case errors.Is(err, ErrNotAnonymous):
		httpx.WriteError(w, http.StatusConflict, "AUTH_NOT_ANONYMOUS", "errors.auth.not_anonymous", "This account is not anonymous and cannot be upgraded")
	default:
		httpx.InternalError(w)
	}
}
