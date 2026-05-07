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
	got, err := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if err != nil {
		t.Fatal(err)
	}
	if got {
		t.Fatal("stale version should not count as granted")
	}
}

func TestIsGranted_Revoked(t *testing.T) {
	svc := NewService(&fakeRepo{latest: map[ConsentType]Consent{
		ConsentTypeAIUsage: {Granted: false, Version: CurrentVersions[ConsentTypeAIUsage]},
	}})
	got, err := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if err != nil {
		t.Fatal(err)
	}
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
	// come back as Granted=false / empty version / nil OccurredAt.
	var aiRow ConsentResponse
	for _, r := range out {
		if r.Type == ConsentTypeAIUsage {
			aiRow = r
		} else if r.Granted {
			t.Fatalf("expected default false for %s, got %+v", r.Type, r)
		} else if r.OccurredAt != nil {
			t.Fatalf("expected nil OccurredAt for never-granted %s, got %+v", r.Type, r)
		}
	}
	if !aiRow.Granted {
		t.Fatal("AI row should be granted")
	}
	if aiRow.OccurredAt == nil {
		t.Fatal("AI row should have non-nil OccurredAt")
	}
}

func TestIsGranted_RepoError(t *testing.T) {
	repo := &fakeRepo{latestErr: errors.New("db boom")}
	svc := NewService(repo)
	_, err := svc.IsGranted(context.Background(), uuid.New(), ConsentTypeAIUsage)
	if err == nil || err.Error() == "consent not found" {
		t.Fatalf("expected repo error to surface, got %v", err)
	}
}

func TestAll_RepoError(t *testing.T) {
	repo := &fakeRepo{latestErr: errors.New("db boom")}
	svc := NewService(repo)
	if _, err := svc.All(context.Background(), uuid.New()); err == nil {
		t.Fatal("expected repo error to surface from All")
	}
}
