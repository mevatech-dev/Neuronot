// api/internal/account/handler.go
package account

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

// MountPassword mounts POST / under whatever parent the caller chose
// (typically /v1/auth/password, alongside login/register).
func (h *Handler) MountPassword(r chi.Router) {
	r.Post("/", h.changePassword)
}

// MountMe mounts DELETE / under whatever parent the caller chose
// (typically /v1/me).
func (h *Handler) MountMe(r chi.Router) {
	r.Delete("/", h.deleteSelf)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if err := h.svc.ChangePassword(r.Context(), uid, req.CurrentPassword, req.NewPassword); err != nil {
		writeAccountError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteSelf(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req DeleteAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if err := h.svc.DeleteSelf(r.Context(), uid, req.ConfirmEmail); err != nil {
		writeAccountError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAccountError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPasswordIncorrect):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_PASSWORD_INCORRECT", "errors.auth.password_incorrect", "Current password is incorrect")
	case errors.Is(err, ErrPasswordWeak):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_WEAK_PASSWORD", "errors.auth.weak_password", "Password must be at least 8 characters")
	case errors.Is(err, ErrEmailMismatch):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "ACCOUNT_DELETE_EMAIL_MISMATCH", "errors.account.delete_email_mismatch", "Confirmation email does not match account")
	case errors.Is(err, ErrUserNotFound):
		httpx.NotFound(w)
	default:
		httpx.InternalError(w)
	}
}
