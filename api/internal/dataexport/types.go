// api/internal/dataexport/types.go
package dataexport

import "time"

// ExportPayload is the canonical shape returned by GET /v1/me/export.
// Mobile saves it verbatim. Each child uses snake_case to match the
// existing API conventions.
type ExportPayload struct {
	GeneratedAt time.Time        `json:"generated_at"`
	Profile     map[string]any   `json:"profile"`
	DailyLogs   []map[string]any `json:"daily_logs"`
	Events      []map[string]any `json:"events"`
	Insights    []map[string]any `json:"insights"`
}
