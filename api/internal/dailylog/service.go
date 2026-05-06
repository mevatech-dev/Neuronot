package dailylog

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

var (
	ErrInvalidRange = errors.New("invalid range for slider value")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateRequest) (*DailyLog, error) {
	if !inRange(req.Focus, 1, 5) ||
		!inRange(req.Energy, 1, 5) ||
		!inRange(req.SleepQuality, 1, 5) ||
		!inRange(req.Forgetfulness, 0, 5) ||
		!inRange(req.Stress, 0, 5) {
		return nil, ErrInvalidRange
	}

	loggedAt := time.Now().UTC()
	if req.LoggedAt != nil {
		loggedAt = req.LoggedAt.UTC()
	}

	return s.repo.Create(ctx, userID, DailyLog{
		Focus:         req.Focus,
		Energy:        req.Energy,
		Forgetfulness: req.Forgetfulness,
		Stress:        req.Stress,
		SleepQuality:  req.SleepQuality,
		LoggedAt:      loggedAt,
	})
}

func (s *Service) FindToday(ctx context.Context, userID uuid.UUID) (*DailyLog, error) {
	return s.repo.FindToday(ctx, userID)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, beforeAt time.Time, beforeID uuid.UUID, limit int) ([]DailyLog, error) {
	return s.repo.List(ctx, userID, beforeAt, beforeID, effectiveLimit(limit))
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateRequest) (*DailyLog, error) {
	if req.Focus != nil && !inRange(*req.Focus, 1, 5) {
		return nil, ErrInvalidRange
	}
	if req.Energy != nil && !inRange(*req.Energy, 1, 5) {
		return nil, ErrInvalidRange
	}
	if req.SleepQuality != nil && !inRange(*req.SleepQuality, 1, 5) {
		return nil, ErrInvalidRange
	}
	if req.Forgetfulness != nil && !inRange(*req.Forgetfulness, 0, 5) {
		return nil, ErrInvalidRange
	}
	if req.Stress != nil && !inRange(*req.Stress, 0, 5) {
		return nil, ErrInvalidRange
	}
	return s.repo.Update(ctx, userID, id, req)
}

// ListUpdatedSince is exposed for the sync slice — cross-feature pull aggregator.
func (s *Service) ListUpdatedSince(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]DailyLog, error) {
	return s.repo.ListUpdatedSince(ctx, userID, since, effectiveLimit(limit))
}

func ToResponse(l *DailyLog) Response {
	return Response{
		ID:            l.ID.String(),
		Focus:         l.Focus,
		Energy:        l.Energy,
		Forgetfulness: l.Forgetfulness,
		Stress:        l.Stress,
		SleepQuality:  l.SleepQuality,
		LoggedAt:      l.LoggedAt,
		UpdatedAt:     l.UpdatedAt,
	}
}

func effectiveLimit(req int) int {
	if req <= 0 {
		return defaultLimit
	}
	if req > maxLimit {
		return maxLimit
	}
	return req
}

func inRange(v, lo, hi int) bool { return v >= lo && v <= hi }
