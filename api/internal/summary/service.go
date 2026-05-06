package summary

import (
	"context"
	"time"

	"github.com/google/uuid"
)

const windowDays = 7

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Weekly(ctx context.Context, userID uuid.UUID) (*Weekly, error) {
	now := time.Now().UTC()
	end := now.Truncate(24 * time.Hour).AddDate(0, 0, 1) // exclusive end = tomorrow 00:00 UTC
	start := end.AddDate(0, 0, -windowDays)
	return s.repo.Aggregate(ctx, userID, start, end)
}
