# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Neuronot is — and is not

Neuronot is a mobile-first **personal awareness** app: users log cognitive state (focus, energy, forgetfulness, stress, sleep, headache, brain fog) and an LLM (OpenAI gpt-4.1-mini) generates short pattern insights from the last 7 days. It is **not** a diagnosis, treatment, or medical decision tool. This boundary shapes data, UI copy, and AI output — see `docs/PRD.md` (especially §6 Non-Goals, §15 AI Safety Boundary, §16 Emergency Boundary).

When in doubt about *what to build*, read `docs/PRD.md`. When in doubt about *how to build it*, read `docs/ARCHITECTURE.md`. These two are the source of truth — this file summarizes the rules; the docs explain why.

## Common commands

All `make` targets run from the repo root.

```bash
make db-up           # start postgres:18-alpine via docker-compose
make db-migrate      # apply all pending goose migrations
make db-rollback     # roll back one migration
make db-reset        # drop volume + restart + migrate (DESTRUCTIVE)
make api-dev         # go run ./cmd/api  (port 8080)
make api-build       # build api binary into api/bin/
make api-test        # go test ./...
make mobile-dev      # bun start (Expo dev server)
make lint            # golangci-lint (api) + eslint (mobile)
make test            # api-test + mobile jest
```

Single-test invocations bypass `make`:

```bash
# Single Go test (table-driven; use the regex form)
cd api && go test -run TestServiceLogin ./internal/auth/...

# Single Jest test (mobile)
cd mobile && bun jest path/to/file.test.tsx -t "test name fragment"

# Mobile typecheck only
cd mobile && bun run typecheck

# Mobile i18n coverage only
cd mobile && bun run validate:i18n

# Mobile native asset generation/check (Neuro mascot pipeline)
cd mobile && bun run generate:assets
cd mobile && bun run validate:assets

# Single migration check (no apply)
cd api && goose -dir migrations postgres "$DATABASE_URL" status
```

`.env` lives at `api/.env` (gitignored, copy from `api/.env.example`). Required: `DATABASE_URL`, `JWT_SECRET` (≥32 chars). `OPENAI_API_KEY` is required for `/v1/insights/generate` (the AI insight pipeline).

Verification runbooks are per-week and authoritative for the smoke test that should pass when work claims "done": `docs/HAFTA1_VERIFICATION.md`, `docs/HAFTA2_VERIFICATION.md`, `docs/HAFTA3_VERIFICATION.md`, `docs/HAFTA4_VERIFICATION.md`, etc.

## Architecture in one diagram

```
┌─────────────────┐    HTTPS /v1     ┌─────────────────┐    pgx pool    ┌─────────────────┐
│  mobile/  Expo  │ ◄──────────────► │  api/  Go (chi) │ ◄────────────► │  Postgres 18    │
│  - Expo Router  │   JWT Bearer     │  - vertical     │   goose mig    │  - users        │
│  - Zustand      │                  │    slices       │                │  - daily_logs   │
│  - TanStack Q   │                  │  - 3-layer      │                │  - events       │
│  - i18next      │                  │    h/s/r        │                │  - insights*    │
│  - Theme tokens │                  │  - OpenAI       │                └─────────────────┘
└─────────────────┘                  │    SDK (sync)*  │
                                     └─────────────────┘
                                              │
                                       OpenAI Chat Completions*
                                       (Hafta 3+: insight gen)

worker/  ─── README only, deferred (batch insight, queue)
web/     ─── README only, deferred (Next.js dashboard)
```

\* Hafta 3+ scope. Worker, web, Redis, object storage (Cloudflare R2), and email (Cloudflare Email) are intentionally absent — their folders carry only a README explaining the trigger that would resurrect them. **Do not scaffold worker or web code without an ADR justifying the trigger.** See `docs/adr/0001-modular-monolith.md`.

## The vertical-slice + three-layer rule

Every API feature lives in `api/internal/<feature>/` with exactly five files:

```
auth/
├─ dto.go         # request/response — the API contract clients depend on
├─ handler.go     # HTTP only: decode body, call service, write envelope
├─ service.go     # business logic, validation, authorization, AI orchestration
├─ repository.go  # the only place SQL is written
└─ types.go       # internal domain structs, never serialized to JSON
```

Five files. No `usecase.go`, no `mapper.go`, no DI container. The reference implementation is `api/internal/auth/` (Hafta 1) — copy its shape when adding a new feature. The cross-feature aggregator pattern (timeline) lives in `api/internal/timeline/` and only depends on *services* of other slices, never repositories.

Layer rules — **violating these is a review block**:

- **Handler** knows HTTP. Never import `pgx`, never write SQL, never call other features' repositories.
- **Service** knows the domain. Never import `net/http`, never see `*sql.Rows`. Validation, authorization, AI calls, and orchestration go here.
- **Repository** knows SQL. Takes `*pgxpool.Pool` (or `pgx.Tx`), returns domain structs. No business decisions.

DTOs (`dto.go`) and domain types (`types.go`) are **distinct on purpose**. DTO is the wire contract; changing it breaks clients. Domain type is internal; refactor freely. Don't reuse one for the other.

