// api/internal/dataexport/repository.go
package dataexport

import (
	"context"

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

// rowsAsMaps walks pgx.Rows and serializes each row into a map keyed by the
// column name. Used so the export payload mirrors the on-disk shape of each
// table without needing a typed struct per table.
func rowsAsMaps(rows pgx.Rows) ([]map[string]any, error) {
	fields := rows.FieldDescriptions()
	cols := make([]string, len(fields))
	for i, f := range fields {
		cols[i] = string(f.Name)
	}
	out := make([]map[string]any, 0)
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			row[c] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) FetchProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM profiles WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	all, err := rowsAsMaps(rows)
	if err != nil || len(all) == 0 {
		return nil, err
	}
	return all[0], nil
}

func (r *Repository) FetchDailyLogs(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM daily_logs WHERE user_id = $1 ORDER BY logged_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}

func (r *Repository) FetchEvents(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM events WHERE user_id = $1 ORDER BY occurred_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}

func (r *Repository) FetchInsights(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM insights WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}
