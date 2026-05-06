package insights

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

const insightColumns = `id, user_id, title, content, language, source_event_ids,
	generated_at, viewed_at, created_at, updated_at`

func scan(row pgx.Row, in *Insight) error {
	return row.Scan(
		&in.ID, &in.UserID, &in.Title, &in.Content, &in.Language, &in.SourceEventIDs,
		&in.GeneratedAt, &in.ViewedAt, &in.CreatedAt, &in.UpdatedAt,
	)
}

func (r *Repository) HasGeneratedToday(ctx context.Context, userID uuid.UUID, now time.Time) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM insights
			WHERE user_id = $1
			  AND (generated_at AT TIME ZONE 'UTC')::date = ($2 AT TIME ZONE 'UTC')::date
		)
	`, userID, now).Scan(&exists)
	return exists, err
}

func (r *Repository) SummarySince(ctx context.Context, userID uuid.UUID, since time.Time) (Summary, error) {
	summary := Summary{EventCounts: map[string]int{}}

	err := r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COALESCE(AVG(focus), 0),
			COALESCE(AVG(energy), 0),
			COALESCE(AVG(forgetfulness), 0),
			COALESCE(AVG(stress), 0),
			COALESCE(AVG(sleep_quality), 0)
		FROM daily_logs
		WHERE user_id = $1 AND logged_at >= $2 AND deleted_at IS NULL
	`, userID, since).Scan(
		&summary.DailyLogCount,
		&summary.AverageFocus,
		&summary.AverageEnergy,
		&summary.AverageForgetfulness,
		&summary.AverageStress,
		&summary.AverageSleepQuality,
	)
	if err != nil {
		return Summary{}, err
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, type, note
		FROM events
		WHERE user_id = $1 AND occurred_at >= $2 AND deleted_at IS NULL
		ORDER BY occurred_at DESC
	`, userID, since)
	if err != nil {
		return Summary{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var eventType string
		var note *string
		if err := rows.Scan(&id, &eventType, &note); err != nil {
			return Summary{}, err
		}
		summary.SourceEventIDs = append(summary.SourceEventIDs, id)
		summary.EventCounts[eventType]++
		if note != nil {
			summary.EventNotes = append(summary.EventNotes, *note)
		}
	}
	return summary, rows.Err()
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, in Insight) (*Insight, error) {
	in.UserID = userID
	err := scan(r.pool.QueryRow(ctx, `
		INSERT INTO insights (user_id, title, content, language, source_event_ids, generated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+insightColumns+`
	`, userID, in.Title, in.Content, in.Language, in.SourceEventIDs, in.GeneratedAt), &in)
	if err != nil {
		return nil, err
	}
	return &in, nil
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID, limit int) ([]Insight, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+insightColumns+`
		FROM insights
		WHERE user_id = $1
		ORDER BY generated_at DESC, id DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Insight, 0, limit)
	for rows.Next() {
		var in Insight
		if err := scan(rows, &in); err != nil {
			return nil, err
		}
		out = append(out, in)
	}
	return out, rows.Err()
}

// ListUpdatedSince powers sync pull. Insights are immutable history server-side,
// so updated_at == created_at in practice; the column exists to keep the sync
// contract uniform across syncable tables.
func (r *Repository) ListUpdatedSince(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]Insight, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+insightColumns+`
		FROM insights
		WHERE user_id = $1 AND updated_at > $2
		ORDER BY updated_at ASC
		LIMIT $3
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Insight, 0, limit)
	for rows.Next() {
		var in Insight
		if err := scan(rows, &in); err != nil {
			return nil, err
		}
		out = append(out, in)
	}
	return out, rows.Err()
}
