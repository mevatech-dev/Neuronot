package profile

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
	r.Get("/", h.get)
	r.Patch("/", h.patch)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	p, err := h.svc.Get(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(p))
}

func (h *Handler) patch(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req PatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	p, err := h.svc.Patch(r.Context(), uid, req)
	if err != nil {
		writeProfileError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(p))
}

func writeProfileError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidFocusProblem):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_INVALID_FOCUS", "errors.profile.invalid_focus", "Invalid focus_problem")
	case errors.Is(err, ErrInvalidIntensity):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_INVALID_INTENSITY", "errors.profile.invalid_intensity", "intensity_level must be 1-5")
	case errors.Is(err, ErrInvalidSleepHours):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_INVALID_SLEEP", "errors.profile.invalid_sleep", "avg_sleep_hours must be 0-24")
	case errors.Is(err, ErrInvalidTimezone):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_INVALID_TIMEZONE", "errors.profile.invalid_timezone", "Invalid IANA timezone")
	case errors.Is(err, ErrInvalidReminderHour):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_INVALID_REMINDER_HOUR", "errors.profile.invalid_reminder_hour", "reminder_hour must be 0-23")
	case errors.Is(err, ErrReminderHourRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "PROFILE_REMINDER_HOUR_REQUIRED", "errors.profile.reminder_hour_required", "reminder_hour is required when reminder_enabled is true")
	default:
		httpx.InternalError(w)
	}
}