## Authorization — 404, not 403

`api/internal/http/middleware/auth.go` parses the JWT and injects `userID` via context. Every authenticated request *must* pass user_id into the SQL `WHERE` clause:

```go
// CORRECT — A user looking up B's row simply doesn't match
DELETE FROM events WHERE id = $1 AND user_id = $2
```

When the row doesn't match, return `httpx.NotFound(w)`, not 403. PRD §9 forbids leaking existence of other users' resources. The pattern is in `api/internal/events/repository.go` (`Delete` method).

Public routes (`/health`, `/v1/auth/*`) are an explicit allowlist in `api/internal/http/router.go`. The authenticated group lives below the `RequireAuth` middleware boundary.

## Cursor pagination

`api/internal/http/cursor.go` is the shared cursor helper — `httpx.EncodeCursor` / `httpx.DecodeCursor`. Cursor is base64(`timestamp|uuid`); the UUID tie-breaks duplicate timestamps so pagination is stable. **Never expose offset pagination** — timeline scrolls are append-only and cursors keep them correct under concurrent writes.

Each `repository.List` takes `(beforeAt, beforeID, limit)` and the SQL uses tuple comparison: `(occurred_at, id) < ($2, $3)`. This is the canonical shape; don't invent variants.

## Response envelope

Every response — success or error — has the same shape (`api/internal/http/response.go`):

```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "code": "...", "message_key": "...", "message": "..." } }
```

`message_key` is the i18n lookup the client uses; `message` is an English fallback. Error codes are catalogued in `docs/api-errors.md` — add new ones there before using them. Mobile reads `error.message_key` via `t(key, { ns: 'errors' })`; never let server English text reach the user UI.

## Mobile theme — semantic tokens only

Theme has two layers (`mobile/src/theme/`):

1. **Primitives** in `tokens.ts` — palette (`gray.950`, `blue.500`), spacing scale, radius, font scale. RN-API-free so they can later move to a `packages/theme-tokens` shared with `/web`.
2. **Semantic** in `dark.ts` / `light.ts` — `surface.primary`, `text.primary`, `accent.default`, etc.

**Components consume only semantic tokens**, accessed via `useTheme()` from `@/theme`. Inline hex (`backgroundColor: '#...'`) and primitive imports (`tokens.colors.gray[900]`) in components are review-blocked. If a new color is needed, add it to `tokens.ts`, expose it via the semantic file, then consume it. Default theme is **soft dark** (PRD §19) — surfaces near `#0F1115`, never pure black; text `#E6E8EC`, never pure white.

## Mascot — semantic moods only

Neuro mascot usage goes through `mobile/src/components/brand/NeuroMascot/`. Screens never import `mobile/assets/images/neuro-*.png` directly; they pass a semantic `mood` (`calm`, `happy`, `thinking`, `encouraging`, `sleepy`, `sad`). Crisis/safety surfaces use only `calm`. Generated native assets (`icon.png`, `adaptive-icon.png`, `splash.png`) are produced via `bun run generate:assets`.

## Per-unit folder pattern (mobile)

Every component, hook, util, repo, store slice lives in its own folder. Pattern: `Foo/Foo.tsx` + `Foo/index.ts` (re-export). Imports go to the folder, not the file: `from '@/components/feedback/Skeleton'`. The only exception is `mobile/app/`, where Expo Router treats the file path as the route. Future siblings (tests, types, styles, sub-components) drop into the same folder without restructuring.

## Typography — Nunito Sans

`@expo-google-fonts/nunito-sans` is preloaded in `_layout.tsx` via `useFonts`. The splash stays up until fonts and auth hydration are ready. `theme.typography.*` includes `fontFamily` from `theme.tokens.fontFamily.{regular,medium,semibold,bold}`. Components consume `...theme.typography.body` / `bodyMedium` / etc. — never set `fontFamily` inline.

## Offline & sync

Mobile mirrors syncable tables (daily_logs, events, insights, profile) into a local SQLite cache at `mobile/src/services/cache/`. `mobile/src/services/sync/engine.runCycle()` does push (dirty rows) → pull (`?since=<lastSyncAt>`) on app foreground, network-online, mutation `onSettled`, and a 5-minute timer. UI never imports `services/cache` or `services/sync` directly — it goes through `features/<x>/queries/` (TanStack Query options objects). Conflict policy is last-write-wins with server tie-break.

## i18n — hardcoded strings are forbidden

11 languages (`mobile/src/i18n/index.ts`, resources in `mobile/src/i18n/resources.ts`): `en`, `tr` are native-quality; `es de fr` planned for native review; `pt it ru ja zh` LLM-translated + skim review; `ar` is RTL and ships with a Beta marker. All UI strings go through `t('namespace.key')`. The lint rule `i18next/no-literal-string` (configured in `mobile/eslint.config.js`) blocks raw text in JSX.

