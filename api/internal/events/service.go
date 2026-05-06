package events

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	defaultLimit = 20
	maxLimit     = 100
	maxNoteLen   = 500
)

var (
	ErrInvalidType      = errors.New("invalid event type")
	ErrInvalidIntensity = errors.New("intensity must be 1-5")
	ErrNoteTooLong      = errors.New("note too long")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateRequest) (*Event, error) {
	t := EventType(req.Type)
	if !t.IsValid() {
		return nil, ErrInvalidType
	}
	if req.Intensity < 1 || req.Intensity > 5 {
		return nil, ErrInvalidIntensity
	}
	if req.Note != nil && len(*req.Note) > maxNoteLen {
		return nil, ErrNoteTooLong
	}

	occurredAt := time.Now().UTC()
	if req.OccurredAt != nil {
		occurredAt = req.OccurredAt.UTC()
	}

	return s.repo.Create(ctx, userID, Event{
		Type:       t,
		Intensity:  req.Intensity,
		Note:       req.Note,
		OccurredAt: occurredAt,
	})
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, beforeAt time.Time, beforeID uuid.UUID, limit int) ([]Event, error) {
	return s.repo.List(ctx, userID, beforeAt, beforeID, effectiveLimit(limit))
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateRequest) (*Event, error) {
	if req.Type != nil {
		if !EventType(*req.Type).IsValid() {
			return nil, ErrInvalidType
		}
	}
	if req.Intensity != nil && (*req.Intensity < 1 || *req.Intensity > 5) {
		return nil, ErrInvalidIntensity
	}
	if req.Note != nil && len(*req.Note) > maxNoteLen {
		return nil, ErrNoteTooLong
	}
	return s.repo.Update(ctx, userID, id, req)
}

// ListUpdatedSince is exposed for the sync slice — cross-feature pull aggregator.
func (s *Service) ListUpdatedSince(ctx context.Context, userID uuid.UUID, since time.Time, limit int) ([]Event, error) {
	return s.repo.ListUpdatedSince(ctx, userID, since, effectiveLimit(limit))
}

func ToResponse(e *Event) Response {
	return Response{
		ID:         e.ID.String(),
		Type:       string(e.Type),
		Intensity:  e.Intensity,
		Note:       e.Note,
		OccurredAt: e.OccurredAt,
		UpdatedAt:  e.UpdatedAt,
	}
}

func effectiveLimit(req int) int {
	if req <= 0 {
		return defaultLimit
	}
	if req > maxLimit {
		return maxLimit
	}
	return req
}
