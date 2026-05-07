package insights

import (
	"encoding/json"
	"errors"
	"io"
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
	r.Get("/", h.list)
	r.Post("/generate", h.generate)
}

func (h *Handler) generate(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req GenerateRequest
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			if !errors.Is(err, io.EOF) {
				httpx.ValidationFailed(w, "invalid json body")
				return
			}
		}
	}
	insight, err := h.svc.Generate(r.Context(), uid, req.Language)
	if err != nil {
		writeInsightError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToResponse(insight))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	list, err := h.svc.List(r.Context(), uid, limit)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	items := make([]Response, len(list))
	for i, in := range list {
		items[i] = ToResponse(&in)
	}
	httpx.WriteJSON(w, http.StatusOK, ListResponse{Items: items})
}

func writeInsightError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInsufficientData):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "INSIGHT_INSUFFICIENT_DATA", "errors.insight.insufficient_data", "Add at least 3 daily logs before generating an insight")
	case errors.Is(err, ErrAIUnavailable):
		httpx.WriteError(w, http.StatusServiceUnavailable, "INSIGHT_AI_UNAVAILABLE", "errors.insight.ai_unavailable", "Insight generation is unavailable")
	case errors.Is(err, ErrRateLimited):
		httpx.WriteError(w, http.StatusTooManyRequests, "INSIGHT_RATE_LIMITED", "errors.insight.rate_limited", "Insight already generated today")
	case errors.Is(err, ErrConsentRevoked):
		httpx.WriteError(w, http.StatusForbidden, "INSIGHT_CONSENT_REVOKED", "errors.insight.consent_revoked", "AI consent is revoked or out of date")
	default:
		httpx.InternalError(w)
	}
}
