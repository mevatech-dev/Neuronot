package stats

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// DailyTrend returns one bucket per UTC day in the window. Days without any
// log get a nil value so the chart can render gaps. Metric is validated by
// the service before reaching here, so concatenating its column name is safe.
func (r *Repository) DailyTrend(ctx context.Context, userID uuid.UUID, metric Metric, windowStart, windowEnd time.Time) ([]Point, error) {
	q := fmt.Sprintf(`
		SELECT DISTINCT ON ((logged_at AT TIME ZONE 'UTC')::date)
			(logged_at AT TIME ZONE 'UTC')::date AS day,
			%s
		FROM daily_logs
		WHERE user_id = $1
		  AND deleted_at IS NULL
		  AND logged_at >= $2 AND logged_at < $3
		ORDER BY (logged_at AT TIME ZONE 'UTC')::date, logged_at DESC
	`, metric.Column())

	rows, err := r.pool.Query(ctx, q, userID, windowStart, windowEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byDay := map[string]int{}
	for rows.Next() {
		var day time.Time
		var v int
		if err := rows.Scan(&day, &v); err != nil {
			return nil, err
		}
		byDay[day.Format("2006-01-02")] = v
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]Point, 0)
	day := windowStart
	for day.Before(windowEnd) {
		key := day.Format("2006-01-02")
		p := Point{Date: day}
		if v, ok := byDay[key]; ok {
			vv := v
			p.Value = &vv
		}
		out = append(out, p)
		day = day.AddDate(0, 0, 1)
	}
	return out, nil
}
