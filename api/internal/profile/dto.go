package profile

import "time"

type ProfileResponse struct {
	UserID                string     `json:"user_id"`
	FocusProblem          *string    `json:"focus_problem"`
	IntensityLevel        *int       `json:"intensity_level"`
	AvgSleepHours         *float64   `json:"avg_sleep_hours"`
	CaffeineDaily         *bool      `json:"caffeine_daily"`
	OnboardingCompletedAt *time.Time `json:"onboarding_completed_at"`
	Timezone              string     `json:"timezone"`
	ReminderHour          *int       `json:"reminder_hour"`
	ReminderEnabled       bool       `json:"reminder_enabled"`
	AvatarURL             *string    `json:"avatar_url,omitempty"`
	AvatarExpiresAt       *time.Time `json:"avatar_expires_at,omitempty"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

// PatchRequest uses pointers so a missing field stays untouched and a
// `null` JSON value reads as a no-op (we don't expose "clear" semantics yet).
type PatchRequest struct {
	FocusProblem       *string  `json:"focus_problem"`
	IntensityLevel     *int     `json:"intensity_level"`
	AvgSleepHours      *float64 `json:"avg_sleep_hours"`
	CaffeineDaily      *bool    `json:"caffeine_daily"`
	CompleteOnboarding *bool    `json:"complete_onboarding"`
	Timezone           *string  `json:"timezone"`
	ReminderHour       *int     `json:"reminder_hour"`
	ReminderEnabled    *bool    `json:"reminder_enabled"`
	AvatarKey          *string  `json:"avatar_key"`
}

// AvatarUploadRequest is the body of POST /v1/me/avatar — mobile sends
// the content_type it intends to PUT (image/jpeg or image/png) so the
// signed URL pins a matching Content-Type header.
type AvatarUploadRequest struct {
	ContentType string `json:"content_type"`
}

// AvatarUploadResponse hands mobile a single-use upload URL plus the
// object key it should patch back into the profile once upload succeeds.
type AvatarUploadResponse struct {
	UploadURL string    `json:"upload_url"`
	Key       string    `json:"key"`
	ExpiresAt time.Time `json:"expires_at"`
}
