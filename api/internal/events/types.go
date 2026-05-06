package events

import (
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	TypeHeadache       EventType = "headache"
	TypeBrainFog       EventType = "brain_fog"
	TypeForgetfulness  EventType = "forgetfulness"
	TypeDistraction    EventType = "distraction"
	TypeMentalFatigue  EventType = "mental_fatigue"
)

func (t EventType) IsValid() bool {
	switch t {
	case TypeHeadache, TypeBrainFog, TypeForgetfulness, TypeDistraction, TypeMentalFatigue:
		return true
	}
	return false
}

type Event struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Type       EventType
	Intensity  int
	Note       *string
	OccurredAt time.Time
	CreatedAt  time.Time
	UpdatedAt  time.Time
	DeletedAt  *time.Time
}
