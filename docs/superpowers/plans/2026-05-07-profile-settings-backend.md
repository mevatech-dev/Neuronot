# Profile/Settings Backend Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the server side of the Profile/Settings overhaul: an immutable
audit-grade `consents` table with AES-GCM encrypted IP/device id, the AI
consent gate on insight generation, the registration flow that requires AI
consent, and three new vertical slices (`consents`, `account`, `dataexport`)
for managing those consents, password changes, account deletion and data
export.

**Architecture:** Each new feature is its own `internal/<feature>/` vertical
slice with the standard 5 files (handler/service/repository/dto/types) — same
shape as `auth` and `insights`. Encryption is a shared helper at
`internal/crypto/aesgcm/`. Auth's `Register` becomes transactional, threading
a `pgx.Tx` through `auth` and `consents` repositories so the user, profile
seed, and 3 consent rows commit together. Insights gets a one-line consent
check at the top of `Generate`.

**Tech Stack:** Go 1.22, chi, pgx/v5, goose migrations, golang.org/x/crypto/bcrypt,
crypto/aes, crypto/cipher.

**Spec:** [docs/superpowers/specs/2026-05-07-profile-settings-design.md](../specs/2026-05-07-profile-settings-design.md)

**Plan 2 (Mobile)** will be written after this plan completes.

---

## File Structure

### New files

```
api/internal/crypto/aesgcm/
├─ aesgcm.go            Encrypt(key, plaintext) []byte; Decrypt(key, ct) []byte
└─ aesgcm_test.go       round-trip + tamper test

api/internal/consents/
├─ dto.go               request/response shapes
├─ types.go             Consent struct, ConsentType const, currentVersions
├─ repository.go        Record, GetLatestPerType (encrypts IP/device on write)
├─ service.go           IsGranted, Grant, Revoke, GetAll
└─ handler.go           GET/POST/DELETE /v1/me/consents

api/internal/account/
├─ dto.go
├─ types.go
├─ repository.go        UpdatePassword, DeleteUser
├─ service.go           ChangePassword, DeleteSelf
└─ handler.go           POST /v1/auth/password, DELETE /v1/me

api/internal/dataexport/
├─ dto.go
├─ types.go             ExportPayload struct
├─ repository.go        FetchAll (profile + logs + events + insights)
├─ service.go           Build
└─ handler.go           GET /v1/me/export

api/migrations/00009_consents.sql
docs/HAFTA6_VERIFICATION.md
```

### Modified files

```
api/internal/config/config.go         — add ConsentKEK
api/.env.example                       — add CONSENT_KEK
api/internal/auth/dto.go               — add ConsentInput[] to RegisterRequest
api/internal/auth/repository.go        — CreateUserTx, FindUserByID exposed for account
api/internal/auth/service.go           — Register transactional + consent validation
api/internal/auth/handler.go           — extract IP/UA/Device-Id, map new error
api/internal/insights/service.go       — consent gate on Generate
api/internal/insights/handler.go       — map ErrConsentRevoked to 403
api/internal/http/router.go            — mount new feature routes (via Deps)
api/cmd/api/main.go                    — wire consents/account/dataexport
docs/api-errors.md                     — append new error codes
```

---

## Conventions used in this plan

- Run all `go test` from `api/` directory unless stated.
- Commit after every task. Use a short imperative subject.
- TDD discipline: failing test first, see it fail, then implement minimal code, see it pass.
- Repository tests are skipped (DB integration) — service tests use mocks of
  the repository interface, mirroring `api/internal/insights/service_test.go`.
- After every task, run `go build ./...` and `go test ./...` from `api/`.

---

## Phase 1 — Foundation

### Task 1: AES-GCM helper

**Files:**
- Create: `api/internal/crypto/aesgcm/aesgcm.go`
- Create: `api/internal/crypto/aesgcm/aesgcm_test.go`

- [ ] **Step 1: Write the failing test**

```go
// api/internal/crypto/aesgcm/aesgcm_test.go
package aesgcm

import (
	"bytes"
	"crypto/rand"
	"testing"
)

func newKey(t *testing.T) []byte {
	t.Helper()
	k := make([]byte, 32)
	if _, err := rand.Read(k); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return k
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	key := newKey(t)
	plaintext := []byte("203.0.113.42")
	ct, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if bytes.Equal(ct, plaintext) {
		t.Fatal("ciphertext equals plaintext")
	}
	got, err := Decrypt(key, ct)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("got %q, want %q", got, plaintext)
	}
}

func TestEncryptProducesDifferentCiphertextForSamePlaintext(t *testing.T) {
	key := newKey(t)
	pt := []byte("203.0.113.42")
	a, _ := Encrypt(key, pt)
	b, _ := Encrypt(key, pt)
	if bytes.Equal(a, b) {
		t.Fatal("two encryptions of same plaintext produced identical ciphertext (nonce reuse?)")
	}
}

func TestDecryptRejectsTamperedCiphertext(t *testing.T) {
	key := newKey(t)
	ct, _ := Encrypt(key, []byte("hello"))
	ct[len(ct)-1] ^= 0x01
	if _, err := Decrypt(key, ct); err == nil {
		t.Fatal("decrypt of tampered ciphertext should fail")
	}
}

func TestEncryptRejectsShortKey(t *testing.T) {
	if _, err := Encrypt(make([]byte, 16), []byte("x")); err == nil {
		t.Fatal("expected error for short key")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/crypto/aesgcm/...`
Expected: FAIL with "no Go files" or "undefined: Encrypt".

- [ ] **Step 3: Write minimal implementation**

```go
// api/internal/crypto/aesgcm/aesgcm.go
package aesgcm

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
)

const (
	keyLen   = 32 // AES-256
	nonceLen = 12 // GCM standard
)

// Encrypt returns nonce(12) || ciphertext || tag(16). Each call uses a fresh
// random nonce, so two encryptions of the same plaintext produce different
// ciphertext.
func Encrypt(key, plaintext []byte) ([]byte, error) {
	if len(key) != keyLen {
		return nil, errors.New("aesgcm: key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, nonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	// gcm.Seal appends ciphertext+tag to dst. Use nonce as dst so the
	// returned slice is nonce || ciphertext || tag.
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func Decrypt(key, ciphertext []byte) ([]byte, error) {
	if len(key) != keyLen {
		return nil, errors.New("aesgcm: key must be 32 bytes")
	}
	if len(ciphertext) < nonceLen {
		return nil, errors.New("aesgcm: ciphertext too short")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce, ct := ciphertext[:nonceLen], ciphertext[nonceLen:]
	return gcm.Open(nil, nonce, ct, nil)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd api && go test ./internal/crypto/aesgcm/...`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add api/internal/crypto/aesgcm/
git commit -m "Add AES-GCM helper for consent audit field encryption"
```

---

### Task 2: Config CONSENT_KEK

**Files:**
- Modify: `api/internal/config/config.go`
- Modify: `api/.env.example`

- [ ] **Step 1: Modify config.go to add CONSENT_KEK**

Replace the `Config` struct and `Load` function in `api/internal/config/config.go`:

```go
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL  string
	JWTSecret    string
	OpenAIAPIKey string
	ConsentKEK   []byte
	Port         string
	LogLevel     string
}

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		OpenAIAPIKey: os.Getenv("OPENAI_API_KEY"),
		Port:         getenv("PORT", "8080"),
		LogLevel:     getenv("LOG_LEVEL", "info"),
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	rawKEK := os.Getenv("CONSENT_KEK")
	if rawKEK == "" {
		missing = append(missing, "CONSENT_KEK")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required env vars: %v", missing)
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET must be at least 32 characters")
	}
	kek, err := base64.StdEncoding.DecodeString(rawKEK)
	if err != nil {
		return nil, fmt.Errorf("CONSENT_KEK: %w", err)
	}
	if len(kek) != 32 {
		return nil, errors.New("CONSENT_KEK must decode to exactly 32 bytes (AES-256)")
	}
	cfg.ConsentKEK = kek

	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 2: Update .env.example**

Append to `api/.env.example` (after `OPENAI_API_KEY=` block):

