// api/internal/dataexport/service.go
package dataexport

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type repository interface {
	FetchProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error)
	FetchDailyLogs(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchEvents(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchInsights(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
}

type Service struct {
	repo repository
	now  func() time.Time
}

func NewService(repo repository) *Service {
	return &Service{repo: repo, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Build(ctx context.Context, userID uuid.UUID) (ExportPayload, error) {
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
