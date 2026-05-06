package stats

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	defaultDays = 30
	maxDays     = 90
)

var (
	ErrInvalidMetric = errors.New("invalid metric")
	ErrInvalidDays   = errors.New("days must be 1-90")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Trend(ctx context.Context, userID uuid.UUID, metric Metric, days int) (*Trend, error) {
	if !metric.IsValid() {
		return nil, ErrInvalidMetric
	}
	if days <= 0 {
		days = defaultDays
	}
	if days > maxDays {
		return nil, ErrInvalidDays
	}

	now := time.Now().UTC()
	end := now.Truncate(24 * time.Hour).AddDate(0, 0, 1)
	start := end.AddDate(0, 0, -days)

	points, err := s.repo.DailyTrend(ctx, userID, metric, start, end)
	if err != nil {
		return nil, err
	}
	return &Trend{Metric: metric, Days: days, Points: points}, nil
}
