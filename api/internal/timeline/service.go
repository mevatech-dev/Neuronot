package timeline

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"github.com/neuronot/api/internal/dailylog"
	"github.com/neuronot/api/internal/events"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

// Service stitches daily_logs and events into one descending feed.
// We over-fetch each side by limit, merge in code, then trim — this keeps
// repository SQL simple (no UNION) and the pattern obvious.
type Service struct {
	logs   *dailylog.Service
	events *events.Service
}

func NewService(logs *dailylog.Service, evts *events.Service) *Service {
	return &Service{logs: logs, events: evts}
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, beforeAt time.Time, beforeID uuid.UUID, limit int) ([]Item, bool, error) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	logs, err := s.logs.List(ctx, userID, beforeAt, beforeID, limit)
	if err != nil {
		return nil, false, err
	}
	evts, err := s.events.List(ctx, userID, beforeAt, beforeID, limit)
	if err != nil {
		return nil, false, err
	}

	merged := make([]Item, 0, len(logs)+len(evts))
	for _, l := range logs {
		merged = append(merged, Item{
			Kind: KindDailyLog,
			At:   l.LoggedAt,
			ID:   l.ID.String(),
			DailyLog: &DailyLogPayload{
				Focus:         l.Focus,
				Energy:        l.Energy,
				Forgetfulness: l.Forgetfulness,
				Stress:        l.Stress,
				SleepQuality:  l.SleepQuality,
			},
		})
	}
	for _, e := range evts {
		merged = append(merged, Item{
			Kind: KindEvent,
			At:   e.OccurredAt,
			ID:   e.ID.String(),
			Event: &EventPayload{
				Type:      string(e.Type),
				Intensity: e.Intensity,
				Note:      e.Note,
			},
		})
	}

	sort.Slice(merged, func(i, j int) bool {
		if !merged[i].At.Equal(merged[j].At) {
			return merged[i].At.After(merged[j].At)
		}
		return merged[i].ID > merged[j].ID
	})

	hasMore := len(merged) > limit
	if hasMore {
		merged = merged[:limit]
	}
	return merged, hasMore, nil
}
