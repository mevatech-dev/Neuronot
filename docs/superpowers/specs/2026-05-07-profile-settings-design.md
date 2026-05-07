# Profile Tab + Settings Sub-screens — Design Spec

**Date:** 2026-05-07
**Status:** Approved (brainstorm), pending implementation plan
**Owner:** mevatech.app@gmail.com

## Goal

Replace the flat `Settings` tab with a top-level `Profile` tab that exposes
the user's personal data summary, and route all system-level configuration
through a `Settings` sub-screen reached from inside Profile. Add the v1
account-management surface that has been missing: password change, account
deletion (GDPR/KVKK), data export, AI/legal consents with audit trail,
crisis hotlines (PRD §16), about/legal, help, and onboarding redo. Add an
explicit AI-usage consent layer that gates insight generation and is
captured at registration, manageable in settings, and persisted as an
immutable audit log including encrypted IP and device id.

## Non-goals

- Push notifications via a server (deferred per CLAUDE.md). Only local
  scheduled reminders via `expo-notifications`.
- Worker/queue for export. v1 returns export inline as JSON.
- Subscription / RevenueCat surfaces.
- Device-level encryption beyond consent audit fields. The encryption work
  for full user data (DB at-rest + AI redaction) is a separate spec.
- Server-side push notification token registration.

## Information Architecture

Bottom tab bar changes from `Home · Timeline · Insights · Settings` to
`Home · Timeline · Insights · Profile`.

```
(auth)/register                         MODIFIED — consent checkboxes added
(tabs)/profile                          NEW — replaces (tabs)/settings.tsx
   ├─ ProfileEditSheet                  EXISTS — opened from Profile tab
   └─ /profile/settings                 NEW
        ├─ inline: theme, language, local-notifications toggle + hour
        ├─ /profile/settings/account            NEW — password + delete account
        ├─ /profile/settings/data               NEW — export + delete shortcut
        ├─ /profile/settings/consents           NEW — AI / ToS / Privacy
        ├─ /profile/settings/crisis             NEW — PRD §16 hotlines
        ├─ /profile/settings/about              NEW — version + legal links
        ├─ /profile/settings/help               NEW — mailto + FAQ
        ├─ /profile/settings/onboarding-redo    NEW — re-run onboarding
        └─ inline: Logout
```

## Screen inventory

| Screen | Status | Notes |
|---|---|---|
| `mobile/app/(auth)/register.tsx` | MODIFY | Adds 3 consent checkboxes (ToS, Privacy, AI). AI is mandatory. |
| `mobile/app/(tabs)/settings.tsx` | DELETE | Replaced by Profile tab. |
| `mobile/app/(tabs)/profile.tsx` | NEW | Tab entry point: avatar, email, member-since, personal-data summary card, "Edit Profile" button (opens existing sheet), Settings push row. |
| `mobile/app/profile/settings.tsx` | NEW | Inline theme/language/reminder + push rows for account, data, consents, crisis, about, help, onboarding-redo. Logout at bottom. |
| `mobile/app/profile/settings/account.tsx` | NEW | Change password (3-field form: current, new, confirm). "Delete account" danger button → confirm sheet (email retype) → DELETE /v1/me. |
| `mobile/app/profile/settings/data.tsx` | NEW | "Export my data" button → GET /v1/me/export → save with expo-file-system + share via expo-sharing. Delete shortcut at bottom. |
| `mobile/app/profile/settings/consents.tsx` | NEW | Lists 3 consents with current granted/revoked status, version, granted_at. Revoke button on AI row; ToS/Privacy "View" link to about. Re-consent banner if version is stale. |
| `mobile/app/profile/settings/crisis.tsx` | NEW | i18n hotline list per locale (TR: 182, 183, 112; EN: 988, 911, etc.). Calm mascot. PRD §15-16 wording. |
| `mobile/app/profile/settings/about.tsx` | NEW | Version + build (expo-application), Privacy Policy / Terms of Service / Open Source Licenses links → static markdown screens. |
| `mobile/app/profile/settings/help.tsx` | NEW | "Contact support" mailto: + 3-4 FAQs (i18n). |
| `mobile/app/profile/settings/onboarding-redo.tsx` | NEW | Warning text + "Restart" button → `router.replace('/onboarding')`. |
| `ProfileEditSheet` | UNCHANGED | Reused as-is. |

## Profile tab content (`(tabs)/profile.tsx`)

