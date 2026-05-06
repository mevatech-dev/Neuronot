package insights

import (
	"time"

	"github.com/google/uuid"
)

type Insight struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	Title          string
	Content        string
	Language       string
	Crisis         bool
	SourceEventIDs []uuid.UUID
	GeneratedAt    time.Time
	ViewedAt       *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type Summary struct {
	DailyLogCount        int
	AverageFocus         float64
	AverageEnergy        float64
	AverageForgetfulness float64
	AverageStress        float64
	AverageSleepQuality  float64
	EventCounts          map[string]int
	EventNotes           []string
	SourceEventIDs       []uuid.UUID
}

type PromptPayload struct {
	Language   string  `json:"language"`
	WindowDays int     `json:"window_days"`
	Summary    Summary `json:"summary"`
}

type GeneratedInsight struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Crisis  bool   `json:"crisis"`
}
