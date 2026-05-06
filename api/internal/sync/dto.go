package sync

import (
	"encoding/json"
	"time"

	"github.com/neuronot/api/internal/dailylog"
	"github.com/neuronot/api/internal/events"
	"github.com/neuronot/api/internal/insights"
	"github.com/neuronot/api/internal/profile"
)

// Pull

type PullResponse struct {
	ServerTime time.Time                  `json:"server_time"`
	DailyLogs  []dailylog.Response        `json:"daily_logs"`
	Events     []events.Response          `json:"events"`
	Insights   []insights.Response        `json:"insights"`
	Profile    *profile.ProfileResponse   `json:"profile"`
	Deletes    map[string][]string        `json:"deletes"` // table → ids
}

// Push

type PushOperationDTO struct {
	Table     string          `json:"table"`
	Op        string          `json:"op"`
	ID        string          `json:"id"`
	Row       json.RawMessage `json:"row,omitempty"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type PushRequest struct {
	Operations []PushOperationDTO `json:"operations"`
}

type AcceptedDTO struct {
	Table           string    `json:"table"`
	ID              string    `json:"id"`
	ServerUpdatedAt time.Time `json:"server_updated_at"`
}

type ConflictDTO struct {
	Table     string          `json:"table"`
	ID        string          `json:"id"`
	Reason    string          `json:"reason"`
	ServerRow json.RawMessage `json:"server_row,omitempty"`
}

type PushResponse struct {
	Accepted  []AcceptedDTO `json:"accepted"`
	Conflicts []ConflictDTO `json:"conflicts"`
}
