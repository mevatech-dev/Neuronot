package profile

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	UserID                uuid.UUID
	FocusProblem          *string
	IntensityLevel        *int
	AvgSleepHours         *float64
	CaffeineDaily         *bool
	OnboardingCompletedAt *time.Time
	CreatedAt             time.Time
	UpdatedAt             time.Time
}
