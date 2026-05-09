package profile

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrProfileNotFound = errors.New("profile not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const profileColumns = `user_id, focus_problem, intensity_level, avg_sleep_hours,
	caffeine_daily, onboarding_completed_at, timezone, reminder_hour, reminder_enabled,
	avatar_key, created_at, updated_at`

func scanProfile(row pgx.Row, p *Profile) error {
	return row.Scan(
		&p.UserID, &p.FocusProblem, &p.IntensityLevel, &p.AvgSleepHours,
		&p.CaffeineDaily, &p.OnboardingCompletedAt, &p.Timezone, &p.ReminderHour, &p.ReminderEnabled,
		&p.AvatarKey, &p.CreatedAt, &p.UpdatedAt,
	)
}

// Get returns the profile, lazily creating an empty row on first read.
// This means handler code never has to deal with "exists or not" — the row is always there.
func (r *Repository) Get(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	var p Profile
	err := scanProfile(r.pool.QueryRow(ctx, `
		SELECT `+profileColumns+`
		FROM profiles WHERE user_id = $1
	`, userID), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return r.create(ctx, userID)
		}
		return nil, err
	}
	return &p, nil
}

func (r *Repository) create(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	var p Profile
	err := scanProfile(r.pool.QueryRow(ctx, `
		INSERT INTO profiles (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = profiles.updated_at
		RETURNING `+profileColumns+`
	`, userID), &p)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// Patch applies the diff and returns the fresh row.
// COALESCE pattern: only update fields that are non-nil in the partial.
func (r *Repository) Patch(ctx context.Context, userID uuid.UUID, p PatchRequest) (*Profile, error) {
	var completeOnboarding bool
	if p.CompleteOnboarding != nil {
		completeOnboarding = *p.CompleteOnboarding
	}

	var prof Profile
	err := scanProfile(r.pool.QueryRow(ctx, `
		UPDATE profiles SET
			focus_problem           = COALESCE($2, focus_problem),
			intensity_level         = COALESCE($3, intensity_level),
			avg_sleep_hours         = COALESCE($4, avg_sleep_hours),
			caffeine_daily          = COALESCE($5, caffeine_daily),
			onboarding_completed_at = CASE WHEN $6 AND onboarding_completed_at IS NULL THEN now()
			                               ELSE onboarding_completed_at END,
			timezone                = COALESCE($7, timezone),
			reminder_hour           = COALESCE($8, reminder_hour),
			reminder_enabled        = COALESCE($9, reminder_enabled),
			avatar_key              = COALESCE($10, avatar_key),
			updated_at              = now()
		WHERE user_id = $1
		RETURNING `+profileColumns+`
	`, userID, p.FocusProblem, p.IntensityLevel, p.AvgSleepHours, p.CaffeineDaily,
		completeOnboarding, p.Timezone, p.ReminderHour, p.ReminderEnabled, p.AvatarKey,
	), &prof)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}
	return &prof, nil
}
