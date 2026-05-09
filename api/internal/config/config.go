package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL  string
	JWTSecret    string
	OpenAIAPIKey string
	ConsentKEK   []byte
	Port         string
	LogLevel     string

	// Optional OIDC providers. Empty means the provider is disabled and
	// the corresponding /v1/auth/{apple,google} endpoint will return 503.
	AppleBundleID   string
	GoogleAudiences []string

	// Optional Cloudflare R2 (object storage). Empty fields disable the
	// storage service; dataexport falls back to inline JSON and the
	// avatar endpoint returns 503. See ADR 0002.
	R2 R2Config

	// Optional Resend (transactional email). Empty fields disable the
	// service; account-deletion + export-ready paths skip silently.
	Resend ResendConfig
}

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
}

// Enabled is true only when every R2 credential is set. The storage
// package's NewClient enforces the same invariant.
func (c R2Config) Enabled() bool {
	return c.AccountID != "" && c.AccessKeyID != "" && c.SecretAccessKey != "" && c.Bucket != ""
}

type ResendConfig struct {
	APIKey string
	From   string
}

func (c ResendConfig) Enabled() bool {
	return c.APIKey != "" && c.From != ""
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		OpenAIAPIKey: os.Getenv("OPENAI_API_KEY"),
		Port:         getenv("PORT", "8080"),
		LogLevel:     getenv("LOG_LEVEL", "info"),
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	rawKEK := os.Getenv("CONSENT_KEK")
	if rawKEK == "" {
		missing = append(missing, "CONSENT_KEK")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required env vars: %v", missing)
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET must be at least 32 characters")
	}
	kek, err := base64.StdEncoding.DecodeString(rawKEK)
	if err != nil {
		return nil, fmt.Errorf("CONSENT_KEK: %w", err)
	}
	if len(kek) != 32 {
		return nil, errors.New("CONSENT_KEK must decode to exactly 32 bytes (AES-256)")
	}
	cfg.ConsentKEK = kek

	cfg.AppleBundleID = os.Getenv("APPLE_BUNDLE_ID")
	if raw := os.Getenv("GOOGLE_OAUTH_AUDIENCES"); raw != "" {
		for _, a := range strings.Split(raw, ",") {
			if v := strings.TrimSpace(a); v != "" {
				cfg.GoogleAudiences = append(cfg.GoogleAudiences, v)
			}
		}
	}

	cfg.R2 = R2Config{
		AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		Bucket:          os.Getenv("R2_BUCKET"),
	}
	cfg.Resend = ResendConfig{
		APIKey: os.Getenv("RESEND_API_KEY"),
		From:   os.Getenv("EMAIL_FROM"),
	}

	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
