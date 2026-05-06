package insights

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeRepository struct {
	generatedToday bool
	summary        Summary
	created        *Insight
}

func (f *fakeRepository) HasGeneratedToday(context.Context, uuid.UUID, time.Time) (bool, error) {
	return f.generatedToday, nil
}

func (f *fakeRepository) SummarySince(context.Context, uuid.UUID, time.Time) (Summary, error) {
	return f.summary, nil
}

func (f *fakeRepository) Create(_ context.Context, userID uuid.UUID, in Insight) (*Insight, error) {
	in.ID = uuid.New()
	in.UserID = userID
	if in.GeneratedAt.IsZero() {
		in.GeneratedAt = time.Now().UTC()
	}
	f.created = &in
	return &in, nil
}

func (f *fakeRepository) List(context.Context, uuid.UUID, int) ([]Insight, error) {
	return nil, nil
}

type fakeGenerator struct {
	called bool
	out    GeneratedInsight
	err    error
}

func (f *fakeGenerator) Generate(context.Context, PromptPayload) (GeneratedInsight, error) {
	f.called = true
	if f.err != nil {
		return GeneratedInsight{}, f.err
	}
	return f.out, nil
}

func TestGenerateRequiresAtLeastThreeDailyLogs(t *testing.T) {
	repo := &fakeRepository{summary: Summary{DailyLogCount: 2}}
	gen := &fakeGenerator{}
	svc := NewService(repo, gen, NewSafetyFilter())

	_, err := svc.Generate(context.Background(), uuid.New(), "en")

	if !errors.Is(err, ErrInsufficientData) {
		t.Fatalf("expected ErrInsufficientData, got %v", err)
	}
	if gen.called {
		t.Fatalf("generator should not run when data is insufficient")
	}
}

func TestGenerateBypassesAIWhenCrisisNoteDetected(t *testing.T) {
	repo := &fakeRepository{
		summary: Summary{
			DailyLogCount: 3,
			EventNotes:    []string{"I might harm myself tonight"},
		},
	}
	gen := &fakeGenerator{}
	svc := NewService(repo, gen, NewSafetyFilter())

	insight, err := svc.Generate(context.Background(), uuid.New(), "en")

	if err != nil {
		t.Fatalf("expected crisis response without error, got %v", err)
	}
	if gen.called {
		t.Fatalf("generator should not run when crisis text is detected")
	}
	if !insight.Crisis {
		t.Fatalf("expected crisis flag")
	}
	if repo.created != nil {
		t.Fatalf("crisis card should not be persisted as an insight")
	}
}

func TestGeneratePersistsSafeGeneratedInsight(t *testing.T) {
	repo := &fakeRepository{summary: Summary{DailyLogCount: 3, AverageFocus: 2.7, AverageSleepQuality: 2.1}}
	gen := &fakeGenerator{out: GeneratedInsight{
		Title:   "Uyku ve odak birlikte değişiyor",
		Content: "Son günlerde düşük uyku kalitesi ile odak düşüşü aynı günlerde artmış görünüyor.",
	}}
	svc := NewService(repo, gen, NewSafetyFilter())

	insight, err := svc.Generate(context.Background(), uuid.New(), "tr")

	if err != nil {
		t.Fatalf("expected generated insight, got %v", err)
	}
	if !gen.called {
		t.Fatalf("expected generator call")
	}
	if repo.created == nil {
		t.Fatalf("expected persisted insight")
	}
	if insight.Language != "tr" {
		t.Fatalf("expected language tr, got %q", insight.Language)
	}
}
