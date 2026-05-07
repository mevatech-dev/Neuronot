// api/internal/consents/handler.go
package consents

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

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

// Mount attaches GET /, POST /, DELETE /{type} under whatever parent the
// caller chose (typically /v1/me/consents).
func (h *Handler) Mount(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.grant)
	r.Delete("/{type}", h.revoke)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	out, err := h.svc.All(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) grant(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req GrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if !req.Type.IsValid() {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CONSENT_UNKNOWN_TYPE", "errors.consent.unknown_type", "Unknown consent type")
		return
	}
	rc := requestRecordContext(r, SourceSettings)
	var err error
	if req.Granted {
		err = h.svc.Grant(r.Context(), uid, req.Type, rc)
	} else {
		err = h.svc.Revoke(r.Context(), uid, req.Type, rc)
	}
	if err != nil {
		if errors.Is(err, ErrUnknownType) {
			httpx.WriteError(w, http.StatusUnprocessableEntity, "CONSENT_UNKNOWN_TYPE", "errors.consent.unknown_type", "Unknown consent type")
			return
		}
		httpx.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) revoke(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	t := ConsentType(chi.URLParam(r, "type"))
	if !t.IsValid() {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CONSENT_UNKNOWN_TYPE", "errors.consent.unknown_type", "Unknown consent type")
		return
	}
	if err := h.svc.Revoke(r.Context(), uid, t, requestRecordContext(r, SourceSettings)); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.NotFound(w)
			return
		}
		httpx.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// requestRecordContext extracts IP, device id, user agent from the request
// for the consent audit row. Caller decides the source.
func requestRecordContext(r *http.Request, src Source) RecordContext {
	return RecordContext{
		IP:        clientIP(r),
		DeviceID:  r.Header.Get("X-Device-Id"),
		UserAgent: r.UserAgent(),
		Source:    src,
	}
}

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		if comma := strings.Index(ip, ","); comma >= 0 {
			return strings.TrimSpace(ip[:comma])
		}
		return strings.TrimSpace(ip)
	}
	return r.RemoteAddr
}
