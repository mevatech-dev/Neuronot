package insights

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	crisiskeywords "github.com/neuronot/api/internal/insights/crisis_keywords"
)

const (
	windowDays       = 7
	minDailyLogCount = 3
	defaultListLimit = 20
	maxListLimit     = 50
)

var (
	ErrInsufficientData = errors.New("insufficient data for insight")
	ErrAIUnavailable    = errors.New("insight generator unavailable")
	ErrRateLimited      = errors.New("insight already generated today")
)

type repository interface {
	HasGeneratedToday(ctx context.Context, userID uuid.UUID, now time.Time) (bool, error)
	SummarySince(ctx context.Context, userID uuid.UUID, since time.Time) (Summary, error)
	Create(ctx context.Context, userID uuid.UUID, in Insight) (*Insight, error)
	List(ctx context.Context, userID uuid.UUID, limit int) ([]Insight, error)
}

type Generator interface {
	Generate(ctx context.Context, payload PromptPayload) (GeneratedInsight, error)
}

type Service struct {
	repo      repository
	generator Generator
	filter    SafetyFilter
	now       func() time.Time
}

func NewService(repo repository, generator Generator, filter SafetyFilter) *Service {
	return &Service{
		repo:      repo,
		generator: generator,
		filter:    filter,
		now:       func() time.Time { return time.Now().UTC() },
	}
}

func (s *Service) Generate(ctx context.Context, userID uuid.UUID, language string) (*Insight, error) {
	language = normalizeLanguage(language)
	now := s.now()

	generated, err := s.repo.HasGeneratedToday(ctx, userID, now)
	if err != nil {
		return nil, err
	}
	if generated {
		return nil, ErrRateLimited
	}

	summary, err := s.repo.SummarySince(ctx, userID, now.AddDate(0, 0, -windowDays))
	if err != nil {
		return nil, err
	}
	if summary.DailyLogCount < minDailyLogCount {
		return nil, ErrInsufficientData
	}
	if crisiskeywords.Contains(language, summary.EventNotes) {
		return crisisInsight(language), nil
	}

	out, err := s.generator.Generate(ctx, PromptPayload{
		Language:   language,
		WindowDays: windowDays,
		Summary:    summary,
	})
	if err != nil {
		return nil, ErrAIUnavailable
	}
	if out.Crisis {
		return crisisInsight(language), nil
	}

	title := strings.TrimSpace(out.Title)
	content := strings.TrimSpace(out.Content)
	if title == "" || content == "" {
		return nil, ErrAIUnavailable
	}
	if !s.filter.Allows(title) || !s.filter.Allows(content) {
		slog.Warn("insight output filtered", "user_id", userID, "language", language)
		title, content = genericInsightCopy(language)
	}

	return s.repo.Create(ctx, userID, Insight{
		Title:          title,
		Content:        content,
		Language:       language,
		SourceEventIDs: summary.SourceEventIDs,
		GeneratedAt:    now,
	})
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, limit int) ([]Insight, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}
	return s.repo.List(ctx, userID, limit)
}

func normalizeLanguage(language string) string {
	language = strings.ToLower(strings.TrimSpace(language))
	if len(language) >= 2 {
		return language[:2]
	}
	return "en"
}

func crisisInsight(language string) *Insight {
	title, content := crisisCopy(language)
	return &Insight{Title: title, Content: content, Language: normalizeLanguage(language), Crisis: true}
}

func crisisCopy(language string) (string, string) {
	switch normalizeLanguage(language) {
	case "tr":
		return "Profesyonel destek al", "Bu not acil veya ciddi bir duruma işaret edebilir. Lütfen yerel acil yardım hattı ya da güvendiğin bir sağlık profesyoneliyle hemen iletişime geç."
	default:
		return "Get professional support", "This note may point to an urgent or serious situation. Please contact local emergency support or a trusted health professional now."
	}
}

func genericInsightCopy(language string) (string, string) {
	switch normalizeLanguage(language) {
	case "tr":
		return "Takip etmeye değer bir örüntü", "Son kayıtlarında birlikte değişen bazı sinyaller görünüyor. Birkaç gün daha günlük kayıt eklemek bu örüntüyü daha anlaşılır hale getirebilir."
	default:
		return "A pattern worth tracking", "Some signals in your recent logs appear to move together. Adding a few more daily logs may make this pattern easier to understand."
	}
}
