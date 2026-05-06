package summary

import (
	"context"
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

// Aggregate returns a 7-day summary including overall averages, per-day
// buckets (one row per day in the window even if there's no log), and an
// event-type frequency map. All in two queries — no Go-side aggregation.
func (r *Repository) Aggregate(ctx context.Context, userID uuid.UUID, windowStart, windowEnd time.Time) (*Weekly, error) {
	w := &Weekly{
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		EventCounts: map[string]int{},
	}

	// 1) Overall averages and count
	err := r.pool.QueryRow(ctx, `
		SELECT
			COUNT(*),
			COALESCE(AVG(focus), 0),
			COALESCE(AVG(energy), 0),
			COALESCE(AVG(stress), 0),
			COALESCE(AVG(forgetfulness), 0),
			COALESCE(AVG(sleep_quality), 0)
		FROM daily_logs
		WHERE user_id = $1
		  AND deleted_at IS NULL
		  AND logged_at >= $2 AND logged_at < $3
	`, userID, windowStart, windowEnd).Scan(
		&w.LogCount, &w.FocusAvg, &w.EnergyAvg,
		&w.StressAvg, &w.ForgetfulnessAvg, &w.SleepAvg,
	)
	if err != nil {
		return nil, err
	}

	// 2) Per-day buckets (most recent log per UTC day)
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ON ((logged_at AT TIME ZONE 'UTC')::date)
			(logged_at AT TIME ZONE 'UTC')::date AS day,
			focus, energy, sleep_quality
		FROM daily_logs
		WHERE user_id = $1
		  AND deleted_at IS NULL
		  AND logged_at >= $2 AND logged_at < $3
		ORDER BY (logged_at AT TIME ZONE 'UTC')::date, logged_at DESC
	`, userID, windowStart, windowEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bucketByDate := map[string]DayBucket{}
	for rows.Next() {
		var b DayBucket
		var focus, energy, sleep int
		if err := rows.Scan(&b.Date, &focus, &energy, &sleep); err != nil {
			return nil, err
		}
		b.Focus = &focus
		b.Energy = &energy
		b.SleepQuality = &sleep
		bucketByDate[b.Date.Format("2006-01-02")] = b
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Fill missing days with nils so the 7-bar chart always renders 7 slots.
	w.DayBuckets = make([]DayBucket, 0, 7)
	day := windowStart
	for day.Before(windowEnd) {
		key := day.Format("2006-01-02")
		if b, ok := bucketByDate[key]; ok {
			w.DayBuckets = append(w.DayBuckets, b)
		} else {
			w.DayBuckets = append(w.DayBuckets, DayBucket{Date: day})
		}
		day = day.AddDate(0, 0, 1)
	}

	// 3) Event counts by type
	eventRows, err := r.pool.Query(ctx, `
		SELECT type, COUNT(*)
		FROM events
		WHERE user_id = $1
		  AND deleted_at IS NULL
		  AND occurred_at >= $2 AND occurred_at < $3
		GROUP BY type
	`, userID, windowStart, windowEnd)
	if err != nil {
		return nil, err
	}
	defer eventRows.Close()

	for eventRows.Next() {
		var t string
		var c int
		if err := eventRows.Scan(&t, &c); err != nil {
			return nil, err
		}
		w.EventCounts[t] = c
	}
	return w, eventRows.Err()
}