```env

# CONSENT_KEK is a 32-byte AES-256 master key used to encrypt audit fields
# (IP, device id) on the consents table. Generate locally with:
#   openssl rand -base64 32
# Without this env, the API refuses to boot.
CONSENT_KEK=
```

- [ ] **Step 3: Verify build**

Run: `cd api && go build ./...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/internal/config/config.go api/.env.example
git commit -m "Add CONSENT_KEK config (AES-256 master key for consent audit fields)"
```

---

### Task 3: Migration 00009_consents.sql

**Files:**
- Create: `api/migrations/00009_consents.sql`

- [ ] **Step 1: Write the migration**

```sql
-- +goose Up
CREATE TABLE consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('ai_usage','terms_of_service','privacy_policy')),
  granted             boolean NOT NULL,
  version             text NOT NULL,
  source              text NOT NULL CHECK (source IN ('register','settings','reconsent')),
  ip_encrypted        bytea,
  device_id_encrypted bytea,
  user_agent          text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consents_user_type_occurred_idx
  ON consents (user_id, type, occurred_at DESC);

-- +goose Down
DROP INDEX IF EXISTS consents_user_type_occurred_idx;
DROP TABLE IF EXISTS consents;
```

- [ ] **Step 2: Apply migration locally**

Run:
```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
```

Verify in psql:
```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot -c "\d consents"
```

Expected: table with the 10 columns above plus the index.

- [ ] **Step 3: Roll back and re-apply (sanity)**

Run: `cd api && goose -dir migrations postgres "$DATABASE_URL" down && goose -dir migrations postgres "$DATABASE_URL" up`
Expected: down + up both succeed.

- [ ] **Step 4: Commit**

```bash
git add api/migrations/00009_consents.sql
git commit -m "Migration 00009: consents audit table with encrypted IP/device fields"
```

---

## Phase 2 — Consents slice

### Task 4: Consents skeleton (types + dto)

**Files:**
- Create: `api/internal/consents/types.go`
- Create: `api/internal/consents/dto.go`

- [ ] **Step 1: Write types.go**

```go
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
```

- [ ] **Step 2: Write dto.go**

```go
// api/internal/consents/dto.go
package consents

import "time"

type ConsentResponse struct {
	Type           ConsentType `json:"type"`
	Granted        bool        `json:"granted"`
	Version        string      `json:"version"`
	CurrentVersion string      `json:"current_version"`
	Source         Source      `json:"source,omitempty"`
	OccurredAt     *time.Time  `json:"occurred_at"`
}

type GrantRequest struct {
	Type    ConsentType `json:"type"`
	Granted bool        `json:"granted"`
}
```

- [ ] **Step 3: Verify build**

Run: `cd api && go build ./internal/consents/...`
Expected: PASS (no usages yet).

- [ ] **Step 4: Commit**

```bash
git add api/internal/consents/types.go api/internal/consents/dto.go
git commit -m "consents: add types and DTOs (ConsentType, CurrentVersions, RecordContext)"
```

---

### Task 5: Consents repository

**Files:**
- Create: `api/internal/consents/repository.go`

This task has no unit test — repository hits real DB and is exercised by
integration smoke. Service tests below mock the interface.

- [ ] **Step 1: Write repository.go**

```go
// api/internal/consents/repository.go
package consents

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/neuronot/api/internal/crypto/aesgcm"
)

var ErrNotFound = errors.New("consent not found")

type Repository struct {
	pool *pgxpool.Pool
	kek  []byte
}

func NewRepository(pool *pgxpool.Pool, kek []byte) *Repository {
	return &Repository{pool: pool, kek: kek}
}

// DBTX is the subset of pgx that both pgxpool.Pool and pgx.Tx satisfy. It
// lets callers (e.g. auth.Register) thread an existing transaction.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Record inserts a new immutable audit row.
func (r *Repository) Record(
	ctx context.Context,
	userID uuid.UUID,
	t ConsentType,
	granted bool,
	version string,
	rc RecordContext,
) error {
	return r.RecordTx(ctx, r.pool, userID, t, granted, version, rc)
}

// RecordTx is the transaction-aware variant. Used by auth.Register to bundle
// the user creation + 3 consent inserts into a single commit.
func (r *Repository) RecordTx(
	ctx context.Context,
	tx DBTX,
	userID uuid.UUID,
	t ConsentType,
	granted bool,
	version string,
	rc RecordContext,
) error {
	var ipEnc, devEnc []byte
	if rc.IP != "" {
		enc, err := aesgcm.Encrypt(r.kek, []byte(rc.IP))
		if err != nil {
			return fmt.Errorf("encrypt ip: %w", err)
		}
		ipEnc = enc
	}
	if rc.DeviceID != "" {
		enc, err := aesgcm.Encrypt(r.kek, []byte(rc.DeviceID))
		if err != nil {
			return fmt.Errorf("encrypt device_id: %w", err)
		}
		devEnc = enc
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO consents (user_id, type, granted, version, source, ip_encrypted, device_id_encrypted, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, userID, string(t), granted, version, string(rc.Source), ipEnc, devEnc, rc.UserAgent)
	return err
}

// LatestPerType returns the most recent row for each known consent type for
// the given user. Types with no history are absent from the slice.
func (r *Repository) LatestPerType(ctx context.Context, userID uuid.UUID) ([]Consent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT ON (type)
		       id, user_id, type, granted, version, source, COALESCE(user_agent, ''), occurred_at
		  FROM consents
		 WHERE user_id = $1
		 ORDER BY type, occurred_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Consent, 0, 3)
	for rows.Next() {
		var c Consent
		var typ, src string
		if err := rows.Scan(&c.ID, &c.UserID, &typ, &c.Granted, &c.Version, &src, &c.UserAgent, &c.OccurredAt); err != nil {
			return nil, err
		}
		c.Type = ConsentType(typ)
		c.Source = Source(src)
		out = append(out, c)
	}
	return out, rows.Err()
}

// Latest returns the most recent row of a specific type, or ErrNotFound.
func (r *Repository) Latest(ctx context.Context, userID uuid.UUID, t ConsentType) (*Consent, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, user_id, type, granted, version, source, COALESCE(user_agent, ''), occurred_at
		  FROM consents
		 WHERE user_id = $1 AND type = $2
		 ORDER BY occurred_at DESC
		 LIMIT 1
	`, userID, string(t))
	var c Consent
	var typ, src string
	if err := row.Scan(&c.ID, &c.UserID, &typ, &c.Granted, &c.Version, &src, &c.UserAgent, &c.OccurredAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	c.Type = ConsentType(typ)
	c.Source = Source(src)
	return &c, nil
}
```

- [ ] **Step 2: Verify build**

Run: `cd api && go build ./internal/consents/...`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/internal/consents/repository.go
git commit -m "consents: repository with encrypted audit fields and tx-aware insert"
```

---

### Task 6: Consents service (TDD with mocked repo)

**Files:**
- Create: `api/internal/consents/service.go`
- Create: `api/internal/consents/service_test.go`

- [ ] **Step 1: Write service.go skeleton + interface**