```
[ Profile (header) ]

[ neuro mascot · email@example.com · "Member since 12 May 2026" ]

Personal Data
┌──────────────────────────────────┐
│ Focus problem · Forgetfulness    │
│ Intensity     · ●●●○○ (3)        │
│ Avg sleep     · 6.5 h            │
│ Caffeine      · Yes              │
│ Reminder      · 09:00            │
└──────────────────────────────────┘
[ Edit Profile ]   ← opens ProfileEditSheet

────────────
⚙  Settings →   ← pushes /profile/settings
```

- Mascot mood: `calm`. PRD §19 soft-dark surfaces.
- Personal data card pulls from `profileQuery(userId)` factory; loading →
  Skeleton; error → ErrorState with retry.
- Member-since uses `Intl.DateTimeFormat(locale, {dateStyle:'medium'})`.

## Settings root content (`/profile/settings.tsx`)

Inline sections (no push):

- **Theme** — segmented control: System / Light / Dark.
- **Language** — current label + chevron, opens picker sheet listing
  `SUPPORTED_LANGUAGES` with Beta tags (logic already in old settings tab).
- **Reminder** — Switch + hour picker (reuses `HOURS = [7,9,12,15,18,21]`).
  Backed by profile `reminder_enabled` + `reminder_hour`. On change, calls
  `expo-notifications.scheduleNotificationAsync` (daily trigger) or cancels
  scheduled notification.

Push rows (with section dividers):

- `Account & Data`: Account, Data, Consents
- `Help`: Crisis & support, Contact
- `About`: About, Restart onboarding

Bottom: Logout (danger).

## Backend changes

### New vertical slices

```
api/internal/consents/
├─ dto.go         ConsentResponse, GrantRequest, RevokeRequest
├─ handler.go     GET, POST, DELETE under /v1/me/consents
├─ service.go     IsGranted(userID, type), Grant(...), Revoke(...), GetAll(userID)
├─ repository.go  Insert immutable row; latest-per-type query; encrypt IP/device
└─ types.go       Consent struct, ConsentType + currentVersions map

api/internal/account/
├─ dto.go         ChangePasswordRequest, DeleteAccountRequest
├─ handler.go     POST /v1/auth/password, DELETE /v1/me
├─ service.go     ChangePassword, DeleteSelf
├─ repository.go  bcrypt update; cascade delete (FKs handle the rest)
└─ types.go

api/internal/dataexport/
├─ dto.go         ExportPayload (profile + logs + events + insights)
├─ handler.go     GET /v1/me/export
├─ service.go     Build(userID)
├─ repository.go  Multi-table fetch
└─ types.go
```

### New helper package

```
api/internal/crypto/aesgcm/
├─ aesgcm.go      Encrypt(key, plaintext) ([]byte, error); Decrypt(key, ct) ([]byte, error)
└─ aesgcm_test.go Round-trip + tamper test
```

Layout: `nonce(12) || ciphertext || tag(16)`. Master key from env
`CONSENT_KEK` (base64, ≥32 bytes). Empty/invalid key → app refuses to boot.

### Auth slice modifications

- `RegisterRequest` adds `consents []ConsentInput` (each: `type`, `granted`,
  `version`). AI consent (`ai_usage`, granted=true) is mandatory.
- `Service.Register` runs in a single transaction:
  1. Insert user (existing).
  2. Insert empty profile (existing).
  3. Insert 3 consent rows (ToS, Privacy, AI) with `source='register'`,
     IP and device id encrypted.
- New error: `AUTH_AI_CONSENT_REQUIRED` (422).

### Insights slice modifications

`Service.Generate` adds a consent check at the top:

```go
if !consentSvc.IsGranted(ctx, userID, ConsentTypeAIUsage) {
    return Insight{}, ErrConsentRevoked
}
```

Handler maps `ErrConsentRevoked` → `INSIGHT_CONSENT_REVOKED` (403).

### Migration `00009_consents.sql`

```sql
-- +goose Up
CREATE TABLE consents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('ai_usage','terms_of_service','privacy_policy')),
  granted       boolean NOT NULL,
  version       text NOT NULL,
  source        text NOT NULL CHECK (source IN ('register','settings','reconsent')),
  ip_encrypted  bytea,
  device_id_encrypted bytea,
  user_agent    text,
  occurred_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consents_user_type_occurred_idx
  ON consents (user_id, type, occurred_at DESC);

-- +goose Down
DROP INDEX IF EXISTS consents_user_type_occurred_idx;
DROP TABLE IF EXISTS consents;
```

