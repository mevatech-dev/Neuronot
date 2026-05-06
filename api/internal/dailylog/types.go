package dailylog

import (
	"time"

	"github.com/google/uuid"
)

type DailyLog struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	Focus         int
	Energy        int
	Forgetfulness int
	Stress        int
	SleepQuality  int
	LoggedAt      time.Time
	CreatedAt     time.Time
}