```go
// api/internal/consents/service.go
package consents

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrUnknownType    = errors.New("unknown consent type")
	ErrConsentRevoked = errors.New("ai consent revoked or stale")
)

type repository interface {
	Record(ctx context.Context, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error
	RecordTx(ctx context.Context, tx DBTX, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error
	LatestPerType(ctx context.Context, userID uuid.UUID) ([]Consent, error)
	Latest(ctx context.Context, userID uuid.UUID, t ConsentType) (*Consent, error)
}

type Service struct {
	repo repository
	now  func() time.Time
}

func NewService(repo repository) *Service {
	return &Service{
		repo: repo,
		now:  func() time.Time { return time.Now().UTC() },
	}
}

// IsGranted returns true only when the latest row is granted=true AND its
// version matches the current canonical version.
func (s *Service) IsGranted(ctx context.Context, userID uuid.UUID, t ConsentType) (bool, error) {
	if !t.IsValid() {
		return false, ErrUnknownType
	}
	c, err := s.repo.Latest(ctx, userID, t)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return false, nil
		}
		return false, err
	}
	if !c.Granted {
		return false, nil
	}
	return c.Version == CurrentVersions[t], nil
}

// Grant records a granted=true row for the user.
func (s *Service) Grant(ctx context.Context, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.Record(ctx, userID, t, true, CurrentVersions[t], rc)
}

// Revoke records a granted=false row.
func (s *Service) Revoke(ctx context.Context, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.Record(ctx, userID, t, false, CurrentVersions[t], rc)
}

// GrantTx is used during registration to bundle inserts into the same tx
// that creates the user.
func (s *Service) GrantTx(ctx context.Context, tx DBTX, userID uuid.UUID, t ConsentType, rc RecordContext) error {
	if !t.IsValid() {
		return ErrUnknownType
	}
	return s.repo.RecordTx(ctx, tx, userID, t, true, CurrentVersions[t], rc)
}

// All returns the current state for every known type, with CurrentVersion
// inlined so clients can detect stale grants.
func (s *Service) All(ctx context.Context, userID uuid.UUID) ([]ConsentResponse, error) {
	rows, err := s.repo.LatestPerType(ctx, userID)
	if err != nil {
		return nil, err
	}
	byType := make(map[ConsentType]Consent, len(rows))
	for _, c := range rows {
		byType[c.Type] = c
	}
	out := make([]ConsentResponse, 0, len(AllTypes))
	for _, t := range AllTypes {
		c, ok := byType[t]
		if !ok {
			out = append(out, ConsentResponse{
				Type:           t,
				Granted:        false,
				Version:        "",
				CurrentVersion: CurrentVersions[t],
				Source:         "",
				OccurredAt:     time.Time{},
			})
			continue
		}
		out = append(out, ConsentResponse{
			Type:           c.Type,
			Granted:        c.Granted,
			Version:        c.Version,
			CurrentVersion: CurrentVersions[t],
			Source:         c.Source,
			OccurredAt:     c.OccurredAt,
		})
	}
	return out, nil
}
```

- [ ] **Step 2: Write the failing test**

```go
// api/internal/consents/service_test.go
package consents

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeRepo struct {
	latest map[ConsentType]Consent
	all    []Consent

	recordCalls []recordCall
	recordErr   error
	latestErr   error
}

type recordCall struct {
	UserID  uuid.UUID
	Type    ConsentType
	Granted bool
	Version string
	RC      RecordContext
	IsTx    bool
}

func (f *fakeRepo) Record(_ context.Context, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error {
	f.recordCalls = append(f.recordCalls, recordCall{userID, t, granted, version, rc, false})
	return f.recordErr
}
func (f *fakeRepo) RecordTx(_ context.Context, _ DBTX, userID uuid.UUID, t ConsentType, granted bool, version string, rc RecordContext) error {
	f.recordCalls = append(f.recordCalls, recordCall{userID, t, granted, version, rc, true})
	return f.recordErr
}
func (f *fakeRepo) LatestPerType(_ context.Context, _ uuid.UUID) ([]Consent, error) {
	return f.all, f.latestErr
}
func (f *fakeRepo) Latest(_ context.Context, _ uuid.UUID, t ConsentType) (*Consent, error) {
	if f.latestErr != nil {
		return nil, f.latestErr
	}
	c, ok := f.latest[t]
	if !ok {
		return nil, ErrNotFound
	}
	return &c, nil
}

func TestIsGranted_NoHistory(t *testing.T) {
	svc := NewService(&fakeRepo{latest: map[ConsentType]Consent{}})
	got, err := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if err != nil {
		t.Fatal(err)
	}
	if got {
		t.Fatal("expected false when no consent recorded")
	}
}

func TestIsGranted_GrantedCurrentVersion(t *testing.T) {
	svc := NewService(&fakeRepo{latest: map[ConsentType]Consent{
		ConsentTypeAIUsage: {Granted: true, Version: CurrentVersions[ConsentTypeAIUsage]},
	}})
	got, err := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if err != nil {
		t.Fatal(err)
	}
	if !got {
		t.Fatal("expected true for granted current version")
	}
}

func TestIsGranted_GrantedStaleVersion(t *testing.T) {
	svc := NewService(&fakeRepo{latest: map[ConsentType]Consent{
		ConsentTypeAIUsage: {Granted: true, Version: "old"},
	}})
	got, _ := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if got {
		t.Fatal("stale version should not count as granted")
	}
}

func TestIsGranted_Revoked(t *testing.T) {
	svc := NewService(&fakeRepo{latest: map[ConsentType]Consent{
		ConsentTypeAIUsage: {Granted: false, Version: CurrentVersions[ConsentTypeAIUsage]},
	}})
	got, _ := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if got {
		t.Fatal("revoked should not count as granted")
	}
}

func TestIsGranted_UnknownType(t *testing.T) {
	svc := NewService(&fakeRepo{})
	_, err := svc.IsGranted(context.Background(), uuid.New(), "bogus")
	if !errors.Is(err, ErrUnknownType) {
		t.Fatalf("got %v, want ErrUnknownType", err)
	}
}

func TestGrantUsesCurrentVersion(t *testing.T) {
	repo := &fakeRepo{latest: map[ConsentType]Consent{}}
	svc := NewService(repo)
	uid := uuid.New()
	rc := RecordContext{IP: "1.2.3.4", DeviceID: "dev1", Source: SourceSettings}
	if err := svc.Grant(context.Background(), uid, ConsentTypeAIUsage, rc); err != nil {
		t.Fatal(err)
	}
	if len(repo.recordCalls) != 1 {
		t.Fatalf("got %d calls, want 1", len(repo.recordCalls))
	}
	c := repo.recordCalls[0]
	if c.UserID != uid || c.Type != ConsentTypeAIUsage || !c.Granted ||
		c.Version != CurrentVersions[ConsentTypeAIUsage] || c.RC.IP != "1.2.3.4" {
		t.Fatalf("unexpected call: %+v", c)
	}
}

func TestRevokeRecordsGrantedFalse(t *testing.T) {
	repo := &fakeRepo{}
	svc := NewService(repo)
	if err := svc.Revoke(context.Background(), uuid.New(), ConsentTypeAIUsage, RecordContext{Source: SourceSettings}); err != nil {
		t.Fatal(err)
	}
	if len(repo.recordCalls) != 1 || repo.recordCalls[0].Granted {
		t.Fatalf("revoke should record granted=false, got %+v", repo.recordCalls)
	}
}

func TestAllReturnsRowForEveryType(t *testing.T) {
	repo := &fakeRepo{
		all: []Consent{
			{Type: ConsentTypeAIUsage, Granted: true, Version: CurrentVersions[ConsentTypeAIUsage], OccurredAt: time.Now()},
		},
	}
	svc := NewService(repo)
	out, err := svc.All(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != len(AllTypes) {
		t.Fatalf("got %d rows, want %d (one per type)", len(out), len(AllTypes))
	}
	// AI row is granted=true; the others are absent in the repo and should
	// come back as Granted=false / empty version.
	var aiRow ConsentResponse
	for _, r := range out {
		if r.Type == ConsentTypeAIUsage {
			aiRow = r
		} else if r.Granted {
			t.Fatalf("expected default false for %s, got %+v", r.Type, r)
		}
	}
	if !aiRow.Granted {
		t.Fatal("AI row should be granted")
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd api && go test ./internal/consents/...`
Expected: PASS — 8 tests.

- [ ] **Step 4: Commit**

```bash
git add api/internal/consents/service.go api/internal/consents/service_test.go
git commit -m "consents: service with IsGranted/Grant/Revoke/All + version-aware checks"
```

---

### Task 7: Consents handler

**Files:**
- Create: `api/internal/consents/handler.go`

- [ ] **Step 1: Write handler.go**

