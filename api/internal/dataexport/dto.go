// api/internal/dataexport/dto.go
package dataexport

import "time"

// ExportResponse is what /v1/me/export returns to mobile. When R2 is
// configured (the production path), DownloadURL + ExpiresAt are filled
// and Payload is nil. When R2 is absent (dev / boot without creds),
// Payload carries the data inline so the endpoint still works. Mobile
// branches on DownloadURL presence.
type ExportResponse struct {
	DownloadURL string         `json:"download_url,omitempty"`
	ExpiresAt   *time.Time     `json:"expires_at,omitempty"`
	SizeBytes   int64          `json:"size_bytes,omitempty"`
	Payload     *ExportPayload `json:"payload,omitempty"`
}
