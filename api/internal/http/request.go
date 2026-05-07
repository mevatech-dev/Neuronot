// api/internal/http/request.go
package httpx

import (
	"net/http"
	"strings"
)

// ClientIP returns the best-effort client IP for an inbound request.
// Trusts X-Forwarded-For when present (first comma-segment, trimmed).
// Falls back to r.RemoteAddr when the header is absent.
//
// Used for rate-limiting and consent audit rows. The header is only
// trustworthy because chi's middleware.RealIP rewrites RemoteAddr based
// on it; this helper exists for handlers that want the raw header value
// without the chi middleware mutation.
func ClientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		if comma := strings.Index(ip, ","); comma >= 0 {
			return strings.TrimSpace(ip[:comma])
		}
		return strings.TrimSpace(ip)
	}
	return r.RemoteAddr
}
