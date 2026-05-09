# Neuronot Architecture

## 1. Purpose

Bu doküman Neuronot'un mimari sınırlarını tanımlar. Amaç:

1. 5 hafta içinde TestFlight'a giden çalışan bir ürün ortaya çıkarmak.
2. Sonradan eklenecek modüllerin (worker, web, admin, cache, dosya) karma çorba üretmemesi için klasör ve pattern iskeletini bugünden oturtmak.

Neuronot bir tanı veya tedavi sistemi değildir. Sistem yalnızca kullanıcının kendi verisinden gözlemlenebilir, düşük riskli ve kişisel farkındalık odaklı içgörüler üretir.

---

## 2. Philosophy

- **Boring tech, predictable patterns.**
- **Modular monolith, microservice değil.** API tek binary olarak başlar.
- **Klasör hazır, servis sonra.** Worker, web, admin gibi alanların klasörü repo'da bulunur fakat MVP'de container/process olarak çalışmaz.
- **Tema ve dil baştan merkezi.**
- **Database modeli dışarı sızmaz.** Her response DTO üzerinden döner.
- **AI tanı koymaz, sebep söylemez.**
- **Her şey loglanır, hassas veri loglanmaz.**

---

## 3. Stack

### Active

| Katman | Teknoloji |
|---|---|
| Mobile | Expo SDK 52+ + React Native + TypeScript |
| API | Go 1.22+, `chi` router, `pgx`, `goose` migration |
| DB | PostgreSQL 18 |
| AI | OpenAI API (gpt-4.1-mini, Structured Outputs), API katmanından senkron çağrı |
| i18n | `i18next` + `react-i18next` + `expo-localization` |
| Local infra | Docker Compose: postgres + api |

### Deferred (klasör var, kod yok)

| Katman | Eklenme Tetiği |
|---|---|
| Worker | Günlük/haftalık batch insight ihtiyacı çıkınca |
| Redis | API response süresi sürekli >200ms olunca veya queue gerekince |
| Cloudflare R2 (object storage) | **Aktif**. `/v1/me/export` JSON'u R2'ye yazıp pre-signed URL döner; `/v1/profile/avatar` upload için pre-signed PUT URL üretir. Env eksikse dataexport inline JSON'a düşer, avatar 503 döner. `internal/storage/` paketinde AWS S3 SDK, region `auto`, path-style. |
| Resend (transactional email) | **Aktif**. Hesap silme onayı (`account_deleted` şablonu) ve "export'unuz hazır" (`export_ready` şablonu) için dispatch eder. Env eksikse her iki gönderim sessizce atlanır; primary akışlar etkilenmez. `internal/email/` paketi resend-go SDK'sını kullanır. |
| Web (Next.js) | İlk paying customer "web'den de bakabileyim" deyince |
| Admin panel | Operasyon SQL ile yapılamaz hale gelince |
| Traefik/Caddy | İkinci public servis çıktığında |

---

## 4. Repo Structure

```
neuronot/
├─ mobile/                  # Expo app
├─ api/                     # Go API
├─ worker/                  # README only, kod yok
├─ web/                     # README only, kod yok
├─ infra/
│  ├─ docker-compose.yml
│  └─ postgres/
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ PRD.md
│  └─ adr/
├─ .github/workflows/
├─ Makefile
└─ README.md
```

---

## 5. /mobile

```
mobile/
├─ app/                          # Expo Router (file = route, kalıbı bozma)
│  ├─ _layout.tsx                # font preload + ThemeProvider + ToastProvider
│  ├─ (auth)/{login,register}.tsx
│  ├─ (tabs)/{home,timeline,insights,settings}.tsx
│  └─ onboarding.tsx             # composes features/onboarding/* steps
├─ src/
│  ├─ components/
│  │  ├─ brand/                  # NeuroMascot, neuroAssets
│  │  ├─ feedback/               # Skeleton, ErrorState, EmptyState, LoadingDots, Toast
│  │  └─ charts/                 # Sparkline, BarChart7Day, TrendLineChart, chartUtils
│  ├─ hooks/                     # useFadeIn, useHapticPress, useSlideTransition, useNetworkStatus
│  ├─ features/                  # daily-log, events, onboarding, timeline,
│  │                             # insights, profile, summary
│  ├─ services/
│  │  ├─ api/                    # network clients (axios envelope)
│  │  ├─ cache/                  # SQLite mirror (db, schema, migrations, repos)
│  │  └─ sync/                   # engine, pull, push, queue (orchestration)
│  ├─ store/                     # zustand slices (auth, sync)
│  ├─ theme/                     # tokens, light, dark, typography, ThemeProvider
│  ├─ i18n/                      # init + setAppLanguage + resources
│  └─ locales/                   # 11 languages × N namespaces (json files)
└─ app.json
```

