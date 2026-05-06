package dailylog

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrDuplicateForDay = errors.New("daily log already exists for this day")
	ErrNotFound        = errors.New("daily log not found")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, in DailyLog) (*DailyLog, error) {
	in.UserID = userID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO daily_logs (user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at, created_at
	`,
		in.UserID, in.Focus, in.Energy, in.Forgetfulness, in.Stress, in.SleepQuality, in.LoggedAt,
	).Scan(
		&in.ID, &in.UserID, &in.Focus, &in.Energy, &in.Forgetfulness, &in.Stress,
		&in.SleepQuality, &in.LoggedAt, &in.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicateForDay
		}
		return nil, err
	}
	return &in, nil
}

// FindToday returns the user's log for today (UTC) if one exists.
// nil + nil means "no log yet" — handler distinguishes via the nil pointer.
func (r *Repository) FindToday(ctx context.Context, userID uuid.UUID) (*DailyLog, error) {
	var l DailyLog
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at, created_at
		FROM daily_logs
		WHERE user_id = $1
		  AND (logged_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
		LIMIT 1
	`, userID).Scan(
		&l.ID, &l.UserID, &l.Focus, &l.Energy, &l.Forgetfulness, &l.Stress,
		&l.SleepQuality, &l.LoggedAt, &l.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &l, nil
}

// List returns up to `limit` rows after the cursor (logged_at, id) tuple.
// Caller passes zero-value cursor to get the newest page.
func (r *Repository) List(ctx context.Context, userID uuid.UUID, before time.Time, beforeID uuid.UUID, limit int) ([]DailyLog, error) {
	if before.IsZero() {
		before = time.Now().Add(time.Hour) // sentinel beyond real data
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at, created_at
		FROM daily_logs
		WHERE user_id = $1
		  AND (logged_at, id) < ($2, $3)
		ORDER BY logged_at DESC, id DESC
		LIMIT $4
	`, userID, before, beforeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]DailyLog, 0, limit)
	for rows.Next() {
		var l DailyLog
		if err := rows.Scan(
			&l.ID, &l.UserID, &l.Focus, &l.Energy, &l.Forgetfulness, &l.Stress,
			&l.SleepQuality, &l.LoggedAt, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func isUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	if errors.As(err, &pgErr) {
		return pgErr.SQLState() == "23505"
	}
	return false
}
