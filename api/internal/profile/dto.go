package profile

import "time"

type ProfileResponse struct {
	UserID                string     `json:"user_id"`
	FocusProblem          *string    `json:"focus_problem"`
	IntensityLevel        *int       `json:"intensity_level"`
	AvgSleepHours         *float64   `json:"avg_sleep_hours"`
	CaffeineDaily         *bool      `json:"caffeine_daily"`
	OnboardingCompletedAt *time.Time `json:"onboarding_completed_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

// PatchRequest uses pointers so a missing field stays untouched and a
// `null` JSON value reads as a no-op (we don't expose "clear" semantics yet).
type PatchRequest struct {
	FocusProblem    *string  `json:"focus_problem"`
	IntensityLevel  *int     `json:"intensity_level"`
	AvgSleepHours   *float64 `json:"avg_sleep_hours"`
	CaffeineDaily   *bool    `json:"caffeine_daily"`
	CompleteOnboarding *bool `json:"complete_onboarding"`
}
