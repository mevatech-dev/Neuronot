package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Service is a thin façade over *s3.Client + bucket name. It exists so
// callers in the dataexport and profile slices don't import the AWS SDK
// directly — they speak to PutJSON / PresignGet / PresignPut and stay
// portable if R2 is ever swapped for another S3-compatible backend
// (Backblaze B2, Wasabi). See ADR 0002 §Triggers for Revisit.
type Service struct {
	client    *s3.Client
	presign   *s3.PresignClient
	bucket    string
	defaultTL time.Duration
}

func NewService(client *s3.Client, bucket string) *Service {
	return &Service{
		client:    client,
		presign:   s3.NewPresignClient(client),
		bucket:    bucket,
		defaultTL: 15 * time.Minute,
	}
}

// PutJSON serializes v as JSON and writes it to key. Used by dataexport
// to materialize the user's data as an off-DB artifact.
func (s *Service) PutJSON(ctx context.Context, key string, v any) (int64, error) {
	if s == nil {
		return 0, ErrUnavailable
	}
	body, err := json.Marshal(v)
	if err != nil {
		return 0, fmt.Errorf("storage: marshal: %w", err)
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("application/json"),
	})
	if err != nil {
		return 0, fmt.Errorf("storage: put: %w", err)
	}
	return int64(len(body)), nil
}

// PresignGet returns a time-limited URL the caller (mobile) can fetch
// directly. TTL caps at defaultTL when ttl is zero.
func (s *Service) PresignGet(ctx context.Context, key string, ttl time.Duration) (PresignedURL, error) {
	if s == nil {
		return PresignedURL{}, ErrUnavailable
	}
	if ttl <= 0 {
		ttl = s.defaultTL
	}
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return PresignedURL{}, fmt.Errorf("storage: presign get: %w", err)
	}
	return PresignedURL{URL: req.URL, ExpiresAt: time.Now().UTC().Add(ttl)}, nil
}

// PresignPut returns a URL the mobile client can PUT bytes to (avatar
// upload). contentType pins the request so the bucket can enforce shape.
func (s *Service) PresignPut(ctx context.Context, key, contentType string, ttl time.Duration) (PresignedURL, error) {
	if s == nil {
		return PresignedURL{}, ErrUnavailable
	}
	if ttl <= 0 {
		ttl = s.defaultTL
	}
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return PresignedURL{}, fmt.Errorf("storage: presign put: %w", err)
	}
	return PresignedURL{URL: req.URL, ExpiresAt: time.Now().UTC().Add(ttl)}, nil
}
