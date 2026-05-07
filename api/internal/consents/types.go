// api/internal/consents/types.go
package consents

import (
	"time"

	"github.com/google/uuid"
)

type ConsentType string

const (
	ConsentTypeAIUsage         ConsentType = "ai_usage"
	ConsentTypeTermsOfService  ConsentType = "terms_of_service"
	ConsentTypePrivacyPolicy   ConsentType = "privacy_policy"
)

type Source string

const (
	SourceRegister  Source = "register"
	SourceSettings  Source = "settings"
	SourceReconsent Source = "reconsent"
)

// CurrentVersions is the canonical version string per consent type.
// Bump when the policy text or AI contract changes; users with a stale
// version trigger a re-consent flow on the client.
var CurrentVersions = map[ConsentType]string{
	ConsentTypeAIUsage:        "v1",
	ConsentTypeTermsOfService: "2026-05",
	ConsentTypePrivacyPolicy:  "2026-05",
}

// AllTypes is the canonical iteration order used by registration and the
// settings list — keep AI last so consent UIs render legal docs first.
var AllTypes = []ConsentType{
	ConsentTypeTermsOfService,
	ConsentTypePrivacyPolicy,
	ConsentTypeAIUsage,
}

func (t ConsentType) Valid() bool {
	_, ok := CurrentVersions[t]
	return ok
}

type Consent struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Type       ConsentType
	Granted    bool
	Version    string
	Source     Source
	UserAgent  string
	OccurredAt time.Time
}

// RecordContext captures the request-scoped audit fields for a consent
// transition. IP and DeviceID are plaintext here; the repository encrypts
// them on insert.
type RecordContext struct {
	IP        string
	DeviceID  string
	UserAgent string
	Source    Source
}
