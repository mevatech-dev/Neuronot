package summary

import "time"

type DayBucket struct {
	Date         time.Time
	Focus        *int
	Energy       *int
	SleepQuality *int
}

type Weekly struct {
	FocusAvg         float64
	EnergyAvg        float64
	StressAvg        float64
	ForgetfulnessAvg float64
	SleepAvg         float64
	LogCount         int
	DayBuckets       []DayBucket
	EventCounts      map[string]int
	WindowStart      time.Time
	WindowEnd        time.Time
}