Namespaces are per-feature: `common`, `errors`, `onboarding`, `daily-log`, `events`, `timeline`, `insights`, `crisis`. Each feature owns one JSON file per locale. When adding a feature, create the namespace in **en first** as the source of truth, then add `tr` natively and fill the other supported locales before shipping. Run `cd mobile && bun run validate:i18n` after locale changes.

Dates, numbers, and relative times use `Intl.*Format` (see `mobile/src/features/timeline/utils.ts`). Manual format strings are wrong in some locales — don't write them.

RTL: only `ar` flips today. Use `marginStart`/`marginEnd`, never `marginLeft`/`marginRight`. `flexDirection: 'row'` auto-flips; never write `'row-reverse'` to force it.

## AI integration (Hafta 3+)

System prompt is a versioned constant in `api/internal/insights/prompts.go`. The user's `preferred_language` is injected into the prompt; the model returns JSON in that language and the insight is persisted with the language tag. Pipeline order (in `service.go`):

1. Aggregate last 7 days into a structured payload — **PII-free**: only categorized symptom counts and averages, never email, name, or location.
2. Crisis keyword pre-check on user notes (input side) using `crisis_keywords/<lang>.go`.
3. OpenAI Chat Completions call (`gpt-4.1-mini` with Structured Outputs, `max_tokens` 800, `temperature` 0.4, 30s timeout, 1 retry).
4. JSON parse — fail → return generic "couldn't generate" in user's locale.
5. If output `{"crisis": true}`, bypass content and return crisis-card response.
6. Post-LLM safety filter (`safety_filter.go`) — regex + category list rejects disease names, drug names, "you have X" patterns. Filtered output is replaced with generic insight + logged.
7. Persist with `language` tag.

**Forbidden in any AI surface**: diagnosis, drug names, condition names, "you should take X", causal claims about symptoms. The filter is a backstop; the prompt is the primary defense.

Crisis keyword files live in `api/internal/insights/crisis_keywords/{lang}.go`. Each must be reviewed by a native speaker — ML translation is not enough for this layer. The list grows; review notes go in the file header.

## Database conventions

PostgreSQL 18, migrations in `api/migrations/` via goose, format `NNNNN_name.sql` with `-- +goose Up` / `-- +goose Down` blocks. Both directions must be filled — irreversible migrations require an ADR.

Standard columns: `id uuid PK DEFAULT uuidv7()`, `user_id uuid REFERENCES users(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`. Time-series tables index `(user_id, <time> DESC)` — that's what timeline and pagination scan.

UUIDs are **v7** (PostgreSQL 18 native `uuidv7()` — no extension needed). The 48-bit timestamp prefix means new rows cluster at the right edge of the B-tree, which keeps INSERT cost flat as tables grow. The column type stays `uuid` (16 bytes); cursor pagination still uses the `(occurred_at, id)` tuple — the timestamp prefix is a bonus, not the primary sort. Don't switch back to `gen_random_uuid()`; don't reach for ULID strings.

The only Postgres extension we install is `citext` (`infra/postgres/init.sql`) for case-insensitive email lookup. `pgcrypto` is intentionally absent: encrypted audit columns are encrypted in Go (AES-256-GCM, see `internal/crypto/aesgcm`), and bcrypt cost-10 password hashes come from `golang.org/x/crypto/bcrypt`.

## Deferred / out of scope

These are intentionally absent. Adding any of them needs a justification (ADR or matching trigger):

| Item | Trigger to revisit |
|---|---|
| Worker process | Insight generation >10s, batch jobs, push notification scheduling |
| Redis | API p95 latency consistently >200ms, or queue/pubsub need |
| Cloudflare R2 (object storage) | First feature requiring user-uploaded files or off-DB export artifacts. **The self-hosted target VM does not run MinIO** — R2 is the chosen backend; we use the AWS S3 SDK against the R2 S3-compatible endpoint (`<account>.r2.cloudflarestorage.com`). Required env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. |
| Cloudflare Email (transactional email) | First feature requiring outbound mail (password-reset link, account-deletion confirmation, "your export is ready"). **Cloudflare's email-sending product is the chosen provider** — we do not run an SMTP server. Inbound (Email Routing) is configured only when `support@` aliasing is needed. |
| Web dashboard | First customer asking for web access |
| Admin panel | Operations that can no longer be done with SQL |
| Subscription / RevenueCat | Revenue scope for v2 |
| HealthKit / Google Fit sync | v2 scope |
| Push notification | v2 scope |
| 12th language | Not before all 11 are native-reviewed |

Don't preemptively add abstractions for these. Don't add an interface "in case we swap the DB". The codebase is a 5-week MVP and YAGNI is a hard rule.

## Source-of-truth files

- `docs/PRD.md` — product scope, non-goals, AI/emergency boundaries
- `docs/ARCHITECTURE.md` — patterns, stack decisions, theme/i18n rules
- `docs/api-errors.md` — error code catalog (extend before inventing new codes)
- `docs/adr/` — architectural decisions and why (start here before refactoring)
- `docs/HAFTA{N}_VERIFICATION.md` — what "done" means for week N
- `worker/README.md`, `web/README.md` — what those folders mean (still empty)
