package dailylog

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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
	r.Post("/", h.create)
	r.Get("/", h.list)
	r.Get("/today", h.today)
	r.Patch("/{id}", h.update)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	l, err := h.svc.Create(r.Context(), uid, req)
	if err != nil {
		writeDailyLogError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ToResponse(l))
}

func (h *Handler) today(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	l, err := h.svc.FindToday(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	if l == nil {
		httpx.WriteJSON(w, http.StatusOK, nil)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(l))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	cursor, err := httpx.DecodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		httpx.ValidationFailed(w, "invalid cursor")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	logs, err := h.svc.List(r.Context(), uid, cursor.At, cursor.ID, limit)
	if err != nil {
		httpx.InternalError(w)
		return
	}

	items := make([]Response, len(logs))
	for i, l := range logs {
		items[i] = ToResponse(&l)
	}

	resp := ListResponse{Items: items}
	if len(logs) > 0 && len(logs) >= effectiveLimit(limit) {
		last := logs[len(logs)-1]
		resp.NextCursor = httpx.EncodeCursor(httpx.Cursor{At: last.LoggedAt, ID: last.ID})
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.NotFound(w)
		return
	}
	var req UpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	l, err := h.svc.Update(r.Context(), uid, id, req)
	if err != nil {
		writeDailyLogError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(l))
}

func writeDailyLogError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrDuplicateForDay):
		httpx.WriteError(w, http.StatusConflict, "DAILY_LOG_DUPLICATE", "errors.daily_log.duplicate", "Already logged today")
	case errors.Is(err, ErrInvalidRange):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "DAILY_LOG_INVALID_RANGE", "errors.daily_log.invalid_range", "Slider value out of range")
	case errors.Is(err, ErrNotFound):
		httpx.NotFound(w)
	default:
		httpx.InternalError(w)
	}
}
