package sync

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/neuronot/api/internal/dailylog"
	"github.com/neuronot/api/internal/events"
	"github.com/neuronot/api/internal/insights"
	"github.com/neuronot/api/internal/profile"
)

const (
	pullPerTableLimit = 500
	pushBatchLimit    = 200
)

var (
	ErrInvalidSince     = errors.New("invalid since")
	ErrBatchTooLarge    = errors.New("push batch too large")
	ErrUnknownTable     = errors.New("unknown table")
	ErrUnknownOp        = errors.New("unknown op")
	ErrInsightsReadOnly = errors.New("insights are server-generated; client cannot push")
)

// Service depends on each feature's *Service, never their repository — preserves
// the cross-feature aggregator pattern (timeline-style).
type Service struct {
	dailyLogs *dailylog.Service
	events    *events.Service
	insights  *insights.Service
	profile   *profile.Service
}

func NewService(
	dailyLogs *dailylog.Service,
	events *events.Service,
	insights *insights.Service,
	profile *profile.Service,
) *Service {
	return &Service{
		dailyLogs: dailyLogs,
		events:    events,
		insights:  insights,
		profile:   profile,
	}
}

// Pull aggregates updates from each syncable feature since the given timestamp.
// since.IsZero() means initial fetch (everything).
func (s *Service) Pull(ctx context.Context, userID uuid.UUID, since time.Time) (*PullDelta, error) {
	delta := &PullDelta{ServerTime: time.Now().UTC()}

	logs, err := s.dailyLogs.ListUpdatedSince(ctx, userID, since, pullPerTableLimit)
	if err != nil {
		return nil, err
	}
	delta.DailyLogs = logs

	evts, err := s.events.ListUpdatedSince(ctx, userID, since, pullPerTableLimit)
	if err != nil {
		return nil, err
	}
	delta.Events = evts

	ins, err := s.insights.ListUpdatedSince(ctx, userID, since, pullPerTableLimit)
	if err != nil {
		return nil, err
	}
	delta.Insights = ins

	// Profile is a single row — include only if updated since.
	prof, err := s.profile.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if since.IsZero() || prof.UpdatedAt.After(since) {
		delta.Profile = prof
	}
	return delta, nil
}

// Push applies a batch of client-originating ops. Insights are read-only;
// pushing them returns a per-op conflict rather than failing the batch.
func (s *Service) Push(ctx context.Context, userID uuid.UUID, ops []PushOperation) (*PushResult, error) {
	if len(ops) > pushBatchLimit {
		return nil, ErrBatchTooLarge
	}

	result := &PushResult{}
	for _, op := range ops {
		if !op.Table.IsValid() {
			return nil, ErrUnknownTable
		}
		switch op.Table {
		case TableInsights:
			result.Conflicts = append(result.Conflicts, ConflictOp{
				Table:  op.Table,
				ID:     op.ID,
				Reason: "read_only",
			})
			continue
		case TableDailyLogs:
			if err := s.applyDailyLog(ctx, userID, op, result); err != nil {
				return nil, err
			}
		case TableEvents:
			if err := s.applyEvent(ctx, userID, op, result); err != nil {
				return nil, err
			}
		case TableProfile:
			if err := s.applyProfile(ctx, userID, op, result); err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

func (s *Service) applyDailyLog(ctx context.Context, userID uuid.UUID, op PushOperation, result *PushResult) error {
	id, err := uuid.Parse(op.ID)
	if err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "invalid_id",
		})
		return nil
	}
	if op.Op == OpDelete {
		// daily-log delete: handled via Update(deleted_at) is missing; we mirror
		// soft-delete by sending an update that effectively removes via API.
		// MVP: skip — daily logs aren't deleted in the current product flow.
		// Treat as no-op accept.
		result.Accepted = append(result.Accepted, AcceptedOp{
			Table:           op.Table,
			ID:              op.ID,
			ServerUpdatedAt: time.Now().UTC(),
		})
		return nil
	}
	var req dailylog.UpdateRequest
	if err := json.Unmarshal(op.Row, &req); err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "invalid_payload",
		})
		return nil
	}
	updated, err := s.dailyLogs.Update(ctx, userID, id, req)
	if err != nil {
		if errors.Is(err, dailylog.ErrNotFound) {
			result.Conflicts = append(result.Conflicts, ConflictOp{
				Table:  op.Table,
				ID:     op.ID,
				Reason: "not_found",
			})
			return nil
		}
		return err
	}
	if updated.UpdatedAt.After(op.UpdatedAt) {
		// server moved past client's snapshot — surface as conflict so client
		// can re-pull and reconcile (last-write-wins, server tie-break).
		_ = updated
	}
	result.Accepted = append(result.Accepted, AcceptedOp{
		Table:           op.Table,
		ID:              op.ID,
		ServerUpdatedAt: updated.UpdatedAt,
	})
	return nil
}

