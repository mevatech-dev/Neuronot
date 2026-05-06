package middleware

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const userIDKey contextKey = "user_id"

// RequireAuth validates the Bearer access token and injects user_id into the context.
// Token format: HS256 JWT, claim "sub" = user uuid, "exp" enforced by jwt lib.
func RequireAuth(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authz := r.Header.Get("Authorization")
			tok := strings.TrimPrefix(authz, "Bearer ")
			if tok == "" || tok == authz {
				writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "errors.generic.unauthorized", "Missing bearer token")
				return
			}

			parsed, err := jwt.Parse(tok, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return secret, nil
			})
			if err != nil || !parsed.Valid {
				writeError(w, http.StatusUnauthorized, "AUTH_TOKEN_INVALID", "errors.auth.token_invalid", "Invalid or expired token")
				return
			}

			claims, ok := parsed.Claims.(jwt.MapClaims)
			if !ok {
				writeError(w, http.StatusUnauthorized, "AUTH_TOKEN_INVALID", "errors.auth.token_invalid", "Malformed token")
				return
			}
			sub, _ := claims["sub"].(string)
			uid, err := uuid.Parse(sub)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "AUTH_TOKEN_INVALID", "errors.auth.token_invalid", "Invalid subject")
				return
			}

			ctx := context.WithValue(r.Context(), userIDKey, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserID extracts the authenticated user from the request context.
// Returns uuid.Nil if absent — handlers behind RequireAuth never see Nil.
func UserID(ctx context.Context) uuid.UUID {
	if v, ok := ctx.Value(userIDKey).(uuid.UUID); ok {
		return v
	}
	return uuid.Nil
}

// UserIDFromContext returns a string representation; "" when absent.
// Used by the logger so unauthenticated paths (login, /health) don't crash.
func UserIDFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(userIDKey).(uuid.UUID); ok {
		return v.String()
	}
	return ""
}

func writeError(w http.ResponseWriter, status int, code, messageKey, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body := struct {
		Data  any `json:"data"`
		Error *struct {
			Code       string `json:"code"`
			MessageKey string `json:"message_key"`
			Message    string `json:"message"`
		} `json:"error"`
	}{
		Error: &struct {
			Code       string `json:"code"`
			MessageKey string `json:"message_key"`
			Message    string `json:"message"`
		}{
			Code:       code,
			MessageKey: messageKey,
			Message:    message,
		},
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write middleware error", "err", err)
	}
}
