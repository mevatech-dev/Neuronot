package stats

type PointResponse struct {
	Date  string `json:"date"`
	Value *int   `json:"value"`
}

type TrendResponse struct {
	Metric string          `json:"metric"`
	Days   int             `json:"days"`
	Points []PointResponse `json:"points"`
}

func ToResponse(t *Trend) TrendResponse {
	points := make([]PointResponse, len(t.Points))
	for i, p := range t.Points {
		points[i] = PointResponse{
			Date:  p.Date.Format("2006-01-02"),
			Value: p.Value,
		}
	}
	return TrendResponse{
		Metric: string(t.Metric),
		Days:   t.Days,
		Points: points,
	}
}
