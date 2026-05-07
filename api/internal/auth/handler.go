package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	httpx "github.com/neuronot/api/internal/http"
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
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	resp, err := h.svc.Register(r.Context(), req)
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
	default:
		httpx.InternalError(w)
	}
}
