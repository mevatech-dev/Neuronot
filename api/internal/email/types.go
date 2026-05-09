// Package email wraps Resend for transactional outbound mail. Per ADR
// 0002 it is gated by RESEND_API_KEY + EMAIL_FROM env; today the active
// triggers are account-deletion confirmation and "your export is ready"
// notice. See internal/email/templates/ for the per-locale bodies.
package email

import "errors"

// Template is the canonical name of a per-feature email; the matching
// HTML/TXT files live in templates/ as <name>.<locale>.{html,txt}.
type Template string

const (
	TemplateAccountDeleted Template = "account_deleted"
	TemplateExportReady    Template = "export_ready"
)

// SendInput is what a caller (account/dataexport service) hands to
// Service.Send. Vars are template-specific; each template's required
// keys are listed in templates/<name>.go.
type SendInput struct {
	To       string
	Locale   string // ISO 639-1; falls back to "en"
	Template Template
	Vars     map[string]any
}

// ErrDisabled is returned by NewClient when Resend env is incomplete.
var ErrDisabled = errors.New("email: resend not configured")

// ErrUnavailable is the runtime equivalent: caller has a nil service.
var ErrUnavailable = errors.New("email: service unavailable")
