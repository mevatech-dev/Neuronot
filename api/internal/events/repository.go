package events

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("event not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, e Event) (*Event, error) {
	e.UserID = userID
	err := r.pool.QueryRow(ctx, `
		INSERT INTO events (user_id, type, intensity, note, occurred_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, type, intensity, note, occurred_at, created_at
	`,
		e.UserID, string(e.Type), e.Intensity, e.Note, e.OccurredAt,
	).Scan(
		&e.ID, &e.UserID, &e.Type, &e.Intensity, &e.Note, &e.OccurredAt, &e.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID, before time.Time, beforeID uuid.UUID, limit int) ([]Event, error) {
	if before.IsZero() {
		before = time.Now().Add(time.Hour)
	}
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, type, intensity, note, occurred_at, created_at
		FROM events
		WHERE user_id = $1
		  AND (occurred_at, id) < ($2, $3)
		ORDER BY occurred_at DESC, id DESC
		LIMIT $4
	`, userID, before, beforeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Event, 0, limit)
	for rows.Next() {
		var e Event
		if err := rows.Scan(
			&e.ID, &e.UserID, &e.Type, &e.Intensity, &e.Note, &e.OccurredAt, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Delete enforces object-level authorization in the WHERE clause itself —
// a stranger's id silently doesn't match, callers see ErrNotFound and
// the handler maps that to 404 (PRD §9: don't leak existence).
func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM events WHERE id = $1 AND user_id = $2
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// FindByID is reserved for future detail endpoints; same auth pattern.
func (r *Repository) FindByID(ctx context.Context, userID, id uuid.UUID) (*Event, error) {
	var e Event
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, type, intensity, note, occurred_at, created_at
		FROM events WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&e.ID, &e.UserID, &e.Type, &e.Intensity, &e.Note, &e.OccurredAt, &e.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}
