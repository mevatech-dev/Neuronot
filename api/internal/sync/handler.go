package sync

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

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
	r.Get("/pull", h.pull)
	r.Post("/push", h.push)
}

func (h *Handler) pull(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())

	var since time.Time
	if v := r.URL.Query().Get("since"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			httpx.WriteError(w, http.StatusUnprocessableEntity, "SYNC_INVALID_SINCE", "errors.sync.invalid_since", "since must be RFC3339")
			return
		}
		since = t.UTC()
	}

	delta, err := h.svc.Pull(r.Context(), uid, since)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToPullResponse(delta))
}

func (h *Handler) push(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())

	var req PushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}

	ops := make([]PushOperation, 0, len(req.Operations))
	for _, o := range req.Operations {
		ops = append(ops, PushOperation{
			Table:     Table(o.Table),
			Op:        Op(o.Op),
			ID:        o.ID,
			Row:       o.Row,
			UpdatedAt: o.UpdatedAt,
		})
	}

	out, err := h.svc.Push(r.Context(), uid, ops)
	if err != nil {
		switch {
		case errors.Is(err, ErrBatchTooLarge):
			httpx.WriteError(w, http.StatusRequestEntityTooLarge, "SYNC_BATCH_TOO_LARGE", "errors.sync.batch_too_large", "batch exceeds limit")
		case errors.Is(err, ErrUnknownTable):
			httpx.WriteError(w, http.StatusUnprocessableEntity, "SYNC_UNKNOWN_TABLE", "errors.sync.unknown_table", "unknown table")
		default:
			httpx.InternalError(w)
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToPushResponse(out))
}