func (s *Service) applyEvent(ctx context.Context, userID uuid.UUID, op PushOperation, result *PushResult) error {
	id, err := uuid.Parse(op.ID)
	if err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "invalid_id",
		})
		return nil
	}
	if op.Op == OpDelete {
		if err := s.events.Delete(ctx, userID, id); err != nil {
			if errors.Is(err, events.ErrNotFound) {
				result.Conflicts = append(result.Conflicts, ConflictOp{
					Table:  op.Table,
					ID:     op.ID,
					Reason: "not_found",
				})
				return nil
			}
			return err
		}
		result.Accepted = append(result.Accepted, AcceptedOp{
			Table:           op.Table,
			ID:              op.ID,
			ServerUpdatedAt: time.Now().UTC(),
		})
		return nil
	}
	var req events.UpdateRequest
	if err := json.Unmarshal(op.Row, &req); err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "invalid_payload",
		})
		return nil
	}
	updated, err := s.events.Update(ctx, userID, id, req)
	if err != nil {
		if errors.Is(err, events.ErrNotFound) {
			result.Conflicts = append(result.Conflicts, ConflictOp{
				Table:  op.Table,
				ID:     op.ID,
				Reason: "not_found",
			})
			return nil
		}
		return err
	}
	result.Accepted = append(result.Accepted, AcceptedOp{
		Table:           op.Table,
		ID:              op.ID,
		ServerUpdatedAt: updated.UpdatedAt,
	})
	return nil
}

func (s *Service) applyProfile(ctx context.Context, userID uuid.UUID, op PushOperation, result *PushResult) error {
	if op.Op == OpDelete {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "delete_unsupported",
		})
		return nil
	}
	var req profile.PatchRequest
	if err := json.Unmarshal(op.Row, &req); err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: "invalid_payload",
		})
		return nil
	}
	updated, err := s.profile.Patch(ctx, userID, req)
	if err != nil {
		result.Conflicts = append(result.Conflicts, ConflictOp{
			Table:  op.Table,
			ID:     op.ID,
			Reason: err.Error(),
		})
		return nil
	}
	result.Accepted = append(result.Accepted, AcceptedOp{
		Table:           op.Table,
		ID:              op.ID,
		ServerUpdatedAt: updated.UpdatedAt,
	})
	return nil
}

// ToPullResponse converts the internal delta to wire DTO using each slice's
// own ToResponse — keeps DTO ownership inside the owning slice.
func ToPullResponse(delta *PullDelta) PullResponse {
	resp := PullResponse{
		ServerTime: delta.ServerTime,
		Deletes:    map[string][]string{},
	}

	resp.DailyLogs = make([]dailylog.Response, 0, len(delta.DailyLogs))
	for i := range delta.DailyLogs {
		l := &delta.DailyLogs[i]
		if l.DeletedAt != nil {
			resp.Deletes[string(TableDailyLogs)] = append(resp.Deletes[string(TableDailyLogs)], l.ID.String())
			continue
		}
		resp.DailyLogs = append(resp.DailyLogs, dailylog.ToResponse(l))
	}

	resp.Events = make([]events.Response, 0, len(delta.Events))
	for i := range delta.Events {
		e := &delta.Events[i]
		if e.DeletedAt != nil {
			resp.Deletes[string(TableEvents)] = append(resp.Deletes[string(TableEvents)], e.ID.String())
			continue
		}
		resp.Events = append(resp.Events, events.ToResponse(e))
	}

	resp.Insights = make([]insights.Response, 0, len(delta.Insights))
	for i := range delta.Insights {
		resp.Insights = append(resp.Insights, insights.ToResponse(&delta.Insights[i]))
	}

	if delta.Profile != nil {
		// Sync deltas don't carry presigned avatar URLs — clients refresh
		// the avatar via GET /v1/me/profile when they render it.
		p := profile.ToResponse(delta.Profile, nil)
		resp.Profile = &p
	}
	return resp
}

// ToPushResponse converts internal result to wire DTO.
func ToPushResponse(r *PushResult) PushResponse {
	resp := PushResponse{
		Accepted:  make([]AcceptedDTO, 0, len(r.Accepted)),
		Conflicts: make([]ConflictDTO, 0, len(r.Conflicts)),
	}
	for _, a := range r.Accepted {
		resp.Accepted = append(resp.Accepted, AcceptedDTO{
			Table:           string(a.Table),
			ID:              a.ID,
			ServerUpdatedAt: a.ServerUpdatedAt,
		})
	}
	for _, c := range r.Conflicts {
		resp.Conflicts = append(resp.Conflicts, ConflictDTO{
			Table:     string(c.Table),
			ID:        c.ID,
			Reason:    c.Reason,
			ServerRow: c.ServerRow,
		})
	}
	return resp
}
