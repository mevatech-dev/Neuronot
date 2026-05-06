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

type Response struct {
	ID            string    `json:"id"`
	Focus         int       `json:"focus"`
	Energy        int       `json:"energy"`
	Forgetfulness int       `json:"forgetfulness"`
	Stress        int       `json:"stress"`
	SleepQuality  int       `json:"sleep_quality"`
	LoggedAt      time.Time `json:"logged_at"`
}

type ListResponse struct {
	Items      []Response `json:"items"`
	NextCursor string     `json:"next_cursor,omitempty"`
}
