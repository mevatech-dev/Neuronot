package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"

	httpx "github.com/neuronot/api/internal/http"
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
				httpx.InternalError(w)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
