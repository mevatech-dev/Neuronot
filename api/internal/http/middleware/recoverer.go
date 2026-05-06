package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic",
					"err", rec,
					"path", r.URL.Path,
					"stack", string(debug.Stack()),
				)
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "errors.generic.internal_error", "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
