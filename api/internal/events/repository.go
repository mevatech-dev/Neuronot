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

const eventColumns = `id, user_id, type, intensity, note, occurred_at,
	created_at, updated_at, deleted_at`

func scan(row pgx.Row, e *Event) error {
	return row.Scan(
		&e.ID, &e.UserID, &e.Type, &e.Intensity, &e.Note, &e.OccurredAt,
		&e.CreatedAt, &e.UpdatedAt, &e.DeletedAt,
	)
}

func (r *Repository) Create(ctx context.Context, userID uuid.UUID, e Event) (*Event, error) {
	e.UserID = userID
	err := scan(r.pool.QueryRow(ctx, `
		INSERT INTO events (user_id, type, intensity, note, occurred_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING `+eventColumns+`
	`,
		e.UserID, string(e.Type), e.Intensity, e.Note, e.OccurredAt,
	), &e)
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
		SELECT `+eventColumns+`
		FROM events
		WHERE user_id = $1
		  AND deleted_at IS NULL
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
		if err := scan(rows, &e); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Delete enforces object-level authorization in the WHERE clause itself —
// a stranger's id silently doesn't match, callers see ErrNotFound and
// the handler maps that to 404 (PRD §9: don't leak existence).
// Soft delete: sets deleted_at so sync pull can mirror the deletion.
func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE events SET deleted_at = now()
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// FindByID enforces ownership; missing or stranger's row returns ErrNotFound.
func (r *Repository) FindByID(ctx context.Context, userID, id uuid.UUID) (*Event, error) {
	var e Event
	err := scan(r.pool.QueryRow(ctx, `
		SELECT `+eventColumns+`
		FROM events WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
	`, id, userID), &e)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

// Update applies the partial change. Ownership in WHERE → ErrNotFound on miss.
func (r *Repository) Update(ctx context.Context, userID, id uuid.UUID, p UpdateRequest) (*Event, error) {
	var typeStr *string
	if p.Type != nil {
		typeStr = p.Type
	}
	var e Event
	err := scan(r.pool.QueryRow(ctx, `
		UPDATE events SET
			type        = COALESCE($3, type),
			intensity   = COALESCE($4, intensity),
			note        = COALESCE($5, note),
			occurred_at = COALESCE($6, occurred_at)
		WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
		RETURNING `+eventColumns+`
	`, id, userID, typeStr, p.Intensity, p.Note, p.OccurredAt), &e)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &e, nil
}

// ListUpdatedSince supports sync pull. Includes soft-deleted rows.
func (r *Repository) ListUpdatedSince(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]Event, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT `+eventColumns+`
		FROM events
		WHERE user_id = $1 AND updated_at > $2
		ORDER BY updated_at ASC
		LIMIT $3
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Event, 0, limit)
	for rows.Next() {
		var e Event
		if err := scan(rows, &e); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
