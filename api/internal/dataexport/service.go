// api/internal/dataexport/service.go
package dataexport

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/neuronot/api/internal/email"
	"github.com/neuronot/api/internal/storage"
)

const presignTTL = 15 * time.Minute

type repository interface {
	FetchProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error)
	FetchDailyLogs(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchEvents(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchInsights(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	GetUserContact(ctx context.Context, userID uuid.UUID) (string, string, error)
}

type Service struct {
	repo    repository
	storage *storage.Service
	emails  *email.Service
	now     func() time.Time
	newKey  func() string
}

// NewService composes the dataexport pipeline. storageSvc and emails may
// be nil — the service degrades gracefully (storage nil → inline
// payload; emails nil → no notification).
func NewService(repo repository, storageSvc *storage.Service, emails *email.Service) *Service {
	return &Service{
		repo:    repo,
		storage: storageSvc,
		emails:  emails,
		now:     func() time.Time { return time.Now().UTC() },
		newKey:  func() string { return uuid.NewString() },
	}
}

func (s *Service) Build(ctx context.Context, userID uuid.UUID) (ExportResponse, error) {
	payload, err := s.aggregate(ctx, userID)
	if err != nil {
		return ExportResponse{}, err
	}

	// Inline fallback when R2 is not configured (dev / no-creds boot).
	if s.storage == nil {
		return ExportResponse{Payload: &payload}, nil
	}

	key := fmt.Sprintf("exports/%s/%s.json", userID, s.newKey())
	size, err := s.storage.PutJSON(ctx, key, payload)
	if err != nil {
		return ExportResponse{}, err
	}
	signed, err := s.storage.PresignGet(ctx, key, presignTTL)
	if err != nil {
		return ExportResponse{}, err
	}

	// Best-effort export-ready email; never blocks the response.
	if s.emails != nil {
		if userEmail, locale, lookupErr := s.repo.GetUserContact(ctx, userID); lookupErr == nil && userEmail != "" {
			email.SendAsync(s.emails, email.SendInput{
				To:       userEmail,
				Locale:   locale,
				Template: email.TemplateExportReady,
				Vars: map[string]any{
					"DownloadURL": signed.URL,
					"ExpiresAt":   signed.ExpiresAt.Format(time.RFC1123),
				},
			})
		} else if lookupErr != nil {
			slog.Warn("dataexport: contact lookup failed", "err", lookupErr)
		}
	}

	return ExportResponse{
		DownloadURL: signed.URL,
		ExpiresAt:   &signed.ExpiresAt,
		SizeBytes:   size,
	}, nil
}

func (s *Service) aggregate(ctx context.Context, userID uuid.UUID) (ExportPayload, error) {
	profile, err := s.repo.FetchProfile(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	logs, err := s.repo.FetchDailyLogs(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	events, err := s.repo.FetchEvents(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	insights, err := s.repo.FetchInsights(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	return ExportPayload{
		GeneratedAt: s.now(),
		Profile:     profile,
		DailyLogs:   logs,
		Events:      events,
		Insights:    insights,
	}, nil
}