Each grant or revoke creates a NEW row. Current state per `(user_id, type)`
is the row with the highest `occurred_at`. Versions in
`api/internal/consents/types.go`:

```go
var currentVersions = map[ConsentType]string{
    ConsentTypeAIUsage:         "v1",
    ConsentTypeTermsOfService:  "2026-05",
    ConsentTypePrivacyPolicy:   "2026-05",
}
```

`IsGranted` returns true only when latest row's `granted=true` AND
`version=currentVersions[type]`.

### New endpoint catalog

| Method | Path | Slice | Notes |
|---|---|---|---|
| POST | `/v1/auth/register` | auth | MODIFIED — accepts consents |
| POST | `/v1/auth/password` | account | NEW — current+new password |
| DELETE | `/v1/me` | account | NEW — cascade delete |
| GET | `/v1/me/export` | dataexport | NEW — JSON payload |
| GET | `/v1/me/consents` | consents | NEW — current state per type |
| POST | `/v1/me/consents` | consents | NEW — grant/regrant |
| DELETE | `/v1/me/consents/:type` | consents | NEW — revoke (insert granted=false row) |

### Config additions

`CONSENT_KEK` — required env. Base64, ≥32 bytes after decode. Boot fails
if missing/invalid. `.env.example` updated.

## Mobile structure

Per-unit folder pattern (`Foo/Foo.tsx + Foo/index.ts`) for every new component, hook, and util.

```
mobile/src/features/profile/
├─ ProfileEditSheet/        EXISTS
├─ queries/                 EXISTS
├─ mutations/               EXISTS
└─ ProfileSummaryCard/      NEW

mobile/src/features/settings/    NEW feature folder
├─ ThemePicker/                  inline segmented
├─ LanguagePicker/               sheet picker
├─ ReminderRow/                  switch + hour
├─ SettingsLinkRow/              icon + label + chevron push row
└─ LogoutButton/

mobile/src/features/account/     NEW
├─ ChangePasswordForm/
├─ DeleteAccountSheet/
├─ queries/
└─ mutations/                    useChangePassword, useDeleteAccount

mobile/src/features/consents/    NEW
├─ ConsentRow/
├─ ConsentsList/
├─ ReConsentSheet/
├─ queries/                      consentsQuery (no SQLite mirror — always live)
└─ mutations/                    useGrantConsent, useRevokeConsent

mobile/src/features/dataexport/  NEW
├─ ExportButton/
└─ mutations/                    useExportData

mobile/src/features/crisis/      NEW
├─ CrisisHotlineList/
└─ types/                        HotlineEntry per locale

mobile/src/features/about/       NEW
├─ VersionRow/
├─ LegalLinkRow/
└─ LicenseList/

mobile/src/features/help/        NEW
├─ SupportMailtoButton/
└─ FaqList/

mobile/src/services/device/      NEW
└─ deviceId.ts                   getOrCreateDeviceId() — secure-store backed
```

### i18n

New namespaces (one JSON per locale, 11 locales):

- `settings` — theme, language, reminder, link labels
- `account` — password change, delete confirm copy
- `consents` — 3 consent titles + descriptions, status copy
- `data` — export, save, share copy
- `about` — version label, legal headings
- `help` — FAQs, contact

`crisis` namespace already exists; expanded with locale-specific hotlines.

EN + TR native; rest LLM-translated + skim review (existing process).
Run `bun run validate:i18n` after population.

### Cache & sync

- `consents` is **not** synced to SQLite. AI gating must always be live —
  cached "granted" cannot be stale.
- Account password change does not trigger sync. On account delete:
  - Sync engine stops (pending push drains, then halts).
  - SQLite cache cleared.
  - Secure-store cleared.
  - Auth store logout → `router.replace('/(auth)/login')`.

## Critical flows

### Account deletion (irreversible)

1. User taps "Delete my account" in `account.tsx` or `data.tsx`.
2. Confirm sheet: warning copy + email retype input + danger button.
3. `DELETE /v1/me` with auth header. Backend transaction:
   - Revoke all refresh tokens for the user.
   - `DELETE FROM users WHERE id = $1` — FK cascade removes profiles, daily_logs, events, insights, consents, refresh_tokens.
