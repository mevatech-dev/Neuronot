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

// Get returns the profile, lazily creating an empty row on first read.
// This means handler code never has to deal with "exists or not" — the row is always there.
func (r *Repository) Get(ctx context.Context, userID uuid.UUID) (*Profile, error) {
	var p Profile
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, focus_problem, intensity_level, avg_sleep_hours,
		       caffeine_daily, onboarding_completed_at, created_at, updated_at
		FROM profiles WHERE user_id = $1
	`, userID).Scan(
		&p.UserID, &p.FocusProblem, &p.IntensityLevel, &p.AvgSleepHours,
		&p.CaffeineDaily, &p.OnboardingCompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
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
	err := r.pool.QueryRow(ctx, `
		INSERT INTO profiles (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET updated_at = profiles.updated_at
		RETURNING user_id, focus_problem, intensity_level, avg_sleep_hours,
		          caffeine_daily, onboarding_completed_at, created_at, updated_at
	`, userID).Scan(
		&p.UserID, &p.FocusProblem, &p.IntensityLevel, &p.AvgSleepHours,
		&p.CaffeineDaily, &p.OnboardingCompletedAt, &p.CreatedAt, &p.UpdatedAt,
	)
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
	err := r.pool.QueryRow(ctx, `
		UPDATE profiles SET
			focus_problem           = COALESCE($2, focus_problem),
			intensity_level         = COALESCE($3, intensity_level),
			avg_sleep_hours         = COALESCE($4, avg_sleep_hours),
			caffeine_daily          = COALESCE($5, caffeine_daily),
			onboarding_completed_at = CASE WHEN $6 AND onboarding_completed_at IS NULL THEN now()
			                               ELSE onboarding_completed_at END,
			updated_at              = now()
		WHERE user_id = $1
		RETURNING user_id, focus_problem, intensity_level, avg_sleep_hours,
		          caffeine_daily, onboarding_completed_at, created_at, updated_at
	`, userID, p.FocusProblem, p.IntensityLevel, p.AvgSleepHours, p.CaffeineDaily, completeOnboarding,
	).Scan(
		&prof.UserID, &prof.FocusProblem, &prof.IntensityLevel, &prof.AvgSleepHours,
		&prof.CaffeineDaily, &prof.OnboardingCompletedAt, &prof.CreatedAt, &prof.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}
	return &prof, nil
}
