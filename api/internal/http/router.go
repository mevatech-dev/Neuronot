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

	// Each feature mounts its own routes — keeps wiring near features
	// instead of growing one big router file.
	AuthRoutes     func(chi.Router)
	ProfileRoutes  func(chi.Router)
	DailyLogRoutes func(chi.Router)
	EventsRoutes   func(chi.Router)
	TimelineRoutes func(chi.Router)
	InsightsRoutes func(chi.Router)
	SummaryRoutes  func(chi.Router)
	StatsRoutes    func(chi.Router)
	SyncRoutes     func(chi.Router)
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
		// Public — no auth.
		if d.AuthRoutes != nil {
			v1.Route("/auth", d.AuthRoutes)
		}

		// Authenticated section.
		v1.Group(func(p chi.Router) {
			p.Use(middleware.RequireAuth(d.JWTSecret))
			if d.ProfileRoutes != nil {
				p.Route("/profile", d.ProfileRoutes)
			}
			if d.DailyLogRoutes != nil {
				p.Route("/daily-logs", d.DailyLogRoutes)
			}
			if d.EventsRoutes != nil {
				p.Route("/events", d.EventsRoutes)
			}
			if d.TimelineRoutes != nil {
				p.Route("/timeline", d.TimelineRoutes)
			}
			if d.InsightsRoutes != nil {
				p.Route("/insights", d.InsightsRoutes)
			}
			if d.SummaryRoutes != nil {
				p.Route("/summary", d.SummaryRoutes)
			}
			if d.StatsRoutes != nil {
				p.Route("/stats", d.StatsRoutes)
			}
			if d.SyncRoutes != nil {
				p.Route("/sync", d.SyncRoutes)
			}
		})
	})

	return r
}
