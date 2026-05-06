package insights

import (
	"time"

	"github.com/google/uuid"
)

type GenerateRequest struct {
	Language string `json:"language"`
}

type Response struct {
	ID          string     `json:"id,omitempty"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Language    string     `json:"language"`
	Crisis      bool       `json:"crisis"`
	GeneratedAt *time.Time `json:"generated_at,omitempty"`
	ViewedAt    *time.Time `json:"viewed_at,omitempty"`
}

type ListResponse struct {
	Items []Response `json:"items"`
}

func ToResponse(in *Insight) Response {
	resp := Response{
		Title:    in.Title,
		Content:  in.Content,
		Language: in.Language,
		Crisis:   in.Crisis,
		ViewedAt: in.ViewedAt,
	}
	if in.ID != uuid.Nil {
		resp.ID = in.ID.String()
	}
	if !in.GeneratedAt.IsZero() {
		resp.GeneratedAt = &in.GeneratedAt
	}
	return resp
}
