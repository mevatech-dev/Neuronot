package stats

import (
	"errors"
	"net/http"
	"strconv"

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
	r.Get("/trend", h.trend)
}

func (h *Handler) trend(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())

	metric := Metric(r.URL.Query().Get("metric"))
	if metric == "" {
		metric = MetricFocus
	}

	days, _ := strconv.Atoi(r.URL.Query().Get("days"))

	out, err := h.svc.Trend(r.Context(), uid, metric, days)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidMetric):
			httpx.WriteError(w, http.StatusUnprocessableEntity, "STATS_INVALID_METRIC", "errors.stats.invalid_metric", "Unknown metric")
		case errors.Is(err, ErrInvalidDays):
			httpx.WriteError(w, http.StatusUnprocessableEntity, "STATS_INVALID_DAYS", "errors.stats.invalid_days", "days must be 1-90")
		default:
			httpx.InternalError(w)
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(out))
}
