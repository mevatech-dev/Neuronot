package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type Envelope struct {
	Data  any         `json:"data"`
	Error *ErrorBody  `json:"error"`
}

type ErrorBody struct {
	Code       string `json:"code"`
	MessageKey string `json:"message_key"`
	Message    string `json:"message"`
}

func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(Envelope{Data: data}); err != nil {
		slog.Error("write json", "err", err)
	}
}

func WriteError(w http.ResponseWriter, status int, code, messageKey, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body := Envelope{
		Error: &ErrorBody{
			Code:       code,
			MessageKey: messageKey,
			Message:    message,
		},
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write error", "err", err)
	}
}

// Common error helpers — keep handlers terse.

func NotFound(w http.ResponseWriter) {
	WriteError(w, http.StatusNotFound, "RESOURCE_NOT_FOUND", "errors.generic.not_found", "Resource not found")
}

func Unauthorized(w http.ResponseWriter) {
	WriteError(w, http.StatusUnauthorized, "UNAUTHORIZED", "errors.generic.unauthorized", "Authentication required")
}

func ValidationFailed(w http.ResponseWriter, msg string) {
	WriteError(w, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "errors.generic.validation_failed", msg)
}

func InternalError(w http.ResponseWriter) {
	WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "errors.generic.internal_error", "Internal server error")
}
