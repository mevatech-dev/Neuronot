# Hafta 3 AI Insights Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Hafta 3 AI insights so the backend, mobile UI, safety boundaries, crisis handling, and smoke-test runbook are production-ready for the MVP.

**Architecture:** Continue the existing modular monolith and vertical-slice shape. Backend work stays in `api/internal/insights/` with handler/service/repository boundaries intact; mobile work stays in the existing Expo Router tab and i18n resource pattern. No worker, queue, Redis, web, push notification, or subscription work is in scope.

**Tech Stack:** Go 1.22, chi, pgx, goose, Anthropic Messages API over `net/http`, Expo SDK 52, React Native, TanStack Query, i18next, Bun, TypeScript.

---

## Current State

Commit `7d43d3e Add AI insights slice` already added:

- `api/migrations/00006_insights.sql`
- `api/internal/insights/` vertical slice with Anthropic adapter, prompt builder, service, repository, safety filter, crisis keyword seed list, and service tests
- `/v1/insights` and `/v1/insights/generate` routing
- `mobile/src/services/api/insights.ts`
- `mobile/app/(tabs)/insights.tsx`
- `mobile/src/locales/en/insights.json`
- `mobile/src/locales/tr/insights.json`
- i18n registration for `insights`

Known remaining gaps:

- Anthropic adapter has no unit test for HTTP failure, JSON fence parsing, empty response, or non-JSON body.
- Crisis copy and keyword lists are centralized in one file; architecture expects language-specific crisis keyword files with review notes.
- Mobile has `insights` namespace but no `crisis` namespace yet, despite `CLAUDE.md` requiring it.
- `docs/HAFTA3_VERIFICATION.md` does not exist.
- No API smoke runbook covers applying migration `00006`, generating insight with insufficient data, rate limit, AI unavailable, and crisis bypass.

---

## File Map

- Modify: `api/internal/insights/anthropic.go`  
  Make the Anthropic generator testable with an injected HTTP client and stable model constant.

- Create: `api/internal/insights/anthropic_test.go`  
  Cover JSON fence parsing, HTTP 500, empty content, invalid JSON, and successful JSON response.

- Modify: `api/internal/insights/crisis_keywords/keywords.go`  
  Move language data out of this file and keep only lookup/normalization behavior.

- Create: `api/internal/insights/crisis_keywords/en.go`
- Create: `api/internal/insights/crisis_keywords/tr.go`
- Create: `api/internal/insights/crisis_keywords/es.go`
- Create: `api/internal/insights/crisis_keywords/de.go`
- Create: `api/internal/insights/crisis_keywords/fr.go`
- Create: `api/internal/insights/crisis_keywords/pt.go`
- Create: `api/internal/insights/crisis_keywords/it.go`
- Create: `api/internal/insights/crisis_keywords/ar.go`
- Create: `api/internal/insights/crisis_keywords/ru.go`
- Create: `api/internal/insights/crisis_keywords/ja.go`
- Create: `api/internal/insights/crisis_keywords/zh.go`  
  One file per language, each with explicit review status header.

- Create: `api/internal/insights/crisis_keywords/keywords_test.go`  
  Cover language fallback, Turkish keyword detection, and non-crisis text.

- Modify: `api/internal/insights/service.go`  
  Use crisis copy from a small response catalog instead of inline switch if the service grows during crisis namespace work.

- Create: `mobile/src/locales/en/crisis.json`
- Create: `mobile/src/locales/tr/crisis.json`  
  Add user-visible crisis support copy for en/tr only in this slice.

- Modify: `mobile/src/i18n/index.ts`  
  Register `crisis` namespace for en/tr and include it in `ns`.

- Modify: `mobile/app/(tabs)/insights.tsx`  
  Render crisis insight cards with localized label/body/action copy from `crisis` namespace while keeping the backend-provided crisis card content visible.

- Create: `docs/HAFTA3_VERIFICATION.md`  
  Add backend, mobile, AI-unavailable, insufficient-data, rate-limit, and crisis smoke test steps.

