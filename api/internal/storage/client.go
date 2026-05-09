package storage

import (
	"context"
	"errors"
	"fmt"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Config carries the four R2 environment values. Empty fields disable the
// service; the constructor returns ErrDisabled and callers must treat any
// dependent feature as unavailable (mirrors the OpenAI gating pattern in
// internal/insights/openai.go).
type Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
}

// ErrDisabled is returned by NewClient when the R2 config is incomplete.
// Caller (cmd/api/main.go) decides whether to fail the boot or to mount
// the feature with a nil service that returns ErrUnavailable on calls.
var ErrDisabled = errors.New("storage: R2 not configured")

// ErrUnavailable is what storage-dependent endpoints surface when the
// service is nil at runtime.
var ErrUnavailable = errors.New("storage: service unavailable")

// NewClient builds an S3 client pointing at the R2 endpoint for the
// configured account. region "auto" is the value Cloudflare expects.
// Path-style addressing avoids virtual-host SSL issues that occur with
// dot-containing bucket names.
func NewClient(ctx context.Context, cfg Config) (*s3.Client, error) {
	if cfg.AccountID == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" || cfg.Bucket == "" {
		return nil, ErrDisabled
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion("auto"),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: load aws config: %w", err)
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)
	return s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = &endpoint
		o.UsePathStyle = true
	}), nil
}
