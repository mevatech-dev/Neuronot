package dailylog

import "time"

type CreateRequest struct {
	Focus         int        `json:"focus"`
	Energy        int        `json:"energy"`
	Forgetfulness int        `json:"forgetfulness"`
	Stress        int        `json:"stress"`
	SleepQuality  int        `json:"sleep_quality"`
	LoggedAt      *time.Time `json:"logged_at,omitempty"`
}

// UpdateRequest uses pointers — only provided fields are written. logged_at
// is intentionally NOT updatable (the day a log belongs to is immutable; a
// user who picked the wrong day deletes and recreates).
type UpdateRequest struct {
	Focus         *int `json:"focus,omitempty"`
	Energy        *int `json:"energy,omitempty"`
	Forgetfulness *int `json:"forgetfulness,omitempty"`
	Stress        *int `json:"stress,omitempty"`
	SleepQuality  *int `json:"sleep_quality,omitempty"`
}

type Response struct {
	ID            string    `json:"id"`
	Focus         int       `json:"focus"`
	Energy        int       `json:"energy"`
	Forgetfulness int       `json:"forgetfulness"`
	Stress        int       `json:"stress"`
	SleepQuality  int       `json:"sleep_quality"`
	LoggedAt      time.Time `json:"logged_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ListResponse struct {
	Items      []Response `json:"items"`
	NextCursor string     `json:"next_cursor,omitempty"`
}
