package events

import "time"

type CreateRequest struct {
	Type       string     `json:"type"`
	Intensity  int        `json:"intensity"`
	Note       *string    `json:"note,omitempty"`
	OccurredAt *time.Time `json:"occurred_at,omitempty"`
}

type Response struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	Intensity  int       `json:"intensity"`
	Note       *string   `json:"note"`
	OccurredAt time.Time `json:"occurred_at"`
}

type ListResponse struct {
	Items      []Response `json:"items"`
	NextCursor string     `json:"next_cursor,omitempty"`
}