---

### Task 1: Anthropic Generator Unit Coverage

**Files:**
- Modify: `api/internal/insights/anthropic.go`
- Create: `api/internal/insights/anthropic_test.go`

- [ ] **Step 1: Write failing tests for response parsing and error paths**

Create `api/internal/insights/anthropic_test.go`:

```go
package insights

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStripJSONFence(t *testing.T) {
	got := stripJSONFence("```json\n{\"title\":\"A\",\"content\":\"B\",\"crisis\":false}\n```")
	want := "{\"title\":\"A\",\"content\":\"B\",\"crisis\":false}"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestAnthropicGeneratorParsesSuccessfulJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "test-key" {
			t.Fatalf("missing api key header")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":"{\"title\":\"Pattern\",\"content\":\"Focus and sleep moved together.\",\"crisis\":false}"}]}`))
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	out, err := gen.Generate(context.Background(), PromptPayload{Language: "en", WindowDays: 7, Summary: Summary{DailyLogCount: 3}})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if out.Title != "Pattern" || out.Content == "" || out.Crisis {
		t.Fatalf("unexpected output: %+v", out)
	}
}

func TestAnthropicGeneratorReturnsUnavailableOnHTTPFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	_, err := gen.Generate(context.Background(), PromptPayload{Language: "en"})
	if err != ErrAIUnavailable {
		t.Fatalf("got %v want ErrAIUnavailable", err)
	}
}

func TestAnthropicGeneratorRejectsEmptyText(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":[{"type":"text","text":""}]}`))
	}))
	defer server.Close()

	gen := NewAnthropicGenerator("test-key")
	gen.endpoint = server.URL

	_, err := gen.Generate(context.Background(), PromptPayload{Language: "en"})
	if err == nil {
		t.Fatalf("expected error for empty response")
	}
}
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./internal/insights
```

Expected: FAIL because `AnthropicGenerator` does not have an `endpoint` field.

- [ ] **Step 3: Add injectable endpoint to the generator**

Modify `api/internal/insights/anthropic.go`:

```go
type AnthropicGenerator struct {
	apiKey   string
	model    string
	endpoint string
	client   *http.Client
}

func NewAnthropicGenerator(apiKey string) *AnthropicGenerator {
	return &AnthropicGenerator{
		apiKey:   apiKey,
		model:    "claude-sonnet-4-6",
		endpoint: anthropicMessagesURL,
		client:   &http.Client{Timeout: 30 * time.Second},
	}
}
```

Then replace:

```go
req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicMessagesURL, bytes.NewReader(b))
```

with:

```go
req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.endpoint, bytes.NewReader(b))
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./internal/insights
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add api/internal/insights/anthropic.go api/internal/insights/anthropic_test.go
git commit -m "Test Anthropic insight generator"
```

---

### Task 2: Split Crisis Keywords by Language

**Files:**
- Modify: `api/internal/insights/crisis_keywords/keywords.go`
- Create: `api/internal/insights/crisis_keywords/en.go`
- Create: `api/internal/insights/crisis_keywords/tr.go`
- Create: `api/internal/insights/crisis_keywords/es.go`
- Create: `api/internal/insights/crisis_keywords/de.go`
- Create: `api/internal/insights/crisis_keywords/fr.go`
- Create: `api/internal/insights/crisis_keywords/pt.go`
- Create: `api/internal/insights/crisis_keywords/it.go`
- Create: `api/internal/insights/crisis_keywords/ar.go`
- Create: `api/internal/insights/crisis_keywords/ru.go`
- Create: `api/internal/insights/crisis_keywords/ja.go`
- Create: `api/internal/insights/crisis_keywords/zh.go`
- Create: `api/internal/insights/crisis_keywords/keywords_test.go`

- [ ] **Step 1: Write failing tests for keyword lookup**

Create `api/internal/insights/crisis_keywords/keywords_test.go`:

```go
package crisis_keywords

import "testing"

