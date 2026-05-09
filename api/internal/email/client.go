package email

import (
	"github.com/resend/resend-go/v2"
)

// Config carries Resend credentials + the From line used for all
// transactional sends. From should already be in "Display <addr>" form.
type Config struct {
	APIKey string
	From   string
}

// NewClient returns a Resend client when fully configured, or
// ErrDisabled when any field is missing. main.go decides whether the
// missing config is fatal; for v1 it isn't — features gracefully skip.
func NewClient(cfg Config) (*resend.Client, error) {
	if cfg.APIKey == "" || cfg.From == "" {
		return nil, ErrDisabled
	}
	return resend.NewClient(cfg.APIKey), nil
}
