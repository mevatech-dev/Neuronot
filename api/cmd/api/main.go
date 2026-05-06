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
	"github.com/neuronot/api/internal/auth"
	"github.com/neuronot/api/internal/config"
	"github.com/neuronot/api/internal/db"
	httpx "github.com/neuronot/api/internal/http"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

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

	authRepo := auth.NewRepository(pool)
	authSvc := auth.NewService(authRepo, jwtSecret)
	authHandler := auth.NewHandler(authSvc)

	router := httpx.NewRouter(httpx.Deps{
		JWTSecret: jwtSecret,
		AuthRoutes: func(r chi.Router) {
			authHandler.Mount(r)
		},
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
