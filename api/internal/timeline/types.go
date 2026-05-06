package timeline

import "time"

type ItemKind string

const (
	KindDailyLog ItemKind = "daily_log"
	KindEvent    ItemKind = "event"
)

// Item is the union row clients render in the timeline.
// Kind drives which optional payload (DailyLog | Event) is populated.
type Item struct {
	Kind     ItemKind  `json:"kind"`
	At       time.Time `json:"at"`
	ID       string    `json:"id"`
	DailyLog *DailyLogPayload `json:"daily_log,omitempty"`
	Event    *EventPayload    `json:"event,omitempty"`
}

type DailyLogPayload struct {
	Focus         int `json:"focus"`
	Energy        int `json:"energy"`
	Forgetfulness int `json:"forgetfulness"`
	Stress        int `json:"stress"`
	SleepQuality  int `json:"sleep_quality"`
}

type EventPayload struct {
	Type      string  `json:"type"`
	Intensity int     `json:"intensity"`
	Note      *string `json:"note,omitempty"`
}

type Response struct {
	Items      []Item `json:"items"`
	NextCursor string `json:"next_cursor,omitempty"`
}