func TestContainsDetectsTurkishCrisisText(t *testing.T) {
	if !Contains("tr", []string{"Bugün kendime zarar vermekten korkuyorum"}) {
		t.Fatalf("expected Turkish crisis keyword to match")
	}
}

func TestContainsFallsBackToEnglishForUnknownLanguage(t *testing.T) {
	if !Contains("xx", []string{"I might harm myself"}) {
		t.Fatalf("expected unknown language to fall back to English")
	}
}

func TestContainsIgnoresNonCrisisText(t *testing.T) {
	if Contains("en", []string{"Headache after a short night of sleep"}) {
		t.Fatalf("expected non-crisis note to be ignored")
	}
}
```

- [ ] **Step 2: Run tests and verify current behavior**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./internal/insights/crisis_keywords
```

Expected before refactor: PASS. This protects behavior before splitting files.

- [ ] **Step 3: Move English keywords into `en.go`**

Create `api/internal/insights/crisis_keywords/en.go`:

```go
package crisis_keywords

// Review status: seed list, needs native clinical/safety review before production.
var enKeywords = []string{
	"kill myself",
	"harm myself",
	"suicide",
	"end my life",
	"sudden confusion",
	"one-sided weakness",
	"trouble speaking",
}
```

- [ ] **Step 4: Move Turkish keywords into `tr.go`**

Create `api/internal/insights/crisis_keywords/tr.go`:

```go
package crisis_keywords

// Review status: seed list, Turkish native review required before production.
var trKeywords = []string{
	"kendime zarar",
	"intihar",
	"hayatıma son",
	"ani bilinç",
	"tek taraflı güçsüzlük",
	"konuşma bozukluğu",
}
```

- [ ] **Step 5: Add the remaining language files**

Create each file with the exact package name and review header:

```go
package crisis_keywords

// Review status: seed list, native review required before production.
var esKeywords = []string{
	"suicidio",
	"hacerme daño",
	"quitarme la vida",
	"debilidad en un lado",
}
```

Use matching variable names for each file:

- `deKeywords`: `suizid`, `mir schaden`, `einseitige schwäche`, `sprachstörung`
- `frKeywords`: `suicide`, `me faire du mal`, `faiblesse d'un côté`, `trouble de la parole`
- `ptKeywords`: `suicídio`, `me machucar`, `tirar minha vida`, `fraqueza de um lado`
- `itKeywords`: `suicidio`, `farmi del male`, `togliermi la vita`, `debolezza da un lato`
- `arKeywords`: `انتحار`, `إيذاء نفسي`, `ضعف في جهة واحدة`, `صعوبة في الكلام`
- `ruKeywords`: `суицид`, `навредить себе`, `покончить с собой`, `слабость с одной стороны`
- `jaKeywords`: `自殺`, `自分を傷つける`, `片側の脱力`, `話しにくい`
- `zhKeywords`: `自杀`, `伤害自己`, `结束生命`, `单侧无力`, `说话困难`

- [ ] **Step 6: Keep only lookup logic in `keywords.go`**

Replace the map in `api/internal/insights/crisis_keywords/keywords.go` with:

```go
var byLanguage = map[string][]string{
	"en": enKeywords,
	"tr": trKeywords,
	"es": esKeywords,
	"de": deKeywords,
	"fr": frKeywords,
	"pt": ptKeywords,
	"it": itKeywords,
	"ar": arKeywords,
	"ru": ruKeywords,
	"ja": jaKeywords,
	"zh": zhKeywords,
}
```

Keep `Contains` as the public API.

