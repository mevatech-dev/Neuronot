package events

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
	r.Patch("/{id}", h.update)
	r.Delete("/{id}", h.delete)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	e, err := h.svc.Create(r.Context(), uid, req)
	if err != nil {
		writeEventError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ToResponse(e))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	cursor, err := httpx.DecodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		httpx.ValidationFailed(w, "invalid cursor")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	list, err := h.svc.List(r.Context(), uid, cursor.At, cursor.ID, limit)
	if err != nil {
		httpx.InternalError(w)
		return
	}

	items := make([]Response, len(list))
	for i, e := range list {
		items[i] = ToResponse(&e)
	}

	resp := ListResponse{Items: items}
	if len(list) > 0 && len(list) >= effectiveLimit(limit) {
		last := list[len(list)-1]
		resp.NextCursor = httpx.EncodeCursor(httpx.Cursor{At: last.OccurredAt, ID: last.ID})
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
	e, err := h.svc.Update(r.Context(), uid, id, req)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.NotFound(w)
			return
		}
		writeEventError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(e))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.NotFound(w)
		return
	}
	if err := h.svc.Delete(r.Context(), uid, id); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.NotFound(w)
			return
		}
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeEventError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidType):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "EVENT_INVALID_TYPE", "errors.event.invalid_type", "Unknown event type")
	case errors.Is(err, ErrInvalidIntensity):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "EVENT_INVALID_INTENSITY", "errors.event.invalid_intensity", "intensity must be 1-5")
	case errors.Is(err, ErrNoteTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "EVENT_NOTE_TOO_LONG", "errors.event.note_too_long", "Note exceeds 500 characters")
	default:
		httpx.InternalError(w)
	}
}
