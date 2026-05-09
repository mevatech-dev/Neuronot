// api/internal/dataexport/handler.go
package dataexport

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
	r.Get("/", h.export)
}

func (h *Handler) export(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	resp, err := h.svc.Build(r.Context(), uid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "EXPORT_FAILED", "errors.export.failed", "Could not build export")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, resp)
}
