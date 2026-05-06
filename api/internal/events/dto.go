package events

import "time"

type CreateRequest struct {
	Type       string     `json:"type"`
	Intensity  int        `json:"intensity"`
	Note       *string    `json:"note,omitempty"`
	OccurredAt *time.Time `json:"occurred_at,omitempty"`
}

// UpdateRequest uses pointers — only provided fields are written.
type UpdateRequest struct {
	Type       *string    `json:"type,omitempty"`
	Intensity  *int       `json:"intensity,omitempty"`
	Note       *string    `json:"note,omitempty"`
	OccurredAt *time.Time `json:"occurred_at,omitempty"`
}

type Response struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	Intensity  int       `json:"intensity"`
	Note       *string   `json:"note"`
	OccurredAt time.Time `json:"occurred_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ListResponse struct {
	Items      []Response `json:"items"`
	NextCursor string     `json:"next_cursor,omitempty"`
}
