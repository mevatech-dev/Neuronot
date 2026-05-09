package profile

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/neuronot/api/internal/storage"
)

var (
	ErrInvalidFocusProblem  = errors.New("invalid focus_problem")
	ErrInvalidIntensity     = errors.New("intensity must be 1-5")
	ErrInvalidSleepHours    = errors.New("avg_sleep_hours must be 0-24")
	ErrInvalidTimezone      = errors.New("invalid timezone")
	ErrReminderHourRequired = errors.New("reminder_hour required when reminder_enabled is true")
	ErrInvalidReminderHour  = errors.New("reminder_hour must be 0-23")
	ErrInvalidContentType   = errors.New("avatar content_type must be image/jpeg or image/png")
	ErrAvatarUnavailable    = errors.New("avatar storage unavailable")
)

var validFocusProblems = map[string]bool{
	"focus": true, "energy": true, "headache": true, "sleep": true, "forgetfulness": true,
}

var validAvatarContentTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
}

const avatarPresignTTL = 15 * time.Minute

type Service struct {
	repo    *Repository
	storage *storage.Service
	newKey  func() string
}

// NewService composes the profile slice. storageSvc may be nil — the
// avatar endpoints return ErrAvatarUnavailable, but the rest of the
// profile flows still work.
func NewService(repo *Repository, storageSvc *storage.Service) *Service {
	return &Service{
		repo:    repo,
		storage: storageSvc,
		newKey:  func() string { return uuid.NewString() },
	}
}

func (s *Service) Get(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	return s.repo.Get(ctx, userID)
}

// AvatarURL returns a fresh pre-signed GET URL for the user's stored
// avatar key, or (nil, nil) if there is no avatar / storage is off.
func (s *Service) AvatarURL(ctx context.Context, p *Profile) (*storage.PresignedURL, error) {
	if s.storage == nil || p == nil || p.AvatarKey == nil || *p.AvatarKey == "" {
		return nil, nil
	}
	signed, err := s.storage.PresignGet(ctx, *p.AvatarKey, avatarPresignTTL)
	if err != nil {
		return nil, err
	}
	return &signed, nil
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

// RequestAvatarUpload returns a pre-signed PUT URL the mobile client can
// upload bytes to. Mobile is expected to PATCH /v1/me/profile with the
// returned key once the upload completes; until then, the object lives
// orphaned at the key (cleaned up by R2 lifecycle policy out-of-band).
func (s *Service) RequestAvatarUpload(ctx context.Context, userID uuid.UUID, contentType string) (AvatarUploadResponse, error) {
	if s.storage == nil {
		return AvatarUploadResponse{}, ErrAvatarUnavailable
	}
	ext, ok := validAvatarContentTypes[contentType]
	if !ok {
		return AvatarUploadResponse{}, ErrInvalidContentType
	}
	key := fmt.Sprintf("avatars/%s/%s.%s", userID, s.newKey(), ext)
	signed, err := s.storage.PresignPut(ctx, key, contentType, avatarPresignTTL)
	if err != nil {
		return AvatarUploadResponse{}, err
	}
	return AvatarUploadResponse{
		UploadURL: signed.URL,
		Key:       key,
		ExpiresAt: signed.ExpiresAt,
	}, nil
}

// ToResponse renders the profile, optionally enriching with a freshly
// signed avatar URL when storage is configured. Caller passes the URL
// (or nil) so the function stays pure on the *Profile pointer.
func ToResponse(p *Profile, avatar *storage.PresignedURL) ProfileResponse {
	resp := ProfileResponse{
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
	if avatar != nil {
		resp.AvatarURL = &avatar.URL
		resp.AvatarExpiresAt = &avatar.ExpiresAt
	}
	return resp
}