```go
// api/internal/consents/handler.go
package consents

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	httpx "github.com/neuronot/api/internal/http"
	"github.com/neuronot/api/internal/http/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Mount(r chi.Router) {
	r.Get("/", h.list)
	r.Post("/", h.grant)
	r.Delete("/{type}", h.revoke)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	out, err := h.svc.All(r.Context(), uid)
	if err != nil {
		httpx.InternalError(w)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) grant(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req GrantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if !req.Type.IsValid() {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CONSENT_UNKNOWN_TYPE", "errors.consent.unknown_type", "Unknown consent type")
		return
	}
	rc := requestRecordContext(r, SourceSettings)
	var err error
	if req.Granted {
		err = h.svc.Grant(r.Context(), uid, req.Type, rc)
	} else {
		err = h.svc.Revoke(r.Context(), uid, req.Type, rc)
	}
	if err != nil {
		httpx.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) revoke(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	t := ConsentType(chi.URLParam(r, "type"))
	if !t.IsValid() {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CONSENT_UNKNOWN_TYPE", "errors.consent.unknown_type", "Unknown consent type")
		return
	}
	if err := h.svc.Revoke(r.Context(), uid, t, requestRecordContext(r, SourceSettings)); err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.NotFound(w)
			return
		}
		httpx.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// requestRecordContext extracts IP, device id, user agent from the request
// for the consent audit row. Caller decides the source.
func requestRecordContext(r *http.Request, src Source) RecordContext {
	return RecordContext{
		IP:        clientIP(r),
		DeviceID:  r.Header.Get("X-Device-Id"),
		UserAgent: r.UserAgent(),
		Source:    src,
	}
}

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		if comma := strings.Index(ip, ","); comma >= 0 {
			return strings.TrimSpace(ip[:comma])
		}
		return strings.TrimSpace(ip)
	}
	return r.RemoteAddr
}

// Suppress unused import lint by using uuid in a blank assertion.
var _ = uuid.Nil
```

- [ ] **Step 2: Verify build**

