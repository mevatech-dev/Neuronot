package summary

import (
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
	r.Get("/weekly", h.weekly)
}

func (h *Handler) weekly(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	out, err := h.svc.Weekly(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(out))
}