4. Mobile cleans local state (sync stop, SQLite drop, secure-store clear, auth logout).
5. Replace navigation to login.
6. 401 mid-flow → token already revoked → toast + login replace.

### Password change

3-field form: current, new, confirm. Min 8 chars (existing rule). Confirm
mismatch is inline. Backend verifies current password, updates bcrypt hash,
rotates refresh tokens (invalidates other sessions). Mobile shows toast
"Password changed. Other devices will need to sign in again."

### Data export

`GET /v1/me/export` returns JSON: `{ profile, daily_logs[], events[], insights[] }`.
Mobile saves to `expo-file-system.documentDirectory`, file name
`neuronot-export-YYYY-MM-DD.json`, opens `expo-sharing.shareAsync`.
Future: server-side ZIP if payload grows. v1 caps at single-shot JSON.

### AI consent revoke

User taps revoke on AI row → confirm sheet → `DELETE /v1/me/consents/ai_usage`
inserts `granted=false` row → query refetches → row shows revoked state.
Insights screen "Generate" call returns 403 `INSIGHT_CONSENT_REVOKED` →
banner: "AI insight requires consent. Restore it in Settings → Consents."
Banner is a deep link.

### Re-consent (version bump)

App startup → `useQuery(consentsQuery)` → server returns each consent's
current row plus `currentVersion`. If any row's version differs from
`currentVersion`, mobile renders `ReConsentSheet`:

- ToS / Privacy: not dismissable. Must accept to continue using the app.
- AI: dismissable. If declined, AI features blocked but app usable.

Acceptance triggers `useGrantConsent({type, version: currentVersion, source: 'reconsent'})`.

### Local reminder notifications

Switch ON:
1. Request `Notifications.requestPermissionsAsync`.
2. Granted → schedule daily trigger at chosen hour:
   ```ts
   await Notifications.scheduleNotificationAsync({
     content: { title: t('reminder.title'), body: t('reminder.body') },
     trigger: { hour, minute: 0, repeats: true },
   });
   ```
3. Persist `reminder_enabled` + `reminder_hour` via `usePatchProfile`.
4. Denied → switch reverts; row shows "Open system settings" deep link via `Linking.openSettings()`.

Switch OFF: `cancelAllScheduledNotificationsAsync` + patch profile.

### RTL (ar)

All push rows use `flexDirection: 'row'` (auto-flips). Chevron icon is a
semantic `theme.icons.chevronEnd` that rotates 180° in RTL. No hardcoded
`marginLeft` / `marginRight`.

## Error catalog (additions to `docs/api-errors.md`)

- `AUTH_AI_CONSENT_REQUIRED` (422) — register without AI consent
- `AUTH_PASSWORD_INCORRECT` (401) — change-password old password mismatch
- `ACCOUNT_DELETE_EMAIL_MISMATCH` (422) — confirm input does not match account email
- `INSIGHT_CONSENT_REVOKED` (403) — generate called without active AI consent
- `CONSENT_NOT_FOUND` (404) — revoke on a type with no grant history
- `EXPORT_FAILED` (500) — export aggregation error

## Out of scope / explicit deferrals

- Server-pushed reminders (FCM/APNs): v2.
- Multi-device session list / revoke per device: v2.
- 2FA / TOTP: v2.
- Avatar upload: v2.
- Encryption of all user data (logs/events/insights): separate spec.
- AI chat about user's own data: separate spec.

## Rollout sequence (high level — full plan in writing-plans pass)

1. Migration 00009 + crypto helper + consents slice + auth register modification.
2. Account slice (password change + delete) + dataexport slice.
3. Insights slice consent gate.
4. Mobile: Profile tab + Settings root, replace existing settings tab.
5. Mobile: account, data, consents sub-screens.
6. Mobile: crisis, about, help, onboarding-redo sub-screens.
7. Mobile: register screen consent checkboxes + re-consent sheet on startup.
8. i18n population (EN + TR native, then LLM fill + review).
9. Manual smoke per HAFTA verification doc + add HAFTA6 entry.

## References

- PRD §15 AI Safety Boundary
- PRD §16 Emergency Boundary
- PRD §19 Design Direction (soft dark default, mascot tone)
- ARCHITECTURE.md §3-table style + AES-GCM column convention
- CLAUDE.md per-unit folder pattern
- Memory `feedback_no_hardcode` and `feedback_architecture_strict`
