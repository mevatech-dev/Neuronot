// api/internal/consents/dto.go
package consents

import "time"

type ConsentResponse struct {
	Type           ConsentType `json:"type"`
	Granted        bool        `json:"granted"`
	Version        string      `json:"version"`
	CurrentVersion string      `json:"current_version"`
	Source         Source      `json:"source"`
	OccurredAt     time.Time   `json:"occurred_at"`
}

type GrantRequest struct {
	Type    ConsentType `json:"type"`
	Granted bool        `json:"granted"`
	Version string      `json:"version"`
}