- [ ] **Step 7: Run tests and format**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
gofmt -w internal/insights/crisis_keywords
go test ./internal/insights/crisis_keywords ./internal/insights
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add api/internal/insights/crisis_keywords
git commit -m "Split crisis keywords by language"
```

---

### Task 3: Add Mobile Crisis Namespace and Crisis Card Treatment

**Files:**
- Create: `mobile/src/locales/en/crisis.json`
- Create: `mobile/src/locales/tr/crisis.json`
- Modify: `mobile/src/i18n/index.ts`
- Modify: `mobile/app/(tabs)/insights.tsx`

- [ ] **Step 1: Add English crisis locale**

Create `mobile/src/locales/en/crisis.json`:

```json
{
  "label": "Support",
  "title": "Get professional support",
  "body": "This note may point to an urgent or serious situation. Please contact local emergency support or a trusted health professional now.",
  "card_hint": "Neuronot cannot evaluate emergencies or provide medical guidance."
}
```

- [ ] **Step 2: Add Turkish crisis locale**

Create `mobile/src/locales/tr/crisis.json`:

```json
{
  "label": "Destek",
  "title": "Profesyonel destek al",
  "body": "Bu not acil veya ciddi bir duruma işaret edebilir. Lütfen yerel acil yardım hattı ya da güvendiğin bir sağlık profesyoneliyle hemen iletişime geç.",
  "card_hint": "Neuronot acil durum değerlendirmesi yapamaz ve tıbbi yönlendirme vermez."
}
```

- [ ] **Step 3: Register `crisis` namespace**

Modify `mobile/src/i18n/index.ts` imports:

```ts
import enCrisis from '@/locales/en/crisis.json';
import trCrisis from '@/locales/tr/crisis.json';
```

Add resources:

```ts
en: {
  common: enCommon,
  crisis: enCrisis,
  errors: enErrors,
  onboarding: enOnboarding,
  'daily-log': enDailyLog,
  events: enEvents,
  insights: enInsights,
  timeline: enTimeline,
},
tr: {
  common: trCommon,
  crisis: trCrisis,
  errors: trErrors,
  onboarding: trOnboarding,
  'daily-log': trDailyLog,
  events: trEvents,
  insights: trInsights,
  timeline: trTimeline,
},
```

Update namespace list:

```ts
ns: ['common', 'errors', 'onboarding', 'daily-log', 'events', 'timeline', 'insights', 'crisis'],
```

- [ ] **Step 4: Render localized crisis hint in InsightCard**

Modify `mobile/app/(tabs)/insights.tsx`:

```tsx
function InsightCard({ item }: { item: InsightResponse }) {
  const theme = useTheme();
  const { t } = useTranslation(['crisis']);

  return (
    <View
      style={{
        padding: theme.space[5],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: item.crisis ? theme.colors.warning.default : theme.colors.border.subtle,
        backgroundColor: theme.colors.surface.elevated,
      }}
    >
      {item.crisis && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.warning.default, marginBottom: theme.space[2] }}>
          {t('label', { ns: 'crisis' })}
        </Text>
      )}
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>
        {item.title}
      </Text>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, marginTop: theme.space[2] }}>
        {item.content}
      </Text>
      {item.crisis && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginTop: theme.space[3] }}>
          {t('card_hint', { ns: 'crisis' })}
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Run mobile checks**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add mobile/src/locales/en/crisis.json mobile/src/locales/tr/crisis.json mobile/src/i18n/index.ts 'mobile/app/(tabs)/insights.tsx'
git commit -m "Add mobile crisis namespace"
```

---

### Task 4: Add Hafta 3 Verification Runbook

**Files:**
- Create: `docs/HAFTA3_VERIFICATION.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create Hafta 3 runbook**

Create `docs/HAFTA3_VERIFICATION.md`:

```markdown
# Hafta 3 Verification Runbook

Hafta 3: AI insight + multilingual prompt + safety filter + crisis boundary smoke test.

## Ön Koşul

Hafta 2 verification başarıyla tamamlanmış olmalı. `api/.env` içinde `DATABASE_URL`, `JWT_SECRET`, opsiyonel olarak `ANTHROPIC_API_KEY` bulunmalı.

## 1. Migration

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
```

Beklenen: `00006_insights.sql` uygulanır ve `insights` tablosu oluşur.

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot -c "\d insights"
```

## 2. Automated Checks

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...

cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Beklenen: üç komut da PASS.

## 3. API Smoke: Auth Token

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
```

## 4. Insufficient Data Case

