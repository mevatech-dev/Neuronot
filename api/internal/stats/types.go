package stats

import "time"

type Metric string

const (
	MetricFocus         Metric = "focus"
	MetricEnergy        Metric = "energy"
	MetricStress        Metric = "stress"
	MetricForgetfulness Metric = "forgetfulness"
	MetricSleepQuality  Metric = "sleep_quality"
)

func (m Metric) IsValid() bool {
	switch m {
	case MetricFocus, MetricEnergy, MetricStress, MetricForgetfulness, MetricSleepQuality:
		return true
	}
	return false
}

func (m Metric) Column() string {
	return string(m)
}

type Point struct {
	Date  time.Time
	Value *int
}

type Trend struct {
	Metric Metric
	Days   int
	Points []Point
}