Run: `cd api && go build ./internal/consents/...`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/internal/consents/handler.go
git commit -m "consents: handler with GET/POST/DELETE under /v1/me/consents"
```

---

### Task 8: Wire consents into router and main.go

**Files:**
- Modify: `api/internal/http/router.go`
- Modify: `api/cmd/api/main.go`

- [ ] **Step 1: Read router.go to find Deps struct**

Read: `api/internal/http/router.go`. Locate the `Deps` struct.

- [ ] **Step 2: Add ConsentsRoutes to Deps and mount under `/v1/me/consents`**

In `api/internal/http/router.go`, add a field to `Deps`:

```go
ConsentsRoutes func(chi.Router)
```

In the authenticated mount block (where `ProfileRoutes`, `DailyLogRoutes`, etc. are mounted), add:

```go
r.Route("/me/consents", deps.ConsentsRoutes)
```

Place it adjacent to other `/me/*` mounts (e.g., near where `/me` or profile is mounted).

- [ ] **Step 3: Wire in main.go**

In `api/cmd/api/main.go`, after the `profile` slice setup and before the `router := httpx.NewRouter(...)` call, add:

```go
consentsRepo := consents.NewRepository(pool, cfg.ConsentKEK)
consentsSvc := consents.NewService(consentsRepo)
consentsHandler := consents.NewHandler(consentsSvc)
```

Add the import: `"github.com/neuronot/api/internal/consents"`.

In the `httpx.Deps{}` literal, add:

```go
ConsentsRoutes: func(r chi.Router) { consentsHandler.Mount(r) },
```

- [ ] **Step 4: Build and run**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.

- [ ] **Step 5: Smoke test (server running)**

In one terminal: `make api-dev`. In another:

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/consents | jq
```

Expected: a JSON array with 3 entries (terms_of_service, privacy_policy, ai_usage), all `granted: false` (no consents recorded yet for this existing test user).

- [ ] **Step 6: Commit**

```bash
git add api/internal/http/router.go api/cmd/api/main.go
git commit -m "consents: mount /v1/me/consents routes and wire service"
```

---

## Phase 3 — Auth modification

### Task 9: Extend RegisterRequest with consent inputs

**Files:**
- Modify: `api/internal/auth/dto.go`

- [ ] **Step 1: Add ConsentInput and field to RegisterRequest**

Edit `api/internal/auth/dto.go`:

```go
package auth

import "time"

type ConsentInput struct {
	Type    string `json:"type"`
	Granted bool   `json:"granted"`
	Version string `json:"version"`
}

type RegisterRequest struct {
	Email             string         `json:"email"`
	Password          string         `json:"password"`
	PreferredLanguage string         `json:"preferred_language,omitempty"`
	Consents          []ConsentInput `json:"consents"`
}

// (rest of dto.go unchanged)
```

- [ ] **Step 2: Build**

Run: `cd api && go build ./...`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/internal/auth/dto.go
git commit -m "auth: add ConsentInput field to RegisterRequest"
```

---

### Task 10: Make auth.Register transactional with consent validation

**Files:**
- Modify: `api/internal/auth/repository.go` (add `CreateUserTx`)
- Modify: `api/internal/auth/service.go` (transactional Register, consent validation)

- [ ] **Step 1: Read auth/repository.go to find CreateUser signature**

Read: `api/internal/auth/repository.go`. Locate `CreateUser` and the `*pgxpool.Pool` field on `Repository`.

- [ ] **Step 2: Add `CreateUserTx` method**

Append to `api/internal/auth/repository.go`:

```go
import (
	"github.com/jackc/pgx/v5"          // (add if not present)
	"github.com/jackc/pgx/v5/pgconn"   // CommandTag lives here in pgx v5
)

// DBTX is the subset of pgx that both pgxpool.Pool and pgx.Tx satisfy.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// CreateUserTx is the transaction-aware variant of CreateUser. The caller
// is responsible for committing or rolling back the transaction.
func (r *Repository) CreateUserTx(ctx context.Context, tx DBTX, email, passwordHash, language string) (*User, error) {
	// Mirror the SQL of CreateUser but use the supplied DBTX.
	row := tx.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, preferred_language)
		VALUES ($1, $2, $3)
		RETURNING id, email, password_hash, preferred_language, created_at
	`, email, passwordHash, language)
	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.PreferredLanguage, &u.CreatedAt); err != nil {
		// Map pg unique violation on email to ErrEmailTaken (mirror existing CreateUser).
		// The existing CreateUser already does this; copy that block here.
		// (See repository.go for the exact pgconn.PgError check.)
		return nil, mapCreateUserErr(err)
	}
	return &u, nil
}
```

If `mapCreateUserErr` does not exist, extract the email-conflict-detection block from the current `CreateUser` body into a private helper `mapCreateUserErr(err error) error`, then have both `CreateUser` and `CreateUserTx` call it.

- [ ] **Step 3: Add a Pool() accessor (read-only) for service-level transactions**

Add to `api/internal/auth/repository.go`:

```go
func (r *Repository) Pool() *pgxpool.Pool {
	return r.pool
}
```

- [ ] **Step 4: Modify auth/service.go to thread consents and use a transaction**

Edit `api/internal/auth/service.go`:

Add fields to Service:

```go
type Service struct {
	repo        *Repository
	consents    consentService
	jwtSecret   []byte

	limiterMu sync.Mutex
	limiters  map[string]*rate.Limiter
}

type consentService interface {
	GrantTx(ctx context.Context, tx consents.DBTX, userID uuid.UUID, t consents.ConsentType, rc consents.RecordContext) error
}
```

Rather than importing `consents` (which would create a cycle if consents ever imports auth), define a package-local `consentService` interface as above. Caller injects the implementation.

Update constructor:

```go
func NewService(repo *Repository, consentSvc consentService, jwtSecret []byte) *Service {
	return &Service{
		repo:      repo,
		consents:  consentSvc,
		jwtSecret: jwtSecret,
		limiters:  make(map[string]*rate.Limiter),
	}
}
```

Add a new error:

```go
ErrAIConsentRequired = errors.New("ai_usage consent required")
```

Replace `Register` body with:

```go
// RegisterContext carries audit fields for the consent rows we insert.
type RegisterContext struct {
	IP        string
	DeviceID  string
	UserAgent string
}

func (s *Service) Register(ctx context.Context, req RegisterRequest, rc RegisterContext) (*TokenResponse, error) {
	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, ErrInvalidEmail
	}
	if len(req.Password) < minPasswordLength {
		return nil, ErrWeakPassword
	}

	lang := strings.ToLower(strings.TrimSpace(req.PreferredLanguage))
	if !supportedLanguages[lang] {
		lang = defaultLanguage
	}

	if !aiConsentGranted(req.Consents) {
		return nil, ErrAIConsentRequired
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	pool := s.repo.Pool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	user, err := s.repo.CreateUserTx(ctx, tx, email, string(hash), lang)
	if err != nil {
		return nil, err
	}

	consentRC := consents.RecordContext{
		IP:        rc.IP,
		DeviceID:  rc.DeviceID,
		UserAgent: rc.UserAgent,
		Source:    consents.SourceRegister,
	}
	for _, t := range consents.AllTypes {
		// Persist the granted state the client supplied. AI is required to
		// be true (checked above); ToS/Privacy default to true on register.
		granted := true
		if g, ok := findConsent(req.Consents, t); ok {
			granted = g
		}
		if !granted && t == consents.ConsentTypeAIUsage {
			// guarded by aiConsentGranted above, but stay defensive.
			return nil, ErrAIConsentRequired
		}
		if err := s.consents.GrantTx(ctx, tx, user.ID, t, consentRC); err != nil {
			return nil, fmt.Errorf("record consent %s: %w", t, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.issueTokens(ctx, user)
}

func aiConsentGranted(in []ConsentInput) bool {
	for _, c := range in {
		if c.Type == string(consents.ConsentTypeAIUsage) && c.Granted {
			return true
		}
	}
	return false
}

func findConsent(in []ConsentInput, t consents.ConsentType) (bool, bool) {
	for _, c := range in {
		if c.Type == string(t) {
			return c.Granted, true
		}
	}
	return false, false
}
```

Add imports: `"github.com/neuronot/api/internal/consents"`.

- [ ] **Step 5: Build to surface call-site breakage**

Run: `cd api && go build ./...`
Expected: failure in `api/cmd/api/main.go` (the `auth.NewService` call now needs `consentSvc`) and in `api/internal/auth/handler.go` (the `Register` call now needs `RegisterContext`). Those are fixed in Tasks 11 and 12.

- [ ] **Step 6: Commit**

```bash
git add api/internal/auth/repository.go api/internal/auth/service.go
git commit -m "auth: transactional Register with mandatory ai_usage consent"
```

---

### Task 11: Auth handler passes audit context

**Files:**
- Modify: `api/internal/auth/handler.go`

- [ ] **Step 1: Update register handler**

Replace the existing `register` method in `api/internal/auth/handler.go`:

```go
func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	rc := RegisterContext{
		IP:        clientIP(r),
		DeviceID:  r.Header.Get("X-Device-Id"),
		UserAgent: r.UserAgent(),
	}
	resp, err := h.svc.Register(r.Context(), req, rc)
	if err != nil {
		writeAuthError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, resp)
}
```

- [ ] **Step 2: Add error mapping for ErrAIConsentRequired**

Inside `writeAuthError`, add a case before the `default`:

```go
case errors.Is(err, ErrAIConsentRequired):
	httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_AI_CONSENT_REQUIRED", "errors.auth.ai_consent_required", "AI consent is required to register")
```

- [ ] **Step 3: Build**

Run: `cd api && go build ./...`
Expected: still failing on main.go for the consent service wiring. That's fixed next.

- [ ] **Step 4: Commit**

```bash
git add api/internal/auth/handler.go
git commit -m "auth: thread IP/device/user-agent through register; map AI_CONSENT_REQUIRED"
```

---

### Task 12: Wire consents service into auth in main.go

**Files:**
- Modify: `api/cmd/api/main.go`

- [ ] **Step 1: Reorder slice setup so consents builds before auth**

In `main.go`, move the `consentsRepo` / `consentsSvc` / `consentsHandler` block (added in Task 8) **above** the auth block. Then update the auth setup line:

Before:
```go
authSvc := auth.NewService(authRepo, jwtSecret)
```

After:
```go
authSvc := auth.NewService(authRepo, consentsSvc, jwtSecret)
```

- [ ] **Step 2: Build and run smoke**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.

Then start the API and try registering without consent:

```bash
make api-dev &
sleep 2
curl -s -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@x.com","password":"changeme123"}' | jq
```

Expected: `{"data":null,"error":{"code":"AUTH_AI_CONSENT_REQUIRED",...}}`.

Then with consent:

```bash
curl -s -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"newuser@x.com",
    "password":"changeme123",
    "consents":[
      {"type":"ai_usage","granted":true,"version":"v1"},
      {"type":"terms_of_service","granted":true,"version":"2026-05"},
      {"type":"privacy_policy","granted":true,"version":"2026-05"}
    ]
  }' | jq
```

Expected: 201 with `access_token`, `refresh_token`, etc.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add api/cmd/api/main.go
git commit -m "main: wire consents service into auth (mandatory AI consent at register)"
```

---

## Phase 4 — Insights consent gate

### Task 13: Insights service consent check

**Files:**
- Modify: `api/internal/insights/service.go`
- Modify: `api/internal/insights/service_test.go`

- [ ] **Step 1: Define a consent-check interface in insights package**

Append to `api/internal/insights/service.go` (above the existing `Service` struct):

```go
type consentChecker interface {
	IsGranted(ctx context.Context, userID uuid.UUID, t string) (bool, error)
}
```

Wait — to avoid importing the `consents` package (and potential circular issues), use the string form of the type rather than `consents.ConsentType`. The caller adapts.

Update `Service` struct and constructor:

```go
type Service struct {
	repo      repository
	generator Generator
	filter    SafetyFilter
	consents  consentChecker
	now       func() time.Time
}

func NewService(repo repository, generator Generator, filter SafetyFilter, consents consentChecker) *Service {
	return &Service{
		repo:      repo,
		generator: generator,
		filter:    filter,
		consents:  consents,
		now:       func() time.Time { return time.Now().UTC() },
	}
}
```

Add a new error:

```go
var ErrConsentRevoked = errors.New("ai consent revoked or stale")
```

At the very top of `Generate(ctx, userID, language)`, **before** any other repo call, insert:

```go
ok, err := s.consents.IsGranted(ctx, userID, "ai_usage")
if err != nil {
    return nil, err
}
if !ok {
    return nil, ErrConsentRevoked
}
```

- [ ] **Step 2: Add a test that verifies the gate**

Read `api/internal/insights/service_test.go` to find existing fakes. Add a fake consent checker:

```go
type fakeConsents struct {
	granted bool
	err     error
}

func (f *fakeConsents) IsGranted(_ context.Context, _ uuid.UUID, _ string) (bool, error) {
	return f.granted, f.err
}
```

Update existing test constructions of `NewService(...)` to pass `&fakeConsents{granted: true}` so existing tests still succeed.

Add a new test:

```go
func TestGenerateBlockedWhenConsentRevoked(t *testing.T) {
	repo := &fakeRepository{}
	gen := &fakeGenerator{}
	filter := NewSafetyFilter()
	svc := NewService(repo, gen, filter, &fakeConsents{granted: false})
	_, err := svc.Generate(context.Background(), uuid.New(), "en")
	if !errors.Is(err, ErrConsentRevoked) {
		t.Fatalf("got %v, want ErrConsentRevoked", err)
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd api && go test ./internal/insights/...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/internal/insights/service.go api/internal/insights/service_test.go
git commit -m "insights: gate Generate on active ai_usage consent"
```

---

### Task 14: Insights handler maps ErrConsentRevoked

**Files:**
- Modify: `api/internal/insights/handler.go`
- Modify: `api/cmd/api/main.go`

- [ ] **Step 1: Map ErrConsentRevoked → 403 INSIGHT_CONSENT_REVOKED**

In `api/internal/insights/handler.go`, find `writeInsightError` (or whatever the error mapper function is named). Add a case before the default:

```go
case errors.Is(err, ErrConsentRevoked):
	httpx.WriteError(w, http.StatusForbidden, "INSIGHT_CONSENT_REVOKED", "errors.insight.consent_revoked", "AI consent is revoked or out of date")
```

- [ ] **Step 2: Adapt consents.Service to insights' consentChecker interface**

Insights uses `IsGranted(ctx, userID, t string)` (plain string). Consents service has `IsGranted(ctx, userID, t ConsentType)`. Provide an adapter in `main.go`:

```go
type consentsForInsights struct{ svc *consents.Service }

func (c *consentsForInsights) IsGranted(ctx context.Context, userID uuid.UUID, t string) (bool, error) {
	return c.svc.IsGranted(ctx, userID, consents.ConsentType(t))
}
```

- [ ] **Step 3: Update main.go insights wiring**

Change:

```go
insightsSvc := insights.NewService(insightsRepo, insightsGenerator, insights.NewSafetyFilter())
```

To:

```go
insightsSvc := insights.NewService(insightsRepo, insightsGenerator, insights.NewSafetyFilter(), &consentsForInsights{svc: consentsSvc})
```

Add `"github.com/google/uuid"` to imports if not present.

- [ ] **Step 4: Build + smoke**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/internal/insights/handler.go api/cmd/api/main.go
git commit -m "insights: map ErrConsentRevoked to 403; wire consent checker"
```

---

## Phase 5 — Account slice

### Task 15: Account skeleton (types + dto)

**Files:**
- Create: `api/internal/account/types.go`
- Create: `api/internal/account/dto.go`

- [ ] **Step 1: Write types.go**

```go
// api/internal/account/types.go
package account

import "errors"

var (
	ErrPasswordIncorrect    = errors.New("current password incorrect")
	ErrPasswordWeak         = errors.New("new password too short")
	ErrEmailMismatch        = errors.New("delete confirmation email does not match")
	ErrUserNotFound         = errors.New("user not found")
)
```

- [ ] **Step 2: Write dto.go**

```go
// api/internal/account/dto.go
package account

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type DeleteAccountRequest struct {
	ConfirmEmail string `json:"confirm_email"`
}
```

- [ ] **Step 3: Build**

Run: `cd api && go build ./internal/account/...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/internal/account/
git commit -m "account: add types and DTOs (password change, delete account)"
```

---

### Task 16: Account repository

**Files:**
- Create: `api/internal/account/repository.go`

- [ ] **Step 1: Write repository.go**

```go
// api/internal/account/repository.go
package account

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetEmailAndHash(ctx context.Context, userID uuid.UUID) (email, passwordHash string, err error) {
	row := r.pool.QueryRow(ctx, `SELECT email, password_hash FROM users WHERE id = $1`, userID)
	if err := row.Scan(&email, &passwordHash); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", ErrUserNotFound
		}
		return "", "", err
	}
	return email, passwordHash, nil
}

func (r *Repository) UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error {
	tag, err := r.pool.Exec(ctx, `UPDATE users SET password_hash = $1 WHERE id = $2`, newHash, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

// DeleteUser removes the user. FK cascades drop profiles, daily_logs,
// events, insights, consents, and refresh_tokens.
func (r *Repository) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}
```

- [ ] **Step 2: Build**

Run: `cd api && go build ./internal/account/...`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/internal/account/repository.go
git commit -m "account: repository for password update and user deletion"
```

---

### Task 17: Account service (TDD)

**Files:**
- Create: `api/internal/account/service.go`
- Create: `api/internal/account/service_test.go`

- [ ] **Step 1: Write service.go**

```go
// api/internal/account/service.go
package account

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost        = 10
	minPasswordLength = 8
)

type repository interface {
	GetEmailAndHash(ctx context.Context, userID uuid.UUID) (string, string, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, newHash string) error
	DeleteUser(ctx context.Context, userID uuid.UUID) error
}

type tokenRevoker interface {
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	repo   repository
	tokens tokenRevoker
}

func NewService(repo repository, tokens tokenRevoker) *Service {
	return &Service{repo: repo, tokens: tokens}
}

func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, current, next string) error {
	if len(next) < minPasswordLength {
		return ErrPasswordWeak
	}
	_, hash, err := s.repo.GetEmailAndHash(ctx, userID)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(current)); err != nil {
		return ErrPasswordIncorrect
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(next), bcryptCost)
	if err != nil {
		return err
	}
	if err := s.repo.UpdatePassword(ctx, userID, string(newHash)); err != nil {
		return err
	}
	// Invalidate all existing refresh tokens — other devices must re-login.
	if err := s.tokens.RevokeAllForUser(ctx, userID); err != nil {
		// Password is changed; failure to revoke is logged but not surfaced.
		return nil
	}
	return nil
}

func (s *Service) DeleteSelf(ctx context.Context, userID uuid.UUID, confirmEmail string) error {
	email, _, err := s.repo.GetEmailAndHash(ctx, userID)
	if err != nil {
		return err
	}
	if !emailMatches(email, confirmEmail) {
		return ErrEmailMismatch
	}
	return s.repo.DeleteUser(ctx, userID)
}

func emailMatches(stored, confirm string) bool {
	return strings.EqualFold(strings.TrimSpace(stored), strings.TrimSpace(confirm))
}

// Suppress unused import in case errors is not yet referenced.
var _ = errors.Is
```

- [ ] **Step 2: Write the test**

```go
// api/internal/account/service_test.go
package account

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type fakeRepo struct {
	email     string
	hash      string
	getErr    error
	updateErr error
	deleteErr error

	updatedHash string
	deleted     bool
}

func (f *fakeRepo) GetEmailAndHash(_ context.Context, _ uuid.UUID) (string, string, error) {
	return f.email, f.hash, f.getErr
}
func (f *fakeRepo) UpdatePassword(_ context.Context, _ uuid.UUID, h string) error {
	f.updatedHash = h
	return f.updateErr
}
func (f *fakeRepo) DeleteUser(_ context.Context, _ uuid.UUID) error {
	f.deleted = true
	return f.deleteErr
}

type fakeTokens struct{ revoked bool }

func (f *fakeTokens) RevokeAllForUser(_ context.Context, _ uuid.UUID) error {
	f.revoked = true
	return nil
}

func mustHash(t *testing.T, pw string) string {
	t.Helper()
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return string(h)
}

func TestChangePassword_Success(t *testing.T) {
	repo := &fakeRepo{email: "a@b.com", hash: mustHash(t, "current8x")}
	tokens := &fakeTokens{}
	svc := NewService(repo, tokens)
	if err := svc.ChangePassword(context.Background(), uuid.New(), "current8x", "newpass8x"); err != nil {
		t.Fatal(err)
	}
	if repo.updatedHash == "" {
		t.Fatal("password not updated")
	}
	if !tokens.revoked {
		t.Fatal("refresh tokens not revoked")
	}
}

func TestChangePassword_WrongCurrent(t *testing.T) {
	repo := &fakeRepo{email: "a@b.com", hash: mustHash(t, "current8x")}
	svc := NewService(repo, &fakeTokens{})
	err := svc.ChangePassword(context.Background(), uuid.New(), "wrong8888", "newpass8x")
	if !errors.Is(err, ErrPasswordIncorrect) {
		t.Fatalf("got %v, want ErrPasswordIncorrect", err)
	}
}

func TestChangePassword_WeakNew(t *testing.T) {
	svc := NewService(&fakeRepo{hash: mustHash(t, "current8x")}, &fakeTokens{})
	err := svc.ChangePassword(context.Background(), uuid.New(), "current8x", "short")
	if !errors.Is(err, ErrPasswordWeak) {
		t.Fatalf("got %v, want ErrPasswordWeak", err)
	}
}

func TestDeleteSelf_EmailMatch(t *testing.T) {
	repo := &fakeRepo{email: "Ada@example.com", hash: "x"}
	svc := NewService(repo, &fakeTokens{})
	if err := svc.DeleteSelf(context.Background(), uuid.New(), "ada@example.com"); err != nil {
		t.Fatal(err)
	}
	if !repo.deleted {
		t.Fatal("user not deleted")
	}
}

func TestDeleteSelf_EmailMismatch(t *testing.T) {
	repo := &fakeRepo{email: "ada@example.com", hash: "x"}
	svc := NewService(repo, &fakeTokens{})
	err := svc.DeleteSelf(context.Background(), uuid.New(), "wrong@example.com")
	if !errors.Is(err, ErrEmailMismatch) {
		t.Fatalf("got %v, want ErrEmailMismatch", err)
	}
}
```

- [ ] **Step 3: Run tests**

Run: `cd api && go test ./internal/account/...`
Expected: PASS — 5 tests.

- [ ] **Step 4: Commit**

```bash
git add api/internal/account/service.go api/internal/account/service_test.go
git commit -m "account: service for password change and self-deletion + tests"
```

---

### Task 18: Account handler

**Files:**
- Create: `api/internal/account/handler.go`

- [ ] **Step 1: Write handler.go**

```go
// api/internal/account/handler.go
package account

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "github.com/neuronot/api/internal/http"
	"github.com/neuronot/api/internal/http/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// MountPassword mounts POST /password under whatever parent the caller chose
// (typically /v1/auth, alongside login/register).
func (h *Handler) MountPassword(r chi.Router) {
	r.Post("/password", h.changePassword)
}

// MountMe mounts DELETE / under whatever parent the caller chose
// (typically /v1/me).
func (h *Handler) MountMe(r chi.Router) {
	r.Delete("/", h.deleteSelf)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if err := h.svc.ChangePassword(r.Context(), uid, req.CurrentPassword, req.NewPassword); err != nil {
		writeAccountError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteSelf(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	var req DeleteAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.ValidationFailed(w, "invalid json body")
		return
	}
	if err := h.svc.DeleteSelf(r.Context(), uid, req.ConfirmEmail); err != nil {
		writeAccountError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeAccountError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPasswordIncorrect):
		httpx.WriteError(w, http.StatusUnauthorized, "AUTH_PASSWORD_INCORRECT", "errors.auth.password_incorrect", "Current password is incorrect")
	case errors.Is(err, ErrPasswordWeak):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "AUTH_WEAK_PASSWORD", "errors.auth.weak_password", "Password must be at least 8 characters")
	case errors.Is(err, ErrEmailMismatch):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "ACCOUNT_DELETE_EMAIL_MISMATCH", "errors.account.delete_email_mismatch", "Confirmation email does not match account")
	case errors.Is(err, ErrUserNotFound):
		httpx.NotFound(w)
	default:
		httpx.InternalError(w)
	}
}
```

- [ ] **Step 2: Build**

Run: `cd api && go build ./internal/account/...`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/internal/account/handler.go
git commit -m "account: handler with POST /password and DELETE /me"
```

---

### Task 19: Wire account into router and main.go

**Files:**
- Modify: `api/internal/http/router.go`
- Modify: `api/cmd/api/main.go`

- [ ] **Step 1: Add fields to Deps and mount routes**

In `api/internal/http/router.go`, add to `Deps`:

```go
AccountPasswordRoutes func(chi.Router)
AccountMeRoutes       func(chi.Router)
```

In the **public** auth mount block (where `/v1/auth/*` is mounted), do **not** add password — password requires auth. Instead, in the **authenticated** group, mount:

```go
r.Route("/auth/password", deps.AccountPasswordRoutes)
r.Route("/me", func(sub chi.Router) {
    deps.AccountMeRoutes(sub)
    // existing /me/consents mount stays inside this same Route block
    sub.Route("/consents", deps.ConsentsRoutes)
})
```

Adjust the existing consents mount to live under the new `/me` block. If `/me` was previously mounted differently, fold the existing routes (profile, etc.) into the same block so all `/me/*` lives together.

- [ ] **Step 2: Wire main.go**

In `main.go`, add a token-revoker adapter (auth.Repository already has `RevokeAllForUser`):

```go
type accountTokenRevoker struct{ repo *auth.Repository }

func (a *accountTokenRevoker) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	return a.repo.RevokeAllForUser(ctx, userID)
}
```

After the auth setup block, add:

```go
accountRepo := account.NewRepository(pool)
accountSvc := account.NewService(accountRepo, &accountTokenRevoker{repo: authRepo})
accountHandler := account.NewHandler(accountSvc)
```

In `httpx.Deps{}`:

```go
AccountPasswordRoutes: func(r chi.Router) { accountHandler.MountPassword(r) },
AccountMeRoutes:       func(r chi.Router) { accountHandler.MountMe(r) },
```

Add imports: `"github.com/neuronot/api/internal/account"`.

- [ ] **Step 3: Build and smoke**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.

Smoke (assumes existing test user has password `changeme123`):

```bash
make api-dev &
sleep 2
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Wrong current password → 401
curl -s -i -X POST localhost:8080/v1/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"wrongpass","new_password":"newpass8x"}' | head -1

# Correct current → 204
curl -s -i -X POST localhost:8080/v1/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"changeme123","new_password":"newpass8x"}' | head -1
```

Expected: first call 401, second 204.

Reset password back to `changeme123` for repeatability:

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"newpass8x"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -i -X POST localhost:8080/v1/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"newpass8x","new_password":"changeme123"}' | head -1
```

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add api/internal/http/router.go api/cmd/api/main.go
git commit -m "main: wire account routes (POST /v1/auth/password, DELETE /v1/me)"
```

---

## Phase 6 — Data export slice

### Task 20: Dataexport skeleton + types/dto

**Files:**
- Create: `api/internal/dataexport/types.go`
- Create: `api/internal/dataexport/dto.go`

- [ ] **Step 1: Write types.go**

```go
// api/internal/dataexport/types.go
package dataexport

import "time"

// ExportPayload is the canonical shape returned by GET /v1/me/export.
// Mobile saves it verbatim. Each child uses snake_case to match the
// existing API conventions.
type ExportPayload struct {
	GeneratedAt time.Time      `json:"generated_at"`
	Profile     map[string]any `json:"profile"`
	DailyLogs   []map[string]any `json:"daily_logs"`
	Events      []map[string]any `json:"events"`
	Insights    []map[string]any `json:"insights"`
}
```

- [ ] **Step 2: Write dto.go (currently empty — placeholder for future query params)**

```go
// api/internal/dataexport/dto.go
package dataexport

// No request DTO yet. Reserved for future query parameters (e.g., date range).
```

- [ ] **Step 3: Commit**

```bash
git add api/internal/dataexport/
git commit -m "dataexport: types and dto skeleton"
```

---

### Task 21: Dataexport repository

**Files:**
- Create: `api/internal/dataexport/repository.go`

- [ ] **Step 1: Write repository.go**

```go
// api/internal/dataexport/repository.go
package dataexport

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// rowsAsMaps walks pgx.Rows and serializes each row into a map keyed by the
// column name. Used so the export payload mirrors the on-disk shape of each
// table without needing a typed struct per table.
func (r *Repository) FetchProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM profiles WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	all, err := rowsAsMaps(rows)
	if err != nil || len(all) == 0 {
		return nil, err
	}
	return all[0], nil
}

func (r *Repository) FetchDailyLogs(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM daily_logs WHERE user_id = $1 ORDER BY log_date DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}

func (r *Repository) FetchEvents(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM events WHERE user_id = $1 ORDER BY occurred_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}

func (r *Repository) FetchInsights(ctx context.Context, userID uuid.UUID) ([]map[string]any, error) {
	rows, err := r.pool.Query(ctx, `SELECT * FROM insights WHERE user_id = $1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rowsAsMaps(rows)
}
```

- [ ] **Step 2: Add the rows helper**

Append to `api/internal/dataexport/repository.go`:

```go
import (
	// existing imports + add:
	"github.com/jackc/pgx/v5"
)

func rowsAsMaps(rows pgx.Rows) ([]map[string]any, error) {
	fields := rows.FieldDescriptions()
	cols := make([]string, len(fields))
	for i, f := range fields {
		cols[i] = string(f.Name)
	}
	out := make([]map[string]any, 0)
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			row[c] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
```

- [ ] **Step 3: Build**

Run: `cd api && go build ./internal/dataexport/...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/internal/dataexport/repository.go
git commit -m "dataexport: repository fetches profile/logs/events/insights as maps"
```

---

### Task 22: Dataexport service + handler

**Files:**
- Create: `api/internal/dataexport/service.go`
- Create: `api/internal/dataexport/handler.go`

- [ ] **Step 1: Write service.go**

```go
// api/internal/dataexport/service.go
package dataexport

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type repository interface {
	FetchProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error)
	FetchDailyLogs(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchEvents(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
	FetchInsights(ctx context.Context, userID uuid.UUID) ([]map[string]any, error)
}

type Service struct {
	repo repository
	now  func() time.Time
}

func NewService(repo repository) *Service {
	return &Service{repo: repo, now: func() time.Time { return time.Now().UTC() }}
}

func (s *Service) Build(ctx context.Context, userID uuid.UUID) (ExportPayload, error) {
	profile, err := s.repo.FetchProfile(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	logs, err := s.repo.FetchDailyLogs(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	events, err := s.repo.FetchEvents(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	insights, err := s.repo.FetchInsights(ctx, userID)
	if err != nil {
		return ExportPayload{}, err
	}
	return ExportPayload{
		GeneratedAt: s.now(),
		Profile:     profile,
		DailyLogs:   logs,
		Events:      events,
		Insights:    insights,
	}, nil
}
```

- [ ] **Step 2: Write handler.go**

```go
// api/internal/dataexport/handler.go
package dataexport

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	httpx "github.com/neuronot/api/internal/http"
	"github.com/neuronot/api/internal/http/middleware"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Mount(r chi.Router) {
	r.Get("/", h.export)
}

func (h *Handler) export(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserID(r.Context())
	payload, err := h.svc.Build(r.Context(), uid)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "EXPORT_FAILED", "errors.export.failed", "Could not build export")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, payload)
}
```

- [ ] **Step 3: Build**

Run: `cd api && go build ./internal/dataexport/...`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/internal/dataexport/service.go api/internal/dataexport/handler.go
git commit -m "dataexport: service Build aggregator + handler GET /v1/me/export"
```

---

### Task 23: Wire dataexport into router and main.go

**Files:**
- Modify: `api/internal/http/router.go`
- Modify: `api/cmd/api/main.go`

- [ ] **Step 1: Add field to Deps and mount /me/export**

In `router.go`, add to `Deps`:

```go
ExportRoutes func(chi.Router)
```

Inside the `/me` Route block (created in Task 19), add:

```go
sub.Route("/export", deps.ExportRoutes)
```

- [ ] **Step 2: Wire main.go**

```go
exportRepo := dataexport.NewRepository(pool)
exportSvc := dataexport.NewService(exportRepo)
exportHandler := dataexport.NewHandler(exportSvc)
```

In Deps literal:

```go
ExportRoutes: func(r chi.Router) { exportHandler.Mount(r) },
```

Add import: `"github.com/neuronot/api/internal/dataexport"`.

- [ ] **Step 3: Build and smoke**

Run: `cd api && go build ./... && go test ./...`
Expected: PASS.

```bash
make api-dev &
sleep 2
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/export | jq 'keys'
```

Expected: `["daily_logs","events","generated_at","insights","profile"]`.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add api/internal/http/router.go api/cmd/api/main.go
git commit -m "main: wire data export route GET /v1/me/export"
```

---

## Phase 7 — Docs

### Task 24: api-errors.md updates

**Files:**
- Modify: `docs/api-errors.md`

- [ ] **Step 1: Append the new error codes**

Open `docs/api-errors.md` and append (at the end of the relevant section, or as a new "Profile/Settings additions" subsection):

```markdown
### Profile/Settings additions (2026-05)

| Code | HTTP | Description |
|---|---|---|
| `AUTH_AI_CONSENT_REQUIRED` | 422 | Register call without an `ai_usage` consent set to true. |
| `AUTH_PASSWORD_INCORRECT` | 401 | Change-password request with wrong `current_password`. |
| `ACCOUNT_DELETE_EMAIL_MISMATCH` | 422 | Delete-account confirmation email does not match the user's email. |
| `INSIGHT_CONSENT_REVOKED` | 403 | `POST /v1/insights/generate` while `ai_usage` consent is revoked or stale. |
| `CONSENT_UNKNOWN_TYPE` | 422 | Consent endpoint called with a type not in `(ai_usage, terms_of_service, privacy_policy)`. |
| `EXPORT_FAILED` | 500 | Export aggregation hit an unexpected error. |
```

- [ ] **Step 2: Commit**

```bash
git add docs/api-errors.md
git commit -m "docs: add error codes for consent, account, export"
```

---

### Task 25: HAFTA6_VERIFICATION.md

**Files:**
- Create: `docs/HAFTA6_VERIFICATION.md`

- [ ] **Step 1: Write the smoke runbook**

```markdown
# Hafta 6 Verification Runbook

Hafta 6: Profile/Settings backend — consents audit layer, account management,
data export, register consent gate, insights consent gate.

## Ön Koşul

Hafta 5 verification başarıyla tamamlanmış olmalı. `api/.env` içinde
`DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`, `CONSENT_KEK` bulunmalı.
`CONSENT_KEK` 32-byte AES-256 anahtarın base64'üdür:

```bash
openssl rand -base64 32
```

## 1. Migration

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
docker exec -it neuronot_postgres psql -U neuronot -d neuronot -c "\d consents"
```

Beklenen: `consents` tablosu, `consents_user_type_occurred_idx` index ile.

## 2. Automated Checks

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Beklenen: PASS (insights, account, consents, crypto/aesgcm tests).

## 3. Register zorunlu AI consent

```bash
# Konsentsuz: 422 AUTH_AI_CONSENT_REQUIRED
curl -s -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@x.com","password":"changeme123"}' | jq

# Konsentli: 201
curl -s -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@x.com","password":"changeme123","consents":[
    {"type":"ai_usage","granted":true,"version":"v1"},
    {"type":"terms_of_service","granted":true,"version":"2026-05"},
    {"type":"privacy_policy","granted":true,"version":"2026-05"}
  ]}' | jq .access_token
```

## 4. Consents endpoint

```bash
TOKEN=<access_token from above>

curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/consents | jq
```

Beklenen: 3 satır, üçü de `granted: true`, `version` = `current_version`.

```bash
# Revoke AI
curl -s -X DELETE localhost:8080/v1/me/consents/ai_usage \
  -H "Authorization: Bearer $TOKEN" -i | head -1

# Re-list — ai_usage granted: false
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/consents | jq
```

## 5. Insights AI consent gate

```bash
# AI revoked → 403 INSIGHT_CONSENT_REVOKED
curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}' | jq
```

Beklenen: error.code = `INSIGHT_CONSENT_REVOKED`.

## 6. Şifre değiştir

```bash
# Yanlış mevcut şifre → 401
curl -s -i -X POST localhost:8080/v1/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"wrong","new_password":"newpass8x"}' | head -1

# Doğru → 204; eski refresh token devre dışı
curl -s -i -X POST localhost:8080/v1/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"changeme123","new_password":"newpass8x"}' | head -1
```

## 7. Veri export

```bash
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/export | jq 'keys'
```

Beklenen: `["daily_logs","events","generated_at","insights","profile"]`.

## 8. Hesap sil

```bash
# Yanlış email → 422
curl -s -i -X DELETE localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm_email":"wrong@x.com"}' | head -1

# Doğru email → 204; sonra GET /v1/me/consents 401 vermeli
curl -s -i -X DELETE localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm_email":"alice@x.com"}' | head -1

curl -s -i -H "Authorization: Bearer $TOKEN" localhost:8080/v1/me/consents | head -1
```

Beklenen son curl: 401.

## 9. Audit verisi şifreli

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "SELECT type, granted, version, length(ip_encrypted), length(device_id_encrypted) FROM consents ORDER BY occurred_at DESC LIMIT 5;"
```

Beklenen: `ip_encrypted` length > 12 bytes (nonce + cipher + tag), düz IP görünmüyor.
```

- [ ] **Step 2: Commit**

```bash
git add docs/HAFTA6_VERIFICATION.md
git commit -m "docs: add Hafta 6 verification runbook for profile/settings backend"
```

---

## Plan complete

After Task 25 commits, the backend half of the Profile/Settings overhaul is
shipped. To verify end-to-end, follow `docs/HAFTA6_VERIFICATION.md` from
section 1 to 9. All checks should pass.

**Next:** Plan 2 (Mobile) — Profile tab, Settings root, sub-screens, register
consent UI, re-consent gate, i18n. Will be authored after Plan 1 lands.
