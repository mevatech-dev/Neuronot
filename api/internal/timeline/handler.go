package timeline

import (
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
	r.Get("/", h.list)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	cursor, err := httpx.DecodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		httpx.ValidationFailed(w, "invalid cursor")
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	items, hasMore, err := h.svc.List(r.Context(), uid, cursor.At, cursor.ID, limit)
	if err != nil {
		httpx.InternalError(w)
		return
	}

	resp := Response{Items: items}
	if hasMore && len(items) > 0 {
		last := items[len(items)-1]
		// Cursor encoded against the last visible item; next page resumes below it.
		if id, perr := uuid.Parse(last.ID); perr == nil {
			resp.NextCursor = httpx.EncodeCursor(httpx.Cursor{At: last.At, ID: id})
		}
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
