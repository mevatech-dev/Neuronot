package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/joho/godotenv"

	"github.com/neuronot/api/internal/account"
	"github.com/neuronot/api/internal/auth"
	"github.com/neuronot/api/internal/auth/oidc"
	"github.com/neuronot/api/internal/config"
	"github.com/neuronot/api/internal/consents"
	"github.com/neuronot/api/internal/dailylog"
	"github.com/neuronot/api/internal/dataexport"
	"github.com/neuronot/api/internal/db"
	"github.com/neuronot/api/internal/email"
	"github.com/neuronot/api/internal/events"
	httpx "github.com/neuronot/api/internal/http"
	"github.com/neuronot/api/internal/insights"
	"github.com/neuronot/api/internal/profile"
	"github.com/neuronot/api/internal/stats"
	"github.com/neuronot/api/internal/storage"
	"github.com/neuronot/api/internal/summary"
	syncpkg "github.com/neuronot/api/internal/sync"
	"github.com/neuronot/api/internal/timeline"
)

// consentsForInsights bridges insights' string-typed consent check into
// the consents service's typed API. We keep insights independent of the
// consents package symbols.
type consentsForInsights struct{ svc *consents.Service }

func (c *consentsForInsights) IsGranted(ctx context.Context, userID uuid.UUID, t string) (bool, error) {
	return c.svc.IsGranted(ctx, userID, consents.ConsentType(t))
}

// accountTokenRevoker bridges the account service to auth's refresh-token revocation.
// Lives here because the auth and account slices are deliberately separate concerns.
type accountTokenRevoker struct{ repo *auth.Repository }