```bash
curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: 7 günde 3'ten az daily log varsa `INSIGHT_INSUFFICIENT_DATA`.

## 5. AI Unavailable Case

`ANTHROPIC_API_KEY` boşken ve kullanıcıda en az 3 daily log varken:

```bash
curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: `INSIGHT_AI_UNAVAILABLE`.

## 6. Crisis Bypass Case

Kullanıcıya 3 daily log ekle, sonra kriz keyword içeren event ekle:

```bash
curl -s -X POST localhost:8080/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"brain_fog","intensity":3,"note":"I might harm myself"}'

curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: HTTP 200, `crisis: true`, AI çağrısı gerekmeden destek kartı.

## 7. Mobile Smoke

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun start
```

1. Expo Go veya development build ile uygulamayı aç.
2. En az 3 daily log olan kullanıcıyla giriş yap.
3. Insights tabına git.
4. `Generate insight` butonuna bas.
5. AI unavailable durumunda lokalize hata metni gösterilir.
6. Kaydedilmiş insight varsa latest card ve history listesi görünür.
7. Crisis insight varsa sarı uyarı border'ı ve crisis namespace hint metni görünür.

## Çıkış Kriterleri

- [ ] `00006_insights.sql` uygulanıyor.
- [ ] `go test ./...` geçiyor.
- [ ] `bun run typecheck` geçiyor.
- [ ] `bun run lint` geçiyor.
- [ ] `/v1/insights` list endpoint'i envelope döndürüyor.
- [ ] `/v1/insights/generate` insufficient data, AI unavailable, rate limit ve crisis bypass yollarında doğru error/code/body döndürüyor.
- [ ] Mobile Insights tabı empty, loading, error, latest, history ve crisis state'lerini gösteriyor.
```

- [ ] **Step 2: Link runbook from CLAUDE.md**

Modify the runbook sentence in `CLAUDE.md` only if it needs to explicitly mention Hafta 3. The current generic sentence is already acceptable:

```md
Verification runbooks are per-week and authoritative for the smoke test that should pass when work claims "done": `docs/HAFTA1_VERIFICATION.md`, `docs/HAFTA2_VERIFICATION.md`, etc.
```

If changing it, use:

```md
Verification runbooks are per-week and authoritative for the smoke test that should pass when work claims "done": `docs/HAFTA1_VERIFICATION.md`, `docs/HAFTA2_VERIFICATION.md`, `docs/HAFTA3_VERIFICATION.md`, etc.
```

- [ ] **Step 3: Run docs sanity checks**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
rg -n "PLACEHOLDER_MARKER|DEFERRED_WITHOUT_SCOPE|UNFILLED_SECTION" docs/HAFTA3_VERIFICATION.md CLAUDE.md
git diff --check
```

Expected: `rg` returns no placeholder lines and `git diff --check` has no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add docs/HAFTA3_VERIFICATION.md CLAUDE.md
git commit -m "Add Hafta 3 verification runbook"
```

---

### Task 5: Final Hafta 3 Validation and Push

**Files:**
- No new files expected.

- [ ] **Step 1: Run full backend checks**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Expected: PASS.

- [ ] **Step 2: Run full mobile checks**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Expected: PASS.

- [ ] **Step 3: Review working tree**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git status --short
git log --oneline -5
```

Expected: only intended files are changed. Do not add untracked `AGENTS.md` unless the user explicitly asks for it.

- [ ] **Step 4: Push main**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git push origin main
```

Expected: `main -> main`.

---

## Self-Review

- Spec coverage: PRD AI safety, Architecture Hafta 3, CLAUDE prompt discipline, crisis boundary, i18n namespace, and verification runbook all have tasks.
- Placeholder scan: no unfilled implementation instructions are present.
- Type consistency: Go types match current `insights` package names: `PromptPayload`, `Summary`, `GeneratedInsight`, `ErrAIUnavailable`, `AnthropicGenerator`. Mobile types match `InsightResponse` and current i18n setup.
- Scope control: no worker, Redis, web, admin, push, HealthKit, subscription, or file upload work is included.
