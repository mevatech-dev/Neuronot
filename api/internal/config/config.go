package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL  string
	JWTSecret    string
	OpenAIAPIKey string
	ConsentKEK   []byte
	Port         string
	LogLevel     string
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

	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
