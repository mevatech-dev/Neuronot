package summary

import "time"

type DayBucketResponse struct {
	Date         string `json:"date"`
	Focus        *int   `json:"focus"`
	Energy       *int   `json:"energy"`
	SleepQuality *int   `json:"sleep_quality"`
}

type WeeklyResponse struct {
	FocusAvg         float64             `json:"focus_avg"`
	EnergyAvg        float64             `json:"energy_avg"`
	StressAvg        float64             `json:"stress_avg"`
	ForgetfulnessAvg float64             `json:"forgetfulness_avg"`
	SleepAvg         float64             `json:"sleep_avg"`
	LogCount         int                 `json:"log_count"`
	DayBuckets       []DayBucketResponse `json:"day_buckets"`
	EventCounts      map[string]int      `json:"event_counts"`
	WindowStart      time.Time           `json:"window_start"`
	WindowEnd        time.Time           `json:"window_end"`
}

func ToResponse(w *Weekly) WeeklyResponse {
	buckets := make([]DayBucketResponse, len(w.DayBuckets))
	for i, b := range w.DayBuckets {
		buckets[i] = DayBucketResponse{
			Date:         b.Date.Format("2006-01-02"),
			Focus:        b.Focus,
			Energy:       b.Energy,
			SleepQuality: b.SleepQuality,
		}
	}
	counts := w.EventCounts
	if counts == nil {
		counts = map[string]int{}
	}
	return WeeklyResponse{
		FocusAvg:         w.FocusAvg,
		EnergyAvg:        w.EnergyAvg,
		StressAvg:        w.StressAvg,
		ForgetfulnessAvg: w.ForgetfulnessAvg,
		SleepAvg:         w.SleepAvg,
		LogCount:         w.LogCount,
		DayBuckets:       buckets,
		EventCounts:      counts,
		WindowStart:      w.WindowStart,
		WindowEnd:        w.WindowEnd,
	}
}
