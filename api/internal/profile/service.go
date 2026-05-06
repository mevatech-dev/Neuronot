package profile

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrInvalidFocusProblem = errors.New("invalid focus_problem")
	ErrInvalidIntensity    = errors.New("intensity must be 1-5")
	ErrInvalidSleepHours   = errors.New("avg_sleep_hours must be 0-24")
)

var validFocusProblems = map[string]bool{
	"focus": true, "energy": true, "headache": true, "sleep": true, "forgetfulness": true,
}

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	return s.repo.Get(ctx, userID)
}

func (s *Service) Patch(ctx context.Context, userID uuid.UUID, p PatchRequest) (*Profile, error) {
	if p.FocusProblem != nil && !validFocusProblems[*p.FocusProblem] {
		return nil, ErrInvalidFocusProblem
	}
	if p.IntensityLevel != nil && (*p.IntensityLevel < 1 || *p.IntensityLevel > 5) {
		return nil, ErrInvalidIntensity
	}
	if p.AvgSleepHours != nil && (*p.AvgSleepHours < 0 || *p.AvgSleepHours > 24) {
		return nil, ErrInvalidSleepHours
	}

	// Lazy-create row before patching so the WHERE clause has something to hit.
	if _, err := s.repo.Get(ctx, userID); err != nil {
		return nil, err
	}
	return s.repo.Patch(ctx, userID, p)
}

func ToResponse(p *Profile) ProfileResponse {
	return ProfileResponse{
		UserID:                p.UserID.String(),
		FocusProblem:          p.FocusProblem,
		IntensityLevel:        p.IntensityLevel,
		AvgSleepHours:         p.AvgSleepHours,
		CaffeineDaily:         p.CaffeineDaily,
		OnboardingCompletedAt: p.OnboardingCompletedAt,
		UpdatedAt:             p.UpdatedAt,
	}
}