func (a *accountTokenRevoker) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	return a.repo.RevokeAllForUser(ctx, userID)
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	// Best-effort load of .env from the working dir or one above (so both
	// `cd api && go run ./cmd/api` and `make api-dev` from repo root work).
	// Real envs (CI, prod) set vars directly and the missing-file error is ignored.
	_ = godotenv.Load(".env", "api/.env")

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("db connect", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	jwtSecret := []byte(cfg.JWTSecret)

	// Optional R2 storage. When env is incomplete, dependent features
	// (dataexport URL response, avatar upload) gracefully disable.
	var storageSvc *storage.Service
	if cfg.R2.Enabled() {
		s3Client, err := storage.NewClient(ctx, storage.Config(cfg.R2))
		if err != nil {
			slog.Error("storage init", "err", err)
			os.Exit(1)
		}
		storageSvc = storage.NewService(s3Client, cfg.R2.Bucket)
		slog.Info("storage enabled", "bucket", cfg.R2.Bucket)
	} else {
		slog.Info("storage disabled — R2 env vars missing")
	}

	// Optional Resend email. When unset, account-deletion + export-ready
	// notifications skip silently; primary flows still succeed.
	var emailSvc *email.Service
	if cfg.Resend.Enabled() {
		resendClient, err := email.NewClient(email.Config(cfg.Resend))
		if err != nil {
			slog.Error("email init", "err", err)
			os.Exit(1)
		}
		emailSvc = email.NewService(resendClient, cfg.Resend.From)
		slog.Info("email enabled", "from", cfg.Resend.From)
	} else {
		slog.Info("email disabled — RESEND_API_KEY/EMAIL_FROM missing")
	}

	consentsRepo := consents.NewRepository(pool, cfg.ConsentKEK)
	consentsSvc := consents.NewService(consentsRepo)
	consentsHandler := consents.NewHandler(consentsSvc)

	authRepo := auth.NewRepository(pool)

	// Optional OIDC verifier. Each provider is enabled only when its
	// audience config is present; absent providers cause the matching
	// /v1/auth/{apple,google} endpoint to return 503.
	var appleCfg *oidc.AppleConfig
	if cfg.AppleBundleID != "" {
		appleCfg = &oidc.AppleConfig{BundleID: cfg.AppleBundleID}
	}
	var googleCfg *oidc.GoogleConfig
	if len(cfg.GoogleAudiences) > 0 {
		googleCfg = &oidc.GoogleConfig{Audiences: cfg.GoogleAudiences}
	}
	var verifier auth.OIDCVerifier
	if appleCfg != nil || googleCfg != nil {
		verifier = oidc.NewVerifier(appleCfg, googleCfg)
	}

	authSvc := auth.NewServiceWithOIDC(authRepo, consentsSvc, jwtSecret, verifier)
	authHandler := auth.NewHandler(authSvc)

	profileRepo := profile.NewRepository(pool)
	profileSvc := profile.NewService(profileRepo, storageSvc)
	profileHandler := profile.NewHandler(profileSvc)

	dailyLogRepo := dailylog.NewRepository(pool)
	dailyLogSvc := dailylog.NewService(dailyLogRepo)
	dailyLogHandler := dailylog.NewHandler(dailyLogSvc)

	eventsRepo := events.NewRepository(pool)
	eventsSvc := events.NewService(eventsRepo)
	eventsHandler := events.NewHandler(eventsSvc)

	timelineSvc := timeline.NewService(dailyLogSvc, eventsSvc)
	timelineHandler := timeline.NewHandler(timelineSvc)

	insightsRepo := insights.NewRepository(pool)
	insightsGenerator := insights.NewOpenAIGenerator(cfg.OpenAIAPIKey)
	insightsSvc := insights.NewService(insightsRepo, insightsGenerator, insights.NewSafetyFilter(), &consentsForInsights{svc: consentsSvc})
	insightsHandler := insights.NewHandler(insightsSvc)

	summaryRepo := summary.NewRepository(pool)
	summarySvc := summary.NewService(summaryRepo)
	summaryHandler := summary.NewHandler(summarySvc)

	statsRepo := stats.NewRepository(pool)
	statsSvc := stats.NewService(statsRepo)
	statsHandler := stats.NewHandler(statsSvc)

	syncSvc := syncpkg.NewService(dailyLogSvc, eventsSvc, insightsSvc, profileSvc)
	syncHandler := syncpkg.NewHandler(syncSvc)

	accountRepo := account.NewRepository(pool)
	accountSvc := account.NewService(accountRepo, &accountTokenRevoker{repo: authRepo}, emailSvc)
	accountHandler := account.NewHandler(accountSvc)

	exportRepo := dataexport.NewRepository(pool)
	exportSvc := dataexport.NewService(exportRepo, storageSvc, emailSvc)
	exportHandler := dataexport.NewHandler(exportSvc)

	router := httpx.NewRouter(httpx.Deps{
		JWTSecret:             jwtSecret,
		AuthRoutes:            func(r chi.Router) { authHandler.Mount(r) },
		AuthUpgradeRoutes:     func(r chi.Router) { authHandler.MountUpgrade(r) },
		AuthLinksRoutes:       func(r chi.Router) { authHandler.MountLinks(r) },
		ProfileRoutes:         func(r chi.Router) { profileHandler.Mount(r) },
		DailyLogRoutes:        func(r chi.Router) { dailyLogHandler.Mount(r) },
		EventsRoutes:          func(r chi.Router) { eventsHandler.Mount(r) },
		TimelineRoutes:        func(r chi.Router) { timelineHandler.Mount(r) },
		InsightsRoutes:        func(r chi.Router) { insightsHandler.Mount(r) },
		SummaryRoutes:         func(r chi.Router) { summaryHandler.Mount(r) },
		StatsRoutes:           func(r chi.Router) { statsHandler.Mount(r) },
		SyncRoutes:            func(r chi.Router) { syncHandler.Mount(r) },
		ConsentsRoutes:        func(r chi.Router) { consentsHandler.Mount(r) },
		AccountPasswordRoutes: func(r chi.Router) { accountHandler.MountPassword(r) },
		AccountMeRoutes:       func(r chi.Router) { accountHandler.MountMe(r) },
		ExportRoutes:          func(r chi.Router) { exportHandler.Mount(r) },
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	go func() {
		slog.Info("api starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown", "err", err)
	}
}
