package sync

import (
	"encoding/json"
	"time"

	"github.com/neuronot/api/internal/dailylog"
	"github.com/neuronot/api/internal/events"
	"github.com/neuronot/api/internal/insights"
	"github.com/neuronot/api/internal/profile"
)

type Op string

const (
	OpUpsert Op = "upsert"
	OpDelete Op = "delete"
)

type Table string

const (
	TableDailyLogs Table = "daily_logs"
	TableEvents    Table = "events"
	TableProfile   Table = "profile"
	TableInsights  Table = "insights" // pull-only; push of insights is rejected
)

func (t Table) IsValid() bool {
	switch t {
	case TableDailyLogs, TableEvents, TableProfile, TableInsights:
		return true
	}
	return false
}

type PullDelta struct {
	ServerTime time.Time
	DailyLogs  []dailylog.DailyLog
	Events     []events.Event
	Insights   []insights.Insight
	Profile    *profile.Profile
}

type PushOperation struct {
	Table     Table
	Op        Op
	ID        string
	Row       json.RawMessage
	UpdatedAt time.Time
}

type AcceptedOp struct {
	Table           Table
	ID              string
	ServerUpdatedAt time.Time
}

type ConflictOp struct {
	Table     Table
	ID        string
	Reason    string
	ServerRow json.RawMessage
}

type PushResult struct {
	Accepted  []AcceptedOp
	Conflicts []ConflictOp
}
