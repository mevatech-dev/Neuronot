package httpx

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/neuronot/api/internal/http/middleware"
)

type Deps struct {
	JWTSecret []byte

	// Each feature exposes a Mount(r chi.Router) function.
	AuthRoutes func(chi.Router)
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RealIP)
	r.Use(chimw.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestLogger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Accept-Language"},
		ExposedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/v1", func(v1 chi.Router) {
		if d.AuthRoutes != nil {
			v1.Route("/auth", d.AuthRoutes)
		}
	})

	return r
}
