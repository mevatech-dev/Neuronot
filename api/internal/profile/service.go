package profile

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidFocusProblem    = errors.New("invalid focus_problem")
	ErrInvalidIntensity       = errors.New("intensity must be 1-5")
	ErrInvalidSleepHours      = errors.New("avg_sleep_hours must be 0-24")
	ErrInvalidTimezone        = errors.New("invalid timezone")
	ErrReminderHourRequired   = errors.New("reminder_hour required when reminder_enabled is true")
	ErrInvalidReminderHour    = errors.New("reminder_hour must be 0-23")
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
	if p.Timezone != nil {
		if _, err := time.LoadLocation(*p.Timezone); err != nil {
			return nil, ErrInvalidTimezone
		}
	}
	if p.ReminderHour != nil && (*p.ReminderHour < 0 || *p.ReminderHour > 23) {
		return nil, ErrInvalidReminderHour
	}
	// Enabling reminders without an hour is a misconfiguration.
	if p.ReminderEnabled != nil && *p.ReminderEnabled {
		// hour can come either from the same patch or already exist on the row;
		// if patch enables but doesn't set hour, require existing row to have it.
		if p.ReminderHour == nil {
			cur, err := s.repo.Get(ctx, userID)
			if err != nil {
				return nil, err
			}
			if cur.ReminderHour == nil {
				return nil, ErrReminderHourRequired
			}
		}
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
		Timezone:              p.Timezone,
		ReminderHour:          p.ReminderHour,
		ReminderEnabled:       p.ReminderEnabled,
		UpdatedAt:             p.UpdatedAt,
	}
}
