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

const dailyLogColumns = `id, user_id, focus, energy, forgetfulness, stress, sleep_quality,
	logged_at, created_at, updated_at, deleted_at`

func scan(row pgx.Row, l *DailyLog) error {
	return row.Scan(
		&l.ID, &l.UserID, &l.Focus, &l.Energy, &l.Forgetfulness, &l.Stress,
		&l.SleepQuality, &l.LoggedAt, &l.CreatedAt, &l.UpdatedAt, &l.DeletedAt,
	)
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, in DailyLog) (*DailyLog, error) {
	in.UserID = userID
	err := scan(r.pool.QueryRow(ctx, `
		INSERT INTO daily_logs (user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+dailyLogColumns+`
	`,
		in.UserID, in.Focus, in.Energy, in.Forgetfulness, in.Stress, in.SleepQuality, in.LoggedAt,
	), &in)
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
	err := scan(r.pool.QueryRow(ctx, `
		SELECT `+dailyLogColumns+`
		FROM daily_logs
		WHERE user_id = $1
		  AND deleted_at IS NULL
		  AND (logged_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
		LIMIT 1
	`, userID), &l)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &l, nil
}

// FindByID enforces ownership in the WHERE clause; missing or other-user's
// row returns ErrNotFound (PRD §9 — never leak existence).
func (r *Repository) FindByID(ctx context.Context, userID, id uuid.UUID) (*DailyLog, error) {
	var l DailyLog
	err := scan(r.pool.QueryRow(ctx, `
		SELECT `+dailyLogColumns+`
		FROM daily_logs
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID), &l)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
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
		SELECT `+dailyLogColumns+`
		FROM daily_logs
		WHERE user_id = $1
		  AND deleted_at IS NULL
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
		if err := scan(rows, &l); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// Update applies the partial change. Ownership is enforced inside the
// WHERE clause so a stranger's id silently no-ops → ErrNotFound.
func (r *Repository) Update(ctx context.Context, userID, id uuid.UUID, p UpdateRequest) (*DailyLog, error) {
	var l DailyLog
	err := scan(r.pool.QueryRow(ctx, `
		UPDATE daily_logs SET
			focus         = COALESCE($3, focus),
			energy        = COALESCE($4, energy),
			forgetfulness = COALESCE($5, forgetfulness),
			stress        = COALESCE($6, stress),
			sleep_quality = COALESCE($7, sleep_quality)
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		RETURNING `+dailyLogColumns+`
	`, id, userID, p.Focus, p.Energy, p.Forgetfulness, p.Stress, p.SleepQuality), &l)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &l, nil
}

// ListUpdatedSince returns rows updated after `since` for sync pull.
// Includes soft-deleted rows so the client can mirror deletion locally.
func (r *Repository) ListUpdatedSince(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]DailyLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+dailyLogColumns+`
		FROM daily_logs
		WHERE user_id = $1 AND updated_at > $2
		ORDER BY updated_at ASC
		LIMIT $3
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]DailyLog, 0, limit)
	for rows.Next() {
		var l DailyLog
		if err := scan(rows, &l); err != nil {
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