### Per-unit folder pattern (mecburi)

Her birim — component, hook, util, repo, store slice — kendi klasöründe yaşar. Pattern:

```
Foo/
├─ Foo.tsx                       # ana dosya
├─ index.ts                      # `export * from './Foo';`
├─ Foo.types.ts                  # (ileride eklenir)
├─ Foo.test.tsx                  # (ileride eklenir)
└─ Foo.styles.ts                 # (ileride eklenir)
```

Tek istisna `app/` (Expo Router dosya yolunu route olarak yorumlar, klasör pattern'i çalışmaz). Ekran dosyaları minimal compose eder; gerçek UI ve logic feature klasörlerinde.

State: **Zustand**. API: **TanStack Query**. Cache: **expo-sqlite** (yerel mirror). Animasyon: **Reanimated 3**. Charts: **react-native-svg** (custom; üçüncü chart kütüphanesi yok).

---

## 6. /api

```
api/
├─ cmd/api/main.go
├─ internal/
│  ├─ config/
│  ├─ db/
│  ├─ http/
│  ├─ i18n/
│  ├─ auth/
│  ├─ profile/
│  ├─ dailylog/
│  ├─ events/
│  ├─ insights/
│  ├─ summary/                   # weekly aggregate (cross-feature read)
│  ├─ stats/                     # /v1/stats/trend (chart serisi)
│  ├─ sync/                      # /v1/sync/{pull,push}
│  └─ timeline/
├─ migrations/
├─ .env.example
├─ go.mod
└─ Dockerfile
```

Her feature klasörü:

```
dailylog/
├─ dto.go         # request/response yapıları
├─ handler.go     # HTTP, başka iş yok
├─ service.go     # iş mantığı, validasyon, kararlar
├─ repository.go  # tek SQL yazılan yer
└─ types.go       # internal domain tipleri
```

**Vertical slice** — yeni özellik ekleyince başka klasörü kirletmezsin.

---

## 7. Three-Layer Rule

- **Handler** HTTP bilir, iş yapmaz. Body okur, DTO'ya çevirir, service çağırır, response yazar.
- **Service** iş mantığını bilir, HTTP bilmez, SQL bilmez.
- **Repository** SQL bilir, başka şey bilmez.

DTO `dto.go`'da. Domain tipi `types.go`'da. İkisi farklı şey.

---

## 8. Database

PostgreSQL 18. Migration'lar `/api/migrations/` altında, `goose` ile.

MVP tabloları:

- `users` — id, email, password_hash, preferred_language (default 'en'), created_at
- `profiles` — user_id, focus_problem, intensity_level, avg_sleep_hours, caffeine_daily, onboarding_completed_at, **timezone**, **reminder_hour**, **reminder_enabled**
- `daily_logs` — id, user_id, focus, energy, forgetfulness, stress, sleep_quality, logged_at, **updated_at**, **deleted_at**
- `events` — id, user_id, type, intensity, note, occurred_at, **updated_at**, **deleted_at**
- `insights` — id, user_id, title, content, language, source_event_ids, generated_at, viewed_at, **updated_at**

Index stratejisi:
- `(user_id, occurred_at DESC)` veya `(user_id, logged_at DESC)` — UI listing
- `(user_id, updated_at DESC)` — sync pull (`/v1/sync/pull?since=`)

Trigger: `set_updated_at()` her UPDATE'de `updated_at = now()` basar (`daily_logs`, `events`, `insights`).

---

## 9. Auth

JWT + refresh token. Access 15 dk, refresh 30 gün. Refresh token DB'de saklanır (rotation için), access stateless.

`bcrypt` 10 cost. Login rate limit (5/dk per IP).

**Object-level authorization mecburi.** Kullanıcı başka kullanıcının log'unu çekmeye çalışırsa 404 döner.

---

## 10. AI Integration

MVP'de **senkron**. Kullanıcı log yazar, son 7 günün özet datası OpenAI Chat Completions API'ye gider, response insight olarak yazılır + ekrana basılır. Tipik süre 3-8 saniye.

### Prompt Discipline

AI'a gönderilen veri **minimum**. Email, ad, lokasyon prompta girmez — sadece kategorize edilmiş semptom verisi.

System prompt sabit, repo'da `internal/insights/prompts.go` içinde versiyonlu.

System prompt **çok dilli** — kullanıcının `preferred_language` değeri prompta enjekte edilir.

Output format **structured** — OpenAI Structured Outputs (`response_format: json_schema`, `strict: true`) ile JSON şeması server-side enforce edilir; parse edemezsen "şu an üretemedim" göster.

### Safety Filter

Output'un içinde şu yasak: tanı adı, hastalık adı, ilaç adı, "sen şu hastalıksın" formu, "şunu kullan" formu. Regex + kategori listesi ile filtre, post-LLM.

Kriz keyword'ları (intihar, kendine zarar, ani bilinç değişikliği vb.) → AI cevabı tamamen bypass, yardım kartı göster.

**Kriz keyword listesi 11 dil için ayrı tutulur.** Native speaker review zorunlu.

---

## 11. API Conventions

- Versioning: `/v1/...`
- Response: `{"data": ..., "error": null}` veya `{"data": null, "error": {"code": "...", "message_key": "...", "message": "..."}}`.
- Pagination: cursor-based (`?cursor=...&limit=20`).
- Tarih: ISO 8601 UTC.
- `Accept-Language` header desteklenir (server-side mesajlar için).

---

## 12. Theming

Tema **tek bir yerden** kontrol edilir. UI bileşenleri renk, font, spacing, radius değerlerini doğrudan yazmaz — token'dan çeker.

```
mobile/src/theme/
├─ tokens.ts        # primitive
├─ light.ts         # semantic
├─ dark.ts          # semantic (default)
├─ typography.ts
├─ ThemeProvider.tsx
└─ useTheme.ts
```

İki katman: **primitive tokens** (palette, spacing scale, fontFamily) → **semantic tokens** (`surface.primary`, `text.primary`).

Bileşenler **sadece semantic token kullanır**. Hex renk veya primitive token doğrudan kullanılmaz.

PRD §19: modern medical-tech, soft dark default, sade glassmorphism, düşük bilişsel yük.

### Tipografi: Nunito Sans

Uygulama dört ağırlıkta Nunito Sans yükler (`@expo-google-fonts/nunito-sans`): regular(400), medium(500), semibold(600), bold(700). `_layout.tsx` `useFonts` ile preload yapar; splash screen font yüklenene kadar açık kalır. Token'lar `theme.tokens.fontFamily.{regular,medium,semibold,bold}`; ekranlar bu ailelere `theme.typography.*` üzerinden erişir. Hardcoded `fontFamily: 'System'` veya başka aile yasak.

### Charts (custom SVG)

Üçüncü chart kütüphanesi yok. `mobile/src/components/charts/` altında `Sparkline`, `BarChart7Day`, `TrendLineChart` ve `chartUtils` saf `react-native-svg` ile yazıldı. Tema renklerini `useTheme` ile alır, RTL desteği `chartUtils.flipRtl`'de. Yeni chart eklerken aynı klasör pattern'i (`Foo/Foo.tsx` + `Foo/index.ts`).

### Mascot ve Native Asset Pipeline

Neuro maskotu kaynak dosyaları `mobile/assets/images/neuro-*.png` altında durur. Üretilen native asset'ler `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png` ve `mobile/assets/splash.png` olarak kök `assets/` altında tutulur.

Runtime UI **yalnızca** `mobile/src/components/brand/NeuroMascot.tsx` üzerinden maskot kullanır; ekran dosyaları PNG'leri doğrudan import etmez. Maskot kullanımı marka çapasına ve seçili boş/destek state'lerine sınırlıdır — her kart veya timeline satırına yerleştirilmez. Kriz/güvenlik bağlamında yalnızca `calm` mood kullanılır; oyunlaştırıcı varyantlar (excited, playful) bu bağlamda yasaktır.

Asset komutları:

```bash
cd mobile
bun run generate:assets
bun run validate:assets
```

---

## 12b. Offline & Sync (read-first + dirty queue)

Mobile, **TanStack Query + expo-sqlite + manual delta sync** üçlüsünü kullanır. Üçüncü senkron motoru yok (WatermelonDB / PowerSync MVP scope dışı).

```
TanStack Query  ← reactive UI layer (var olan)
       ↓
   SQLite cache  ← read-first kaynak; write-through
       ↓
   syncEngine   ← background pull(?since=ts) + push (batch)
       ↓
       API
```

### Kontrat

- **Pull**: `GET /v1/sync/pull?since=<rfc3339>` — tüm syncable tabloların delta'sını döndürür (daily_logs, events, insights, profile + soft-delete listeleri).
- **Push**: `POST /v1/sync/push` — client'ın dirty satırlarını batch (max 200) gönderir; server `accepted` / `conflicts` döner.
- **Conflict policy**: last-write-wins, server tie-break. Client `updated_at` server'dakinden eski ise → conflict; client server satırını cache'e yazar (UI re-render).
- **Soft delete**: server `deleted_at` set eder; pull bu id'leri `deletes` listesinde döner; client cache mirror'lar.

### Klasörler (mobile)

- `services/api/sync/` — sadece network çağrısı.
- `services/cache/` — SQLite şema + per-tablo repo'lar (`dailyLog`, `events`, `insights`, `profile`). Her satıra `dirty` ve `local_updated_at` eklenir.
- `services/sync/` — orchestration: `engine.runCycle()` (mutex'li) → `push.flushDirty()` → `pull.applyDelta()`.
- `store/sync/` — `isSyncing`, `lastSyncAt`, `lastError` (zustand).
- `features/<x>/queries/` — read-first wrapper'lar; UI `useQuery` ile bunları çağırır, alttaki katmanları bilmez.

**UI cache veya sync'i doğrudan import etmez.** Bu kural ekranların API yüzeyine bağımlılığını feature query'lerinin arkasında tutar.

### Trigger noktaları (`syncEngine.runCycle`)

1. App foreground'a geldiğinde
2. `useNetworkStatus().online: true` sinyalinde
3. Mutation `onSettled`'inde (optimistic flush)
4. Periyodik (foreground'da, 5 dk)

### Backend yan etki

- Her syncable tablo: `updated_at timestamptz NOT NULL DEFAULT now()` + trigger.
- `daily_logs`, `events`: ek `deleted_at timestamptz NULL` (soft delete).
- `insights`: immutable history, `deleted_at` yok.
- Index: `(user_id, updated_at DESC)` her tabloda.

---

## 13. Internationalization

11 dil:

| Kod | Dil | Pazar | Not |
|---|---|---|---|
| `tr` | Türkçe | Birincil | Native review |
| `en` | English | Global | Native review |
| `es` | Español | LatAm/ES | Native/agency review |
| `de` | Deutsch | DE/AT/CH | Native review |
| `fr` | Français | FR/CA/BE | Native review |
| `pt` | Português | BR + PT | pt-BR default |
| `it` | Italiano | İtalya | |
| `ar` | العربية | Orta Doğu | **RTL**, Beta |
| `ru` | Русский | RU/BDT | |
| `ja` | 日本語 | Japonya | |
| `zh` | 简体中文 | Çin | Simplified |

Library: `i18next` + `react-i18next` + `expo-localization`.

Namespace per feature. Hardcoded string yasak (lint'le yakalanır).

### RTL

`I18nManager.allowRTL(true)` + `forceRTL` Arabic seçilince. `marginStart`/`marginEnd` kullan, `marginLeft`/`marginRight` değil.

### Tarih, Sayı

`Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat`.

### Server-Side Mesajlar

API hata mesajları **çevrilmez** — `error.code` + `error.message_key` döner. Client kendi locale'inden çeviri yapar.

### AI Insight Dili

Kullanıcının `preferred_language` değeri sistem prompt'a enjekte edilir, OpenAI o dilde JSON cevap verir. Insight DB'ye o dilde yazılır.

---

## 14. Observability

- Structured log (`slog`), JSON format.
- Her request: method, path, status, duration, user_id (varsa).
- Body **yok**, query param'da PII varsa redact.
- AI çağrıları ayrı log: token sayısı, süre, success/fail, prompt versiyonu, response language.
- Prompt **içerik** log'a girmez.

---

## 15. Strict Separation

| Klasör | Yazılabilir |
|---|---|
| `/mobile` | Sadece RN/Expo kodu |
| `/api` | Sadece Go backend kodu |
| `/worker` | Sadece Go worker kodu (henüz boş) |
| `/web` | Sadece Next.js kodu (henüz boş) |
| `/infra` | Docker, compose, deploy |
| `/docs` | Markdown |

---

## 16. Out of Scope (MVP)

- Worker process ve Redis queue
- Web dashboard
- Admin panel
- ~~Object storage (Cloudflare R2) / dosya yükleme~~ — aktif (dataexport + avatar)
- ~~Transactional email (Resend)~~ — aktif (account-deletion + export-ready)
- Reverse proxy
- E2E encryption
- Offline queue
- Push notification
- HealthKit / Google Fit sync
- Doktor erişimi
- Sosyal feature
- Subscription/payment
- 12. dilden sonrası

---

## 17. Timeline (5 hafta)

| Hafta | Hedef |
|---|---|
| 1 | API iskelet + auth + Postgres + theme tokens + i18n setup + en/tr |
| 2 | Daily-log + events + timeline + onboarding |
| 3 | AI insight + multilingual prompt + safety filter + 11 dil kriz keyword'leri |
| 4 | 9 dilin LLM-asistanlı çevirisi + native review + RTL test |
| 5 | Polish + bug fix + TestFlight + 10 davetli |

---

## 18. Final Decision

**Modular Monolith + Vertical Slice + Three-Layer + DTO + Repository + Centralized Theme + Multilingual i18n + scaffolded structure.**

Tam Onion yok. Tam CQRS yok. Worker/Redis/Web yok (klasör var, kod yok). Object storage (Cloudflare R2) + transactional email (Resend) aktif — `internal/storage/` ve `internal/email/`; dataexport, profile avatar ve account deletion akışlarında kullanılır. Microservice asla yok.

Theme ve i18n MVP'de full setup — sonradan retrofit etmek imkansıza yakın.
