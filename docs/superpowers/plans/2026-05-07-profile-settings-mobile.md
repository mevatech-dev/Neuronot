# Profile/Settings Mobile Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the mobile half of the Profile/Settings overhaul: replace the flat Settings tab with a Profile tab, expose Settings as a sub-screen with seven push children (account, data, consents, crisis, about, help, onboarding-redo), wire register-time consent UI and a re-consent startup gate, and surface password change, account deletion, data export, and local reminder notifications behind those screens.

**Architecture:** Per-unit folder pattern (`Foo/Foo.tsx + Foo/index.ts`) for every new component, hook, util. New feature folders `account/`, `consents/`, `dataexport/`, `settings/`, `crisis/`, `about/`, `help/` each carry their own `queries/` + `mutations/` (TanStack Query factory pattern, mirroring existing `daily-log/` and `events/`). Audit-grade fields (IP/device-id) flow through a single `services/device/deviceId` helper that injects an `X-Device-Id` header on every authed request. Consents are not mirrored to SQLite — every read hits the live backend so the AI gate cannot be stale.

**Tech Stack:** Expo SDK 52, React Native + TypeScript, Expo Router, TanStack Query 5, Zustand, react-i18next 11 locales, expo-secure-store, expo-notifications, expo-application, expo-file-system, expo-sharing, axios.

**Spec:** [docs/superpowers/specs/2026-05-07-profile-settings-design.md](../specs/2026-05-07-profile-settings-design.md)
**Plan 1 (Backend):** [docs/superpowers/plans/2026-05-07-profile-settings-backend.md](2026-05-07-profile-settings-backend.md) — must be merged before starting Plan 2.

---

## File Structure

### New files

```
mobile/src/services/device/
└─ deviceId/
   ├─ deviceId.ts                getOrCreateDeviceId(), attachDeviceHeader()
   └─ index.ts

mobile/src/services/api/account/
├─ account.ts                    changePassword(), deleteAccount()
└─ index.ts

mobile/src/services/api/consents/
├─ consents.ts                   listConsents(), grantConsent(), revokeConsent()
└─ index.ts

mobile/src/services/api/dataexport/
├─ dataexport.ts                 fetchExport()
└─ index.ts

mobile/src/features/account/
├─ ChangePasswordForm/
│  ├─ ChangePasswordForm.tsx
│  └─ index.ts
├─ DeleteAccountSheet/
│  ├─ DeleteAccountSheet.tsx
│  └─ index.ts
└─ mutations/
   ├─ mutations.ts               useChangePassword(), useDeleteAccount()
   └─ index.ts

mobile/src/features/consents/
├─ ConsentRow/
│  ├─ ConsentRow.tsx
│  └─ index.ts
├─ ConsentsList/
│  ├─ ConsentsList.tsx
│  └─ index.ts
├─ ReConsentSheet/
│  ├─ ReConsentSheet.tsx
│  └─ index.ts
├─ queries/
│  ├─ queries.ts                 consentsQuery() factory
│  ├─ mappers.ts                 mapConsentResponse()
│  └─ index.ts
├─ mutations/
│  ├─ mutations.ts               useGrantConsent(), useRevokeConsent()
│  └─ index.ts
└─ types/
   ├─ types.ts                   ConsentType, ConsentRecord
   └─ index.ts

mobile/src/features/dataexport/
├─ ExportButton/
│  ├─ ExportButton.tsx
│  └─ index.ts
└─ mutations/
   ├─ mutations.ts               useExportData()
   └─ index.ts

mobile/src/features/settings/
├─ ThemePicker/
│  ├─ ThemePicker.tsx
│  └─ index.ts
├─ LanguagePicker/
│  ├─ LanguagePicker.tsx
│  └─ index.ts
├─ ReminderRow/
│  ├─ ReminderRow.tsx
│  └─ index.ts
├─ SettingsLinkRow/
│  ├─ SettingsLinkRow.tsx
│  └─ index.ts
└─ LogoutButton/
   ├─ LogoutButton.tsx
   └─ index.ts

mobile/src/features/profile/
└─ ProfileSummaryCard/
   ├─ ProfileSummaryCard.tsx
   └─ index.ts

mobile/src/features/crisis/
├─ CrisisHotlineList/
│  ├─ CrisisHotlineList.tsx
│  └─ index.ts
└─ types/
   ├─ types.ts                   HotlineEntry, hotlinesByLocale
   └─ index.ts

mobile/src/features/about/
├─ VersionRow/
│  ├─ VersionRow.tsx
│  └─ index.ts
├─ LegalLinkRow/
│  ├─ LegalLinkRow.tsx
│  └─ index.ts
└─ LicenseList/
   ├─ LicenseList.tsx
   └─ index.ts

mobile/src/features/help/
├─ SupportMailtoButton/
│  ├─ SupportMailtoButton.tsx
│  └─ index.ts
└─ FaqList/
   ├─ FaqList.tsx
   └─ index.ts

mobile/src/hooks/useLocalReminder/
├─ useLocalReminder.ts            schedule/cancel notifications, permission flow
└─ index.ts

mobile/app/(tabs)/profile.tsx     new tab entry
mobile/app/profile/_layout.tsx    Stack layout
mobile/app/profile/settings.tsx
mobile/app/profile/settings/_layout.tsx
mobile/app/profile/settings/account.tsx
mobile/app/profile/settings/data.tsx
mobile/app/profile/settings/consents.tsx
mobile/app/profile/settings/crisis.tsx
mobile/app/profile/settings/about.tsx
mobile/app/profile/settings/help.tsx
mobile/app/profile/settings/onboarding-redo.tsx

mobile/src/locales/{en,tr}/{settings,account,consents,data,about,help}.json    7 namespaces × 2 locales (native)
mobile/src/locales/{es,de,fr,pt,it,ar,ru,ja,zh}/{settings,account,consents,data,about,help}.json   LLM-translated
mobile/src/locales/{tr,en}/crisis.json                              EXTEND with hotlines
```

### Modified files

```
mobile/src/services/api/client/client.ts   — add X-Device-Id header
mobile/src/services/api/auth/auth.ts       — register() accepts consents[]
mobile/src/store/auth/auth.ts              — register() takes consents[]
mobile/app/(auth)/register.tsx             — three consent checkboxes; submit gates on AI
mobile/app/_layout.tsx                     — re-consent gate (load consents → ReConsentSheet)
mobile/app/(tabs)/_layout.tsx              — replace `settings` Tabs.Screen with `profile`
mobile/app/(tabs)/settings.tsx             — DELETE
mobile/src/i18n/index.ts                   — add namespaces array entries
mobile/src/i18n/resources/resources.ts     — wire 7 new namespaces × 11 locales
```

---

## Conventions

- All commands run from `/Users/mustafamac/Documents/Projelerim/neuronot` unless noted.
- Mobile commands run with `bun` (`bun jest`, `bun run typecheck`, `bun run lint`).
- Commit after every task. Use a short imperative subject.
- Per-unit folder pattern is **mandatory** for new components. The only exception is `mobile/app/` (Expo Router treats files as routes).
- Theme tokens only — no hardcoded hex/rgb in any new component.
- All user-facing strings go through `t('key')`. New strings need a namespace entry in `en` + `tr` minimum before merging the consuming task.
- After every task: `cd mobile && bun run typecheck && bun run lint`. Note: lint may flag pre-existing issues in unrelated files; only block on lint errors introduced by *this task's diff*.

---

## Phase A — Foundation: API client + types + device id

### Task 1: Device-id helper

**Files:**
- Create: `mobile/src/services/device/deviceId/deviceId.ts`
- Create: `mobile/src/services/device/deviceId/index.ts`

- [ ] **Step 1: Write the helper**

```ts
// mobile/src/services/device/deviceId/deviceId.ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'neuronot.device.id';

let cached: string | null = null;

// uuid v4 — small inline impl to avoid an extra dep just for one call.
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (cached) return cached;
  const stored = await SecureStore.getItemAsync(KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fresh = uuid();
  await SecureStore.setItemAsync(KEY, fresh);
  cached = fresh;
  return fresh;
}

// Synchronous read for use after at least one await of getOrCreateDeviceId.
// Returns null until the first call resolves.
export function getCachedDeviceId(): string | null {
  return cached;
}
```

- [ ] **Step 2: Write the barrel**

```ts
// mobile/src/services/device/deviceId/index.ts
export * from './deviceId';
```

- [ ] **Step 3: Verify**

```bash
cd mobile && bun run typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/services/device/deviceId/
git commit -m "device: add getOrCreateDeviceId helper backed by secure-store"
```

---

### Task 2: Inject X-Device-Id header into apiClient

**Files:**
- Modify: `mobile/src/services/api/client/client.ts`

- [ ] **Step 1: Read the current file**

Find the existing `apiClient.interceptors.request.use((config) => { ... })` block.

- [ ] **Step 2: Update the interceptor**

Replace the existing request interceptor with:

```ts
import { getCachedDeviceId, getOrCreateDeviceId } from '@/services/device/deviceId';

apiClient.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const deviceId = getCachedDeviceId() ?? (await getOrCreateDeviceId());
  config.headers['X-Device-Id'] = deviceId;
  return config;
});
```

- [ ] **Step 3: Trigger device id seed at app start**

Open `mobile/app/_layout.tsx`, add to imports: `import { getOrCreateDeviceId } from '@/services/device/deviceId';`. In the `useEffect` block alongside `void hydrate();`, append `void getOrCreateDeviceId();`.

- [ ] **Step 4: Verify**

```bash
cd mobile && bun run typecheck && bun run lint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/api/client/client.ts mobile/app/_layout.tsx
git commit -m "api client: attach X-Device-Id header on every request"
```

---

### Task 3: API client — account

**Files:**
- Create: `mobile/src/services/api/account/account.ts`
- Create: `mobile/src/services/api/account/index.ts`

- [ ] **Step 1: Write the client**

```ts
// mobile/src/services/api/account/account.ts
import { request } from '../client';

export function changePassword(currentPassword: string, newPassword: string): Promise<null> {
  return request<null>({
    method: 'POST',
    url: '/v1/auth/password',
    data: { current_password: currentPassword, new_password: newPassword },
  });
}

export function deleteAccount(confirmEmail: string): Promise<null> {
  return request<null>({
    method: 'DELETE',
    url: '/v1/me',
    data: { confirm_email: confirmEmail },
  });
}
```

`request<null>` is fine because backend returns 204 with no body and the existing `request` helper handles empty payloads (verify by reading `services/api/client/client.ts` if uncertain).

- [ ] **Step 2: Write barrel**

```ts
// mobile/src/services/api/account/index.ts
export * from './account';
```

- [ ] **Step 3: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/services/api/account/
git commit -m "api/account: changePassword + deleteAccount"
```

---

### Task 4: API client — consents

**Files:**
- Create: `mobile/src/services/api/consents/consents.ts`
- Create: `mobile/src/services/api/consents/index.ts`

- [ ] **Step 1: Write types + client**

```ts
// mobile/src/services/api/consents/consents.ts
import { request } from '../client';

export type ConsentTypeWire = 'ai_usage' | 'terms_of_service' | 'privacy_policy';
export type ConsentSourceWire = 'register' | 'settings' | 'reconsent';

export type ConsentRecordWire = {
  type: ConsentTypeWire;
  granted: boolean;
  version: string;
  current_version: string;
  source?: ConsentSourceWire;
  occurred_at: string | null;
};

export function listConsents(): Promise<ConsentRecordWire[]> {
  return request<ConsentRecordWire[]>({ method: 'GET', url: '/v1/me/consents' });
}

export function grantConsent(type: ConsentTypeWire): Promise<null> {
  return request<null>({
    method: 'POST',
    url: '/v1/me/consents',
    data: { type, granted: true },
  });
}

export function revokeConsent(type: ConsentTypeWire): Promise<null> {
  return request<null>({
    method: 'DELETE',
    url: `/v1/me/consents/${type}`,
  });
}
```

- [ ] **Step 2: Write barrel + verify + commit**

```ts
// mobile/src/services/api/consents/index.ts
export * from './consents';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/services/api/consents/
git commit -m "api/consents: list/grant/revoke + wire types"
```

---

### Task 5: API client — dataexport

**Files:**
- Create: `mobile/src/services/api/dataexport/dataexport.ts`
- Create: `mobile/src/services/api/dataexport/index.ts`

- [ ] **Step 1: Write the client**

```ts
// mobile/src/services/api/dataexport/dataexport.ts
import { request } from '../client';

export type ExportPayloadWire = {
  generated_at: string;
  profile: Record<string, unknown> | null;
  daily_logs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  insights: Record<string, unknown>[];
};

export function fetchExport(): Promise<ExportPayloadWire> {
  return request<ExportPayloadWire>({ method: 'GET', url: '/v1/me/export' });
}
```

- [ ] **Step 2: Barrel + verify + commit**

```ts
// mobile/src/services/api/dataexport/index.ts
export * from './dataexport';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/services/api/dataexport/
git commit -m "api/dataexport: fetchExport client"
```

---

## Phase B — Feature integration: queries + mutations

### Task 6: Consents types + queries factory + mappers

**Files:**
- Create: `mobile/src/features/consents/types/types.ts`
- Create: `mobile/src/features/consents/types/index.ts`
- Create: `mobile/src/features/consents/queries/mappers.ts`
- Create: `mobile/src/features/consents/queries/queries.ts`
- Create: `mobile/src/features/consents/queries/index.ts`

- [ ] **Step 1: Write types**

```ts
// mobile/src/features/consents/types/types.ts
export type ConsentType = 'ai_usage' | 'terms_of_service' | 'privacy_policy';
export type ConsentSource = 'register' | 'settings' | 'reconsent';

export type ConsentRecord = {
  type: ConsentType;
  granted: boolean;
  version: string;
  currentVersion: string;
  source: ConsentSource | null;
  occurredAt: Date | null;
  isStale: boolean;
};
```

```ts
// mobile/src/features/consents/types/index.ts
export * from './types';
```

- [ ] **Step 2: Write mapper**

```ts
// mobile/src/features/consents/queries/mappers.ts
import type { ConsentRecordWire } from '@/services/api/consents';
import type { ConsentRecord } from '../types';

export function mapConsent(wire: ConsentRecordWire): ConsentRecord {
  return {
    type: wire.type,
    granted: wire.granted,
    version: wire.version,
    currentVersion: wire.current_version,
    source: wire.source ?? null,
    occurredAt: wire.occurred_at ? new Date(wire.occurred_at) : null,
    isStale: wire.granted && wire.version !== wire.current_version,
  };
}
```

- [ ] **Step 3: Write query factory**

```ts
// mobile/src/features/consents/queries/queries.ts
import { listConsents } from '@/services/api/consents';
import { mapConsent } from './mappers';
import type { ConsentRecord } from '../types';

// Consents are NOT mirrored to SQLite — every read hits the live backend
// so the AI gate and re-consent prompts cannot be stale.
export const consentsQuery = (userId: string | null) => ({
  queryKey: ['consents', userId] as const,
  enabled: !!userId,
  staleTime: 0,
  gcTime: 60_000,
  queryFn: async (): Promise<ConsentRecord[]> => {
    const wire = await listConsents();
    return wire.map(mapConsent);
  },
});
```

- [ ] **Step 4: Barrel + verify + commit**

```ts
// mobile/src/features/consents/queries/index.ts
export * from './queries';
export * from './mappers';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/features/consents/types mobile/src/features/consents/queries
git commit -m "consents/queries: types + mapper + offline-DISABLED query factory"
```

---

### Task 7: Consents mutation hooks

**Files:**
- Create: `mobile/src/features/consents/mutations/mutations.ts`
- Create: `mobile/src/features/consents/mutations/index.ts`

- [ ] **Step 1: Write hooks**

```ts
// mobile/src/features/consents/mutations/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { grantConsent, revokeConsent } from '@/services/api/consents';
import type { ConsentType } from '../types';

type Options = { onSuccess?: () => void; onError?: (e: unknown) => void };

export function useGrantConsent(opts: Options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => grantConsent(type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consents'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

export function useRevokeConsent(opts: Options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => revokeConsent(type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consents'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
```

- [ ] **Step 2: Barrel + verify + commit**

```ts
// mobile/src/features/consents/mutations/index.ts
export * from './mutations';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/features/consents/mutations
git commit -m "consents/mutations: useGrantConsent + useRevokeConsent"
```

---

### Task 8: Account mutation hooks

**Files:**
- Create: `mobile/src/features/account/mutations/mutations.ts`
- Create: `mobile/src/features/account/mutations/index.ts`

- [ ] **Step 1: Write hooks**

```ts
// mobile/src/features/account/mutations/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { changePassword, deleteAccount } from '@/services/api/account';

type ChangePasswordVars = { currentPassword: string; newPassword: string };

export function useChangePassword(opts: { onSuccess?: () => void; onError?: (e: unknown) => void } = {}) {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordVars) =>
      changePassword(currentPassword, newPassword),
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

export function useDeleteAccount(opts: { onSuccess?: () => void; onError?: (e: unknown) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirmEmail: string) => deleteAccount(confirmEmail),
    onSuccess: () => {
      qc.clear();
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
```

- [ ] **Step 2: Barrel + verify + commit**

```ts
// mobile/src/features/account/mutations/index.ts
export * from './mutations';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/features/account/mutations
git commit -m "account/mutations: useChangePassword + useDeleteAccount"
```

---

### Task 9: Dataexport mutation hook

**Files:**
- Create: `mobile/src/features/dataexport/mutations/mutations.ts`
- Create: `mobile/src/features/dataexport/mutations/index.ts`

- [ ] **Step 1: Write the hook (also handles save + share locally)**

```ts
// mobile/src/features/dataexport/mutations/mutations.ts
import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fetchExport } from '@/services/api/dataexport';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useExportData(opts: { onSuccess?: (uri: string) => void; onError?: (e: unknown) => void } = {}) {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const payload = await fetchExport();
      const uri = `${FileSystem.documentDirectory}neuronot-export-${todayStr()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          dialogTitle: 'Neuronot export',
        });
      }
      return uri;
    },
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}
```

- [ ] **Step 2: Confirm `expo-file-system` + `expo-sharing` are installed**

```bash
cd mobile && grep -E '"expo-file-system"|"expo-sharing"' package.json
```

If missing, install:

```bash
cd mobile && bunx expo install expo-file-system expo-sharing
```

- [ ] **Step 3: Barrel + verify + commit**

```ts
// mobile/src/features/dataexport/mutations/index.ts
export * from './mutations';
```

```bash
cd mobile && bun run typecheck
git add mobile/src/features/dataexport/mutations
# include package.json/lock if expo install ran
git add mobile/package.json mobile/bun.lockb 2>/dev/null || true
git commit -m "dataexport/mutations: fetch + save + share JSON export"
```

---

## Phase C — Auth: register UI + auth-store update

### Task 10: Register API + auth store accept consents

**Files:**
- Modify: `mobile/src/services/api/auth/auth.ts`
- Modify: `mobile/src/store/auth/auth.ts`

- [ ] **Step 1: Update register API call**

Replace the existing `register` function in `mobile/src/services/api/auth/auth.ts`:

```ts
export type RegisterConsentInput = {
  type: 'ai_usage' | 'terms_of_service' | 'privacy_policy';
  granted: boolean;
  version: string;
};

export function register(
  email: string,
  password: string,
  preferredLanguage: string | undefined,
  consents: RegisterConsentInput[],
) {
  return request<TokenResponse>({
    method: 'POST',
    url: '/v1/auth/register',
    data: {
      email,
      password,
      preferred_language: preferredLanguage,
      consents,
    },
  });
}
```

- [ ] **Step 2: Update auth store**

In `mobile/src/store/auth/auth.ts`, change the `register` action signature:

```ts
register: (email: string, password: string, preferredLanguage: string | undefined, consents: RegisterConsentInput[]) => Promise<void>;
```

And the implementation:

```ts
register: async (email, password, preferredLanguage, consents) => {
  const tokens = await apiRegister(email, password, preferredLanguage, consents);
  await persistTokens(tokens);
  set({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    user: { id: tokens.user_id, email: tokens.email, preferredLanguage: tokens.preferred_language },
  });
},
```

Add the import: `import type { RegisterConsentInput } from '@/services/api/auth';`.

- [ ] **Step 3: Verify**

```bash
cd mobile && bun run typecheck
```

Expected: failure ONLY at the register screen call site (we'll fix in Task 11).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/services/api/auth mobile/src/store/auth
git commit -m "auth: register accepts consents[] payload"
```

---

### Task 11: Register screen consent UI

**Files:**
- Modify: `mobile/app/(auth)/register.tsx`
- Add i18n keys (handled in Phase H — placeholder strings here may stay English fallback for now)

- [ ] **Step 1: Add consent state + checkboxes**

Read the current `register.tsx`. After the existing `email` / `password` state hooks, add:

```ts
const [acceptedTos, setAcceptedTos] = useState(false);
const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
const [acceptedAi, setAcceptedAi] = useState(false);
```

Replace the `onSubmit` body (the part that calls `register(email, password, i18n.language)`) with:

```ts
const onSubmit = async () => {
  if (!acceptedAi) {
    setErrorKey('errors.auth.ai_consent_required');
    return;
  }
  setSubmitting(true);
  setErrorKey(null);
  try {
    await register(email, password, i18n.language, [
      { type: 'ai_usage', granted: acceptedAi, version: 'v1' },
      { type: 'terms_of_service', granted: acceptedTos, version: '2026-05' },
      { type: 'privacy_policy', granted: acceptedPrivacy, version: '2026-05' },
    ]);
    router.replace('/(tabs)/home');
  } catch (err) {
    const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
    setErrorKey(key);
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 2: Render three Checkbox-style rows above the submit button**

After the password TextInput (and any existing error display), insert:

```tsx
<View style={{ gap: theme.space[3], marginBottom: theme.space[5] }}>
  <ConsentCheckbox
    checked={acceptedTos}
    onChange={setAcceptedTos}
    label={t('consents.tos_accept')}
  />
  <ConsentCheckbox
    checked={acceptedPrivacy}
    onChange={setAcceptedPrivacy}
    label={t('consents.privacy_accept')}
  />
  <ConsentCheckbox
    checked={acceptedAi}
    onChange={setAcceptedAi}
    label={t('consents.ai_accept')}
  />
</View>
```

Define `ConsentCheckbox` inline at the bottom of the file (private to this screen):

```tsx
function ConsentCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.sm,
          borderWidth: 2,
          borderColor: checked ? theme.colors.accent.default : theme.colors.border.subtle,
          backgroundColor: checked ? theme.colors.accent.default : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && (
          <Text style={{ color: theme.colors.accent.onAccent, fontSize: 14, lineHeight: 14 }}>✓</Text>
        )}
      </View>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: Add the consents namespace to the useTranslation call**

Replace `useTranslation(['common', 'errors'])` with `useTranslation(['common', 'errors', 'consents'])`.

- [ ] **Step 4: Verify**

```bash
cd mobile && bun run typecheck
```

Expected: clean. (Lint may complain about missing i18n keys — those land in Phase H.)

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(auth\)/register.tsx
git commit -m "register: add three consent checkboxes (ToS, Privacy, AI required)"
```

---

## Phase D — Re-consent startup gate

### Task 12: ReConsentSheet component

**Files:**
- Create: `mobile/src/features/consents/ReConsentSheet/ReConsentSheet.tsx`
- Create: `mobile/src/features/consents/ReConsentSheet/index.ts`

- [ ] **Step 1: Write the sheet**

```tsx
// mobile/src/features/consents/ReConsentSheet/ReConsentSheet.tsx
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useTheme } from '@/theme';

import { useGrantConsent } from '../mutations';
import type { ConsentRecord } from '../types';

type Props = {
  staleConsents: ConsentRecord[];
  onResolved: () => void;
};

export function ReConsentSheet({ staleConsents, onResolved }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('consents');
  const grant = useGrantConsent({
    onSuccess: () => {
      // Sheet self-dismisses when staleConsents drops to zero on the next render —
      // parent owns the visibility check and will unmount us.
    },
  });

  if (staleConsents.length === 0) return null;

  const top = staleConsents[0];
  const dismissable = top.type === 'ai_usage';

  return (
    <Modal visible animationType="slide" onRequestClose={dismissable ? onResolved : undefined} transparent>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.overlay, justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: theme.colors.surface.primary,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.space[6],
            maxHeight: '80%',
          }}
        >
          <Text style={{ ...theme.typography.title, color: theme.colors.text.primary, marginBottom: theme.space[3] }}>
            {t(`reconsent.${top.type}.title`)}
          </Text>
          <ScrollView style={{ marginBottom: theme.space[5] }}>
            <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
              {t(`reconsent.${top.type}.body`)}
            </Text>
          </ScrollView>
          <Pressable
            onPress={() => grant.mutate(top.type)}
            disabled={grant.isPending}
            style={{
              backgroundColor: grant.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[3],
            }}
          >
            {grant.isPending ? (
              <LoadingDots color={theme.colors.accent.onAccent} />
            ) : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
                {t('reconsent.accept')}
              </Text>
            )}
          </Pressable>
          {dismissable && (
            <Pressable onPress={onResolved} style={{ alignItems: 'center', paddingVertical: theme.space[3] }}>
              <Text style={{ ...theme.typography.body, color: theme.colors.text.muted }}>
                {t('reconsent.dismiss')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
```

```ts
// mobile/src/features/consents/ReConsentSheet/index.ts
export * from './ReConsentSheet';
```

- [ ] **Step 2: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/features/consents/ReConsentSheet
git commit -m "ReConsentSheet: prompt to re-grant stale consents at startup"
```

---

### Task 13: Wire re-consent gate into root layout

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ReConsentSheet } from '@/features/consents/ReConsentSheet';
import { consentsQuery } from '@/features/consents/queries';
```

- [ ] **Step 2: Inside `RootLayout`'s body**

Add after the existing `useSyncLifecycle(userId)` call:

```tsx
const consents = useQuery(consentsQuery(userId));
const [aiDismissed, setAiDismissed] = useState(false);

const stale = (consents.data ?? []).filter((c) => {
  if (!c.granted) return c.type !== 'ai_usage' || !aiDismissed;
  return c.isStale;
});
```

Then in the return JSX, render the sheet at the same level as the rest of the navigation stack (just before the closing `</ThemeProvider>` or wherever fits the existing structure):

```tsx
{userId && stale.length > 0 && (
  <ReConsentSheet
    staleConsents={stale}
    onResolved={() => setAiDismissed(true)}
  />
)}
```

- [ ] **Step 3: Verify + smoke**

```bash
cd mobile && bun run typecheck && bun run lint
```

Manual smoke (after backend is running): revoke `ai_usage`, force-quit + relaunch the app. The sheet should appear with AI body text and a dismissable "Şimdi değil" footer.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "_layout: gate app on re-consent for stale ToS/Privacy and revoked AI"
```

---

## Phase E — Profile tab + Settings root

### Task 14: ProfileSummaryCard component

**Files:**
- Create: `mobile/src/features/profile/ProfileSummaryCard/ProfileSummaryCard.tsx`
- Create: `mobile/src/features/profile/ProfileSummaryCard/index.ts`

- [ ] **Step 1: Write the card**

```tsx
// mobile/src/features/profile/ProfileSummaryCard/ProfileSummaryCard.tsx
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/feedback/Skeleton';
import { useTheme } from '@/theme';

type Props = {
  loading: boolean;
  email: string;
  memberSinceISO: string | null;
  focusProblem: string | null;
  intensity: number | null;
  sleepHours: number | null;
  caffeine: boolean | null;
  reminderHour: number | null;
  reminderEnabled: boolean;
};

function row(theme: ReturnType<typeof useTheme>, label: string, value: string) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: theme.space[2] }}>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.muted, flex: 1 }}>{label}</Text>
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>{value}</Text>
    </View>
  );
}

export function ProfileSummaryCard(p: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('settings');

  if (p.loading) {
    return (
      <View style={{ gap: theme.space[2] }}>
        <Skeleton height={28} radius="sm" />
        <Skeleton height={28} radius="sm" />
        <Skeleton height={28} radius="sm" />
      </View>
    );
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso));

  const reminderLabel = p.reminderEnabled && p.reminderHour != null
    ? `${p.reminderHour.toString().padStart(2, '0')}:00`
    : t('profile.reminder_off');

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        padding: theme.space[5],
      }}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary, marginBottom: theme.space[1] }}>
        {p.email}
      </Text>
      {p.memberSinceISO && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[3] }}>
          {t('profile.member_since', { date: formatDate(p.memberSinceISO) })}
        </Text>
      )}
      {row(theme, t('profile.focus_problem'), p.focusProblem ?? '—')}
      {row(theme, t('profile.intensity'), p.intensity != null ? `${p.intensity}/5` : '—')}
      {row(theme, t('profile.sleep'), p.sleepHours != null ? `${p.sleepHours} h` : '—')}
      {row(theme, t('profile.caffeine'), p.caffeine == null ? '—' : p.caffeine ? t('profile.yes') : t('profile.no'))}
      {row(theme, t('profile.reminder'), reminderLabel)}
    </View>
  );
}
```

```ts
// mobile/src/features/profile/ProfileSummaryCard/index.ts
export * from './ProfileSummaryCard';
```

- [ ] **Step 2: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/features/profile/ProfileSummaryCard
git commit -m "ProfileSummaryCard: render personal-data summary with skeleton"
```

---

### Task 15: SettingsLinkRow + LogoutButton + ThemePicker + LanguagePicker + ReminderRow

**Files:**
- Create: 5 components under `mobile/src/features/settings/`

This task bundles five small components that are independently trivial. Write each one as a small Foo/Foo.tsx + index.ts pair.

- [ ] **Step 1: SettingsLinkRow** — push-row icon + label + chevron

```tsx
// mobile/src/features/settings/SettingsLinkRow/SettingsLinkRow.tsx
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

type Props = { icon: string; label: string; onPress: () => void; danger?: boolean };

export function SettingsLinkRow({ icon, label, onPress, danger = false }: Props) {
  const theme = useTheme();
  const color = danger ? theme.colors.danger.default : theme.colors.text.primary;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.space[4],
        paddingHorizontal: theme.space[5],
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        marginBottom: theme.space[2],
      }}
    >
      <Text style={{ ...theme.typography.body, marginEnd: theme.space[3] }}>{icon}</Text>
      <Text style={{ ...theme.typography.body, color, flex: 1 }}>{label}</Text>
      <Text style={{ ...theme.typography.body, color: theme.colors.text.muted }}>›</Text>
    </Pressable>
  );
}
```

```ts
// mobile/src/features/settings/SettingsLinkRow/index.ts
export * from './SettingsLinkRow';
```

- [ ] **Step 2: LogoutButton**

```tsx
// mobile/src/features/settings/LogoutButton/LogoutButton.tsx
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export function LogoutButton() {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const logout = useAuthStore((s) => s.logout);
  const onPress = async () => {
    await logout();
    router.replace('/(auth)/login');
  };
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: theme.space[8],
        padding: theme.space[4],
        backgroundColor: theme.colors.danger.default,
        borderRadius: theme.radius.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.inverse }}>
        {t('auth.logout')}
      </Text>
    </Pressable>
  );
}
```

```ts
// mobile/src/features/settings/LogoutButton/index.ts
export * from './LogoutButton';
```

- [ ] **Step 3: ThemePicker** — segmented inline (refactor of existing settings.tsx logic)

```tsx
// mobile/src/features/settings/ThemePicker/ThemePicker.tsx
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme, useThemeMode } from '@/theme';

export function ThemePicker() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const { t } = useTranslation('settings');
  const modes = ['system', 'light', 'dark'] as const;
  return (
    <View>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary, marginBottom: theme.space[3] }}>
        {t('theme.title')}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        {modes.map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={{
                flex: 1,
                padding: theme.space[3],
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...theme.typography.body, color: theme.colors.text.primary }}>
                {t(`theme.${m}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

```ts
// mobile/src/features/settings/ThemePicker/index.ts
export * from './ThemePicker';
```

- [ ] **Step 4: LanguagePicker** — sheet picker

```tsx
// mobile/src/features/settings/LanguagePicker/LanguagePicker.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { BETA_LANGUAGES, SUPPORTED_LANGUAGES, setAppLanguage, type SupportedLanguage } from '@/i18n';
import { useTheme } from '@/theme';

const LABELS: Record<SupportedLanguage, string> = {
  en: 'English', tr: 'Türkçe', es: 'Español', de: 'Deutsch', fr: 'Français',
  pt: 'Português', it: 'Italiano', ar: 'العربية', ru: 'Русский', ja: '日本語', zh: '简体中文',
};

export function LanguagePicker() {
  const theme = useTheme();
  const { t, i18n } = useTranslation('settings');
  const [open, setOpen] = useState(false);
  const current = i18n.language as SupportedLanguage;

  return (
    <View>
      <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary, marginBottom: theme.space[3] }}>
        {t('language.title')}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: theme.space[4],
          backgroundColor: theme.colors.surface.elevated,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
        }}
      >
        <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
          {LABELS[current] ?? current}
        </Text>
        <Text style={{ color: theme.colors.text.muted }}>›</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} transparent>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.surface.primary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, maxHeight: '70%' }}>
            <ScrollView contentContainerStyle={{ padding: theme.space[5] }}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <Pressable
                  key={lang}
                  onPress={() => {
                    void setAppLanguage(lang);
                    setOpen(false);
                  }}
                  style={{
                    padding: theme.space[4],
                    borderRadius: theme.radius.md,
                    backgroundColor: lang === current ? theme.colors.surface.raised : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ ...theme.typography.body, color: theme.colors.text.primary, flex: 1 }}>
                    {LABELS[lang]}
                  </Text>
                  {BETA_LANGUAGES.has(lang) && (
                    <View style={{ backgroundColor: theme.colors.warning.muted, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.radius.sm }}>
                      <Text style={{ ...theme.typography.micro, color: theme.colors.text.inverse }}>
                        {t('language.beta')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

```ts
// mobile/src/features/settings/LanguagePicker/index.ts
export * from './LanguagePicker';
```

- [ ] **Step 5: ReminderRow** — switch + hour picker driven by profile + local notifications

```tsx
// mobile/src/features/settings/ReminderRow/ReminderRow.tsx
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';

import { useLocalReminder } from '@/hooks/useLocalReminder';
import { usePatchProfile } from '@/features/profile/mutations';
import { useTheme } from '@/theme';

const HOURS = [7, 9, 12, 15, 18, 21];

type Props = { enabled: boolean; hour: number | null };

export function ReminderRow({ enabled, hour }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const reminder = useLocalReminder();
  const patch = usePatchProfile();

  const onToggle = async (next: boolean) => {
    if (next) {
      const ok = await reminder.requestPermissionAndSchedule(hour ?? 9);
      if (!ok) return;
      patch.mutate({ reminder_enabled: true, reminder_hour: hour ?? 9 });
    } else {
      await reminder.cancel();
      patch.mutate({ reminder_enabled: false });
    }
  };

  const onPickHour = async (h: number) => {
    if (enabled) await reminder.requestPermissionAndSchedule(h);
    patch.mutate({ reminder_hour: h, reminder_enabled: enabled });
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space[3] }}>
        <Text style={{ ...theme.typography.heading, color: theme.colors.text.primary }}>{t('reminder.title')}</Text>
        <Switch value={enabled} onValueChange={onToggle} />
      </View>
      {enabled && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
          {HOURS.map((h) => {
            const active = hour === h;
            return (
              <Pressable
                key={h}
                onPress={() => onPickHour(h)}
                style={{
                  paddingHorizontal: theme.space[3],
                  paddingVertical: theme.space[2],
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: active ? theme.colors.border.focus : theme.colors.border.subtle,
                  backgroundColor: active ? theme.colors.surface.raised : theme.colors.surface.elevated,
                }}
              >
                <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
                  {`${h.toString().padStart(2, '0')}:00`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
```

```ts
// mobile/src/features/settings/ReminderRow/index.ts
export * from './ReminderRow';
```

NOTE: depends on `useLocalReminder` (Task 21) — typecheck fails until that hook lands.

- [ ] **Step 6: Verify + commit**

```bash
cd mobile && bun run typecheck
```

Expected: failure on `useLocalReminder` import in ReminderRow — that's deliberate. Commit anyway; Task 21 unblocks the build.

```bash
git add mobile/src/features/settings
git commit -m "settings: ThemePicker, LanguagePicker, ReminderRow, SettingsLinkRow, LogoutButton"
```

---

### Task 16: Profile tab screen

**Files:**
- Create: `mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// mobile/app/(tabs)/profile.tsx
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { ProfileEditSheet } from '@/features/profile/ProfileEditSheet';
import { ProfileSummaryCard } from '@/features/profile/ProfileSummaryCard';
import { profileQuery } from '@/features/profile/queries';
import { SettingsLinkRow } from '@/features/settings/SettingsLinkRow';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { t } = useTranslation(['common', 'settings']);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const profile = useQuery(profileQuery(userId));
  const [editVisible, setEditVisible] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
      <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
        <View style={{ alignItems: 'center', marginBottom: theme.space[3] }}>
          <NeuroMascot mood="calm" size={88} />
        </View>

        <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
          {t('common:tabs.profile')}
        </Text>

        <ProfileSummaryCard
          loading={profile.isLoading}
          email={user?.email ?? ''}
          memberSinceISO={null}
          focusProblem={profile.data?.focus_problem ?? null}
          intensity={profile.data?.intensity_level ?? null}
          sleepHours={profile.data?.avg_sleep_hours ?? null}
          caffeine={profile.data?.caffeine_daily ?? null}
          reminderHour={profile.data?.reminder_hour ?? null}
          reminderEnabled={profile.data?.reminder_enabled ?? false}
        />

        <SettingsLinkRow
          icon="✏️"
          label={t('settings:profile.edit_action')}
          onPress={() => setEditVisible(true)}
        />

        <View style={{ height: 1, backgroundColor: theme.colors.border.subtle, marginVertical: theme.space[3] }} />

        <SettingsLinkRow
          icon="⚙️"
          label={t('settings:settings_entry')}
          onPress={() => router.push('/profile/settings')}
        />
      </ScrollView>

      <ProfileEditSheet visible={editVisible} onClose={() => setEditVisible(false)} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/app/\(tabs\)/profile.tsx
git commit -m "(tabs)/profile: new tab — summary card + edit + settings entry"
```

---

### Task 17: Settings root screen

**Files:**
- Create: `mobile/app/profile/_layout.tsx`
- Create: `mobile/app/profile/settings.tsx`
- Create: `mobile/app/profile/settings/_layout.tsx`

- [ ] **Step 1: Stack layouts**

```tsx
// mobile/app/profile/_layout.tsx
import { Stack } from 'expo-router';
export default function ProfileStack() { return <Stack screenOptions={{ headerShown: false }} />; }
```

```tsx
// mobile/app/profile/settings/_layout.tsx
import { Stack } from 'expo-router';
export default function SettingsStack() { return <Stack screenOptions={{ headerShown: true }} />; }
```

- [ ] **Step 2: Settings root**

```tsx
// mobile/app/profile/settings.tsx
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { LanguagePicker } from '@/features/settings/LanguagePicker';
import { LogoutButton } from '@/features/settings/LogoutButton';
import { ReminderRow } from '@/features/settings/ReminderRow';
import { SettingsLinkRow } from '@/features/settings/SettingsLinkRow';
import { ThemePicker } from '@/features/settings/ThemePicker';
import { profileQuery } from '@/features/profile/queries';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useQuery(profileQuery(userId));

  const sectionTitle = (txt: string) => (
    <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginTop: theme.space[6], marginBottom: theme.space[3] }}>
      {txt}
    </Text>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6] }}>
          <ThemePicker />
          <View style={{ height: theme.space[5] }} />
          <LanguagePicker />
          <View style={{ height: theme.space[5] }} />
          <ReminderRow
            enabled={profile.data?.reminder_enabled ?? false}
            hour={profile.data?.reminder_hour ?? null}
          />

          {sectionTitle(t('section.account_data'))}
          <SettingsLinkRow icon="🔐" label={t('rows.account')} onPress={() => router.push('/profile/settings/account')} />
          <SettingsLinkRow icon="📥" label={t('rows.data')} onPress={() => router.push('/profile/settings/data')} />
          <SettingsLinkRow icon="✅" label={t('rows.consents')} onPress={() => router.push('/profile/settings/consents')} />

          {sectionTitle(t('section.help'))}
          <SettingsLinkRow icon="🆘" label={t('rows.crisis')} onPress={() => router.push('/profile/settings/crisis')} />
          <SettingsLinkRow icon="✉️" label={t('rows.help')} onPress={() => router.push('/profile/settings/help')} />

          {sectionTitle(t('section.about'))}
          <SettingsLinkRow icon="ℹ️" label={t('rows.about')} onPress={() => router.push('/profile/settings/about')} />
          <SettingsLinkRow icon="🔄" label={t('rows.onboarding_redo')} onPress={() => router.push('/profile/settings/onboarding-redo')} />

          <LogoutButton />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/app/profile
git commit -m "settings root: inline theme/lang/reminder + 7 push rows + logout"
```

---

## Phase F — Sub-screens

### Task 18: Account sub-screen (change password + delete sheet)

**Files:**
- Create: `mobile/src/features/account/ChangePasswordForm/ChangePasswordForm.tsx`
- Create: `mobile/src/features/account/ChangePasswordForm/index.ts`
- Create: `mobile/src/features/account/DeleteAccountSheet/DeleteAccountSheet.tsx`
- Create: `mobile/src/features/account/DeleteAccountSheet/index.ts`
- Create: `mobile/app/profile/settings/account.tsx`

- [ ] **Step 1: ChangePasswordForm**

```tsx
// mobile/src/features/account/ChangePasswordForm/ChangePasswordForm.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useChangePassword } from '@/features/account/mutations';
import { ApiError } from '@/services/api/client';
import { useTheme } from '@/theme';

export function ChangePasswordForm() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);

  const change = useChangePassword({
    onSuccess: () => {
      setCurrent(''); setNext(''); setConfirm('');
      toast.show({ messageKey: 'account.password_changed', tone: 'success' });
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  const onSubmit = () => {
    if (next !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    change.mutate({ currentPassword: current, newPassword: next });
  };

  const inputStyle = {
    ...theme.typography.body,
    backgroundColor: theme.colors.surface.elevated,
    color: theme.colors.text.primary,
    borderColor: theme.colors.border.subtle,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    marginBottom: theme.space[3],
  };

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{t('password.current')}</Text>
      <TextInput value={current} onChangeText={setCurrent} secureTextEntry style={inputStyle} placeholderTextColor={theme.colors.text.muted} />

      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{t('password.new')}</Text>
      <TextInput value={next} onChangeText={setNext} secureTextEntry style={inputStyle} placeholderTextColor={theme.colors.text.muted} />

      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{t('password.confirm')}</Text>
      <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry style={inputStyle} placeholderTextColor={theme.colors.text.muted} />

      {mismatch && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.danger.default, marginBottom: theme.space[3] }}>
          {t('password.mismatch')}
        </Text>
      )}

      <Pressable
        onPress={onSubmit}
        disabled={change.isPending || !current || !next || !confirm}
        style={{
          backgroundColor: change.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
          paddingVertical: theme.space[4],
          borderRadius: theme.radius.md,
          alignItems: 'center',
        }}
      >
        {change.isPending ? <LoadingDots color={theme.colors.accent.onAccent} /> : (
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
            {t('password.submit')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
```

```ts
// mobile/src/features/account/ChangePasswordForm/index.ts
export * from './ChangePasswordForm';
```

- [ ] **Step 2: DeleteAccountSheet**

```tsx
// mobile/src/features/account/DeleteAccountSheet/DeleteAccountSheet.tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useDeleteAccount } from '@/features/account/mutations';
import { ApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

type Props = { visible: boolean; onClose: () => void };

export function DeleteAccountSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const toast = useToast();
  const logout = useAuthStore((s) => s.logout);
  const [confirm, setConfirm] = useState('');

  const del = useDeleteAccount({
    onSuccess: async () => {
      await logout();
      router.replace('/(auth)/login');
    },
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.generic.network';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.colors.surface.primary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.space[6] }}>
          <Text style={{ ...theme.typography.title, color: theme.colors.danger.default, marginBottom: theme.space[3] }}>
            {t('delete.title')}
          </Text>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary, marginBottom: theme.space[5] }}>
            {t('delete.body')}
          </Text>

          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[1] }}>
            {t('delete.confirm_label')}
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              ...theme.typography.body,
              backgroundColor: theme.colors.surface.elevated,
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.subtle,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
              marginBottom: theme.space[5],
            }}
            placeholderTextColor={theme.colors.text.muted}
          />

          <Pressable
            onPress={() => del.mutate(confirm)}
            disabled={del.isPending || !confirm}
            style={{
              backgroundColor: del.isPending ? theme.colors.danger.muted : theme.colors.danger.default,
              paddingVertical: theme.space[4],
              borderRadius: theme.radius.md,
              alignItems: 'center',
              marginBottom: theme.space[3],
            }}
          >
            {del.isPending ? <LoadingDots color={theme.colors.text.inverse} /> : (
              <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.inverse }}>
                {t('delete.confirm_action')}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={{ alignItems: 'center', paddingVertical: theme.space[3] }}>
            <Text style={{ ...theme.typography.body, color: theme.colors.text.muted }}>{t('delete.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

```ts
// mobile/src/features/account/DeleteAccountSheet/index.ts
export * from './DeleteAccountSheet';
```

- [ ] **Step 3: Account screen wires both**

```tsx
// mobile/app/profile/settings/account.tsx
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { ChangePasswordForm } from '@/features/account/ChangePasswordForm';
import { DeleteAccountSheet } from '@/features/account/DeleteAccountSheet';
import { useTheme } from '@/theme';

export default function AccountScreen() {
  const theme = useTheme();
  const { t } = useTranslation('account');
  const [del, setDel] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[6] }}>
          <ChangePasswordForm />

          <Pressable
            onPress={() => setDel(true)}
            style={{
              padding: theme.space[4],
              borderWidth: 1,
              borderColor: theme.colors.danger.default,
              borderRadius: theme.radius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.danger.default }}>
              {t('delete.open')}
            </Text>
          </Pressable>
        </ScrollView>
        <DeleteAccountSheet visible={del} onClose={() => setDel(false)} />
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/features/account mobile/app/profile/settings/account.tsx
git commit -m "account screen: change-password form + delete-account sheet"
```

---

### Task 19: Data sub-screen (export + delete shortcut)

**Files:**
- Create: `mobile/src/features/dataexport/ExportButton/ExportButton.tsx`
- Create: `mobile/src/features/dataexport/ExportButton/index.ts`
- Create: `mobile/app/profile/settings/data.tsx`

- [ ] **Step 1: ExportButton**

```tsx
// mobile/src/features/dataexport/ExportButton/ExportButton.tsx
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { LoadingDots } from '@/components/feedback/LoadingDots';
import { useToast } from '@/components/feedback/Toast';
import { useExportData } from '@/features/dataexport/mutations';
import { ApiError } from '@/services/api/client';
import { useTheme } from '@/theme';

export function ExportButton() {
  const theme = useTheme();
  const { t } = useTranslation('data');
  const toast = useToast();
  const ex = useExportData({
    onSuccess: () => toast.show({ messageKey: 'data.export_saved', tone: 'success' }),
    onError: (err) => {
      const key = err instanceof ApiError ? err.messageKey : 'errors.export.failed';
      toast.show({ messageKey: key, tone: 'danger' });
    },
  });

  return (
    <Pressable
      onPress={() => ex.mutate()}
      disabled={ex.isPending}
      style={{
        backgroundColor: ex.isPending ? theme.colors.accent.muted : theme.colors.accent.default,
        paddingVertical: theme.space[4],
        borderRadius: theme.radius.md,
        alignItems: 'center',
      }}
    >
      {ex.isPending ? <LoadingDots color={theme.colors.accent.onAccent} /> : (
        <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
          {t('export.action')}
        </Text>
      )}
    </Pressable>
  );
}
```

```ts
// mobile/src/features/dataexport/ExportButton/index.ts
export * from './ExportButton';
```

- [ ] **Step 2: Data screen**

```tsx
// mobile/app/profile/settings/data.tsx
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { ExportButton } from '@/features/dataexport/ExportButton';
import { useTheme } from '@/theme';

export default function DataScreen() {
  const theme = useTheme();
  const { t } = useTranslation('data');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('export.body')}
          </Text>
          <ExportButton />

          <Pressable
            onPress={() => router.push('/profile/settings/account')}
            style={{ alignItems: 'center', paddingVertical: theme.space[5] }}
          >
            <Text style={{ ...theme.typography.body, color: theme.colors.danger.default }}>
              {t('delete_shortcut')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/features/dataexport/ExportButton mobile/app/profile/settings/data.tsx
git commit -m "data screen: export button + delete-account shortcut"
```

---

### Task 20: Consents sub-screen (list + revoke)

**Files:**
- Create: `mobile/src/features/consents/ConsentRow/ConsentRow.tsx`
- Create: `mobile/src/features/consents/ConsentRow/index.ts`
- Create: `mobile/src/features/consents/ConsentsList/ConsentsList.tsx`
- Create: `mobile/src/features/consents/ConsentsList/index.ts`
- Create: `mobile/app/profile/settings/consents.tsx`

- [ ] **Step 1: ConsentRow**

```tsx
// mobile/src/features/consents/ConsentRow/ConsentRow.tsx
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import type { ConsentRecord } from '../types';

type Props = { record: ConsentRecord; onRevoke?: () => void };

export function ConsentRow({ record, onRevoke }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation('consents');

  const status =
    record.granted && !record.isStale
      ? t('status.granted')
      : record.granted && record.isStale
        ? t('status.stale')
        : t('status.revoked');

  const dateLabel = record.occurredAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(record.occurredAt)
    : '—';

  return (
    <View
      style={{
        padding: theme.space[5],
        backgroundColor: theme.colors.surface.elevated,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: record.isStale ? theme.colors.danger.default : theme.colors.border.subtle,
        marginBottom: theme.space[3],
      }}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary, marginBottom: theme.space[1] }}>
        {t(`types.${record.type}`)}
      </Text>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted, marginBottom: theme.space[2] }}>
        {`${status} · ${record.version || '—'} · ${dateLabel}`}
      </Text>
      {record.granted && onRevoke && record.type === 'ai_usage' && (
        <Pressable onPress={onRevoke} style={{ alignSelf: 'flex-start', paddingVertical: theme.space[2] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.danger.default }}>
            {t('actions.revoke')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

```ts
// mobile/src/features/consents/ConsentRow/index.ts
export * from './ConsentRow';
```

- [ ] **Step 2: ConsentsList**

```tsx
// mobile/src/features/consents/ConsentsList/ConsentsList.tsx
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

import { ConsentRow } from '../ConsentRow';
import { useRevokeConsent } from '../mutations';
import { consentsQuery } from '../queries';
import type { ConsentType } from '../types';

export function ConsentsList() {
  const theme = useTheme();
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const q = useQuery(consentsQuery(userId));
  const revoke = useRevokeConsent({
    onError: () => toast.show({ messageKey: 'errors.generic.network', tone: 'danger' }),
  });

  if (q.isLoading) {
    return <View style={{ gap: theme.space[3] }}><Skeleton height={88} /><Skeleton height={88} /><Skeleton height={88} /></View>;
  }
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <View>
      {(q.data ?? []).map((c) => (
        <ConsentRow
          key={c.type}
          record={c}
          onRevoke={() => revoke.mutate(c.type as ConsentType)}
        />
      ))}
    </View>
  );
}
```

```ts
// mobile/src/features/consents/ConsentsList/index.ts
export * from './ConsentsList';
```

- [ ] **Step 3: Consents screen**

```tsx
// mobile/app/profile/settings/consents.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { ConsentsList } from '@/features/consents/ConsentsList';
import { useTheme } from '@/theme';

export default function ConsentsScreen() {
  const theme = useTheme();
  const { t } = useTranslation('consents');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('intro')}
          </Text>
          <ConsentsList />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 4: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/features/consents/ConsentRow mobile/src/features/consents/ConsentsList mobile/app/profile/settings/consents.tsx
git commit -m "consents screen: list + revoke for ai_usage"
```

---

### Task 21: Local reminder hook + crisis/about/help/onboarding-redo screens

**Files:**
- Create: `mobile/src/hooks/useLocalReminder/useLocalReminder.ts`
- Create: `mobile/src/hooks/useLocalReminder/index.ts`
- Create: `mobile/src/features/crisis/CrisisHotlineList/CrisisHotlineList.tsx` + index
- Create: `mobile/src/features/crisis/types/types.ts` + index
- Create: `mobile/src/features/about/VersionRow/...` + index (3 components)
- Create: `mobile/src/features/help/SupportMailtoButton/...` + index (2 components)
- Create: `mobile/app/profile/settings/{crisis,about,help,onboarding-redo}.tsx`

- [ ] **Step 1: Confirm `expo-notifications`, `expo-application`, `expo-linking` are installed**

```bash
cd mobile && grep -E '"expo-notifications"|"expo-application"|"expo-linking"' package.json
```

If missing:

```bash
cd mobile && bunx expo install expo-notifications expo-application expo-linking
```

- [ ] **Step 2: useLocalReminder hook**

```ts
// mobile/src/hooks/useLocalReminder/useLocalReminder.ts
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'neuronot.daily.reminder';

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

export function useLocalReminder() {
  return {
    requestPermissionAndSchedule: async (hour: number) => {
      const granted = await ensurePermission();
      if (!granted) return false;
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: { title: 'Neuronot', body: 'Time to log your day.' },
        trigger: { hour, minute: 0, repeats: true },
      });
      return true;
    },
    cancel: async () => {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    },
  };
}
```

```ts
// mobile/src/hooks/useLocalReminder/index.ts
export * from './useLocalReminder';
```

- [ ] **Step 3: Crisis hotline data + screen**

```ts
// mobile/src/features/crisis/types/types.ts
export type HotlineEntry = { label: string; tel: string };
export type HotlinesByLocale = Record<string, HotlineEntry[]>;

export const hotlines: HotlinesByLocale = {
  tr: [
    { label: 'İntihar ve Krize Müdahale Hattı (İBB)', tel: '182' },
    { label: 'Polis İmdat', tel: '155' },
    { label: 'Acil Yardım', tel: '112' },
  ],
  en: [
    { label: '988 Suicide & Crisis Lifeline (US)', tel: '988' },
    { label: 'Emergency Services', tel: '911' },
  ],
  de: [{ label: 'Telefonseelsorge', tel: '08001110111' }, { label: 'Notruf', tel: '112' }],
  fr: [{ label: 'Numéro national de prévention du suicide', tel: '3114' }, { label: 'Urgences', tel: '112' }],
  es: [{ label: 'Teléfono de la Esperanza', tel: '717003717' }, { label: 'Emergencias', tel: '112' }],
  pt: [{ label: 'SOS Voz Amiga', tel: '213544545' }, { label: 'Emergência', tel: '112' }],
  it: [{ label: 'Telefono Amico', tel: '0223272328' }, { label: 'Emergenze', tel: '112' }],
  ar: [{ label: 'Emergency', tel: '112' }],
  ru: [{ label: 'Психологическая помощь', tel: '88002000122' }, { label: 'Скорая', tel: '112' }],
  ja: [{ label: 'いのちの電話', tel: '0570064556' }, { label: '緊急', tel: '110' }],
  zh: [{ label: '心理援助热线', tel: '8008101117' }, { label: '紧急', tel: '110' }],
};
```

```ts
// mobile/src/features/crisis/types/index.ts
export * from './types';
```

```tsx
// mobile/src/features/crisis/CrisisHotlineList/CrisisHotlineList.tsx
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { hotlines } from '../types';

export function CrisisHotlineList() {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const list = hotlines[i18n.language] ?? hotlines.en;

  return (
    <View>
      {list.map((h) => (
        <Pressable
          key={h.tel}
          onPress={() => Linking.openURL(`tel:${h.tel}`)}
          style={{
            padding: theme.space[4],
            backgroundColor: theme.colors.surface.elevated,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            marginBottom: theme.space[2],
          }}
        >
          <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>{h.label}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.accent.default, marginTop: theme.space[1] }}>{h.tel}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

```ts
// mobile/src/features/crisis/CrisisHotlineList/index.ts
export * from './CrisisHotlineList';
```

```tsx
// mobile/app/profile/settings/crisis.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { NeuroMascot } from '@/components/brand/NeuroMascot';
import { CrisisHotlineList } from '@/features/crisis/CrisisHotlineList';
import { useTheme } from '@/theme';

export default function CrisisScreen() {
  const theme = useTheme();
  const { t } = useTranslation('crisis');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <View style={{ alignItems: 'center' }}>
            <NeuroMascot mood="calm" size={88} />
          </View>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>{t('intro')}</Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{t('disclaimer')}</Text>
          <CrisisHotlineList />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 4: About + Help + Onboarding-redo screens (compact, no nested components)**

```tsx
// mobile/src/features/about/VersionRow/VersionRow.tsx
import * as Application from 'expo-application';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

export function VersionRow() {
  const theme = useTheme();
  const { t } = useTranslation('about');
  return (
    <View style={{ padding: theme.space[4], backgroundColor: theme.colors.surface.elevated, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border.subtle }}>
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.muted }}>{t('version_label')}</Text>
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.text.primary }}>
        {Application.nativeApplicationVersion ?? '—'} ({Application.nativeBuildVersion ?? '—'})
      </Text>
    </View>
  );
}
```

```ts
// mobile/src/features/about/VersionRow/index.ts
export * from './VersionRow';
```

```tsx
// mobile/app/profile/settings/about.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView } from 'react-native';

import { VersionRow } from '@/features/about/VersionRow';
import { useTheme } from '@/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const { t } = useTranslation('about');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[4] }}>
          <VersionRow />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

```tsx
// mobile/src/features/help/SupportMailtoButton/SupportMailtoButton.tsx
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text } from 'react-native';

import { useTheme } from '@/theme';

export function SupportMailtoButton() {
  const theme = useTheme();
  const { t } = useTranslation('help');
  return (
    <Pressable
      onPress={() => Linking.openURL('mailto:support@neuronot.app')}
      style={{
        padding: theme.space[4],
        backgroundColor: theme.colors.accent.default,
        borderRadius: theme.radius.md,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>{t('contact')}</Text>
    </Pressable>
  );
}
```

```ts
// mobile/src/features/help/SupportMailtoButton/index.ts
export * from './SupportMailtoButton';
```

```tsx
// mobile/app/profile/settings/help.tsx
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, ScrollView, Text } from 'react-native';

import { SupportMailtoButton } from '@/features/help/SupportMailtoButton';
import { useTheme } from '@/theme';

export default function HelpScreen() {
  const theme = useTheme();
  const { t } = useTranslation('help');
  return (
    <>
      <Stack.Screen options={{ title: t('title') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>{t('intro')}</Text>
          <SupportMailtoButton />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

```tsx
// mobile/app/profile/settings/onboarding-redo.tsx
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';

import { useTheme } from '@/theme';

export default function OnboardingRedoScreen() {
  const theme = useTheme();
  const { t } = useTranslation('settings');
  return (
    <>
      <Stack.Screen options={{ title: t('rows.onboarding_redo') }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.primary }}>
        <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}>
          <Text style={{ ...theme.typography.body, color: theme.colors.text.secondary }}>
            {t('onboarding_redo.body')}
          </Text>
          <Pressable
            onPress={() => router.replace('/onboarding')}
            style={{
              padding: theme.space[4],
              backgroundColor: theme.colors.accent.default,
              borderRadius: theme.radius.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ ...theme.typography.bodyMedium, color: theme.colors.accent.onAccent }}>
              {t('onboarding_redo.action')}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/src/hooks/useLocalReminder \
  mobile/src/features/crisis mobile/src/features/about mobile/src/features/help \
  mobile/app/profile/settings/crisis.tsx mobile/app/profile/settings/about.tsx \
  mobile/app/profile/settings/help.tsx mobile/app/profile/settings/onboarding-redo.tsx \
  mobile/package.json mobile/bun.lockb 2>/dev/null || true
git commit -m "screens: useLocalReminder hook + crisis/about/help/onboarding-redo screens"
```

---

## Phase G — Tab swap + i18n + smoke

### Task 22: Tab bar — replace settings with profile

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Delete: `mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Update tab layout**

In `mobile/app/(tabs)/_layout.tsx`, change:

```tsx
<Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
```

to:

```tsx
<Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
```

- [ ] **Step 2: Delete the old settings tab**

```bash
git rm mobile/app/\(tabs\)/settings.tsx
```

- [ ] **Step 3: Verify + commit**

```bash
cd mobile && bun run typecheck
git add mobile/app/\(tabs\)/_layout.tsx
git commit -m "(tabs): replace settings with profile entry"
```

---

### Task 23: i18n — EN+TR native authoring + namespace registration

**Files:**
- Create: `mobile/src/locales/{en,tr}/{settings,account,consents,data,about,help}.json` (12 files)
- Modify: `mobile/src/locales/{en,tr}/crisis.json` (extend)
- Modify: `mobile/src/i18n/index.ts` (namespaces array)
- Modify: `mobile/src/i18n/resources/resources.ts` (wire 7 new namespaces × 11 locales)

- [ ] **Step 1: Author EN + TR for the 6 new namespaces**

Each JSON should cover the keys referenced by Tasks 11–21. Use the fallback EN strings already in components as the source of truth. For the schema, here is `mobile/src/locales/en/settings.json` as an exhaustive template — adapt for `tr` by translating values:

```json
{
  "title": "Settings",
  "settings_entry": "Settings",
  "section": {
    "account_data": "Account & data",
    "help": "Help",
    "about": "About"
  },
  "rows": {
    "account": "Account",
    "data": "My data",
    "consents": "Consents",
    "crisis": "Crisis & support",
    "help": "Contact",
    "about": "About",
    "onboarding_redo": "Restart onboarding"
  },
  "theme": {
    "title": "Theme",
    "system": "Match system",
    "light": "Light",
    "dark": "Dark"
  },
  "language": {
    "title": "Language",
    "beta": "Beta"
  },
  "reminder": {
    "title": "Daily reminder"
  },
  "profile": {
    "edit_action": "Edit profile",
    "member_since": "Member since {{date}}",
    "focus_problem": "Focus problem",
    "intensity": "Intensity",
    "sleep": "Avg sleep",
    "caffeine": "Caffeine",
    "reminder": "Reminder",
    "yes": "Yes",
    "no": "No",
    "reminder_off": "Off"
  },
  "onboarding_redo": {
    "body": "Restarting onboarding will not delete your data, but you'll re-enter your profile preferences.",
    "action": "Restart"
  }
}
```

For `account.json`:

```json
{
  "title": "Account",
  "password": {
    "current": "Current password",
    "new": "New password",
    "confirm": "Confirm new password",
    "submit": "Change password",
    "mismatch": "New password and confirmation do not match",
    "changed": "Password changed. Other devices will need to sign in again."
  },
  "delete": {
    "open": "Delete my account",
    "title": "Delete account",
    "body": "All your data will be removed. This cannot be undone.",
    "confirm_label": "Type your email to confirm",
    "confirm_action": "Delete forever",
    "cancel": "Cancel"
  }
}
```

For `consents.json`:

```json
{
  "title": "Consents",
  "intro": "Manage what you allow Neuronot to do with your data.",
  "tos_accept": "I accept the Terms of Service.",
  "privacy_accept": "I accept the Privacy Policy.",
  "ai_accept": "I allow AI to analyze my entries to generate insights.",
  "types": {
    "ai_usage": "AI insight analysis",
    "terms_of_service": "Terms of Service",
    "privacy_policy": "Privacy Policy"
  },
  "status": {
    "granted": "Granted",
    "stale": "Update required",
    "revoked": "Revoked"
  },
  "actions": {
    "revoke": "Revoke"
  },
  "reconsent": {
    "accept": "Accept",
    "dismiss": "Not now",
    "ai_usage": {
      "title": "AI consent needed",
      "body": "We've updated how the AI uses your data. Re-grant consent to keep AI insights enabled."
    },
    "terms_of_service": {
      "title": "Terms of Service updated",
      "body": "Please review and accept the updated Terms to continue."
    },
    "privacy_policy": {
      "title": "Privacy Policy updated",
      "body": "Please review and accept the updated Privacy Policy to continue."
    }
  }
}
```

For `data.json`:

```json
{
  "title": "My data",
  "export": {
    "body": "Download a JSON copy of everything we store about you.",
    "action": "Export my data",
    "saved": "Export saved and ready to share."
  },
  "delete_shortcut": "Delete my account"
}
```

For `about.json`:

```json
{
  "title": "About",
  "version_label": "Version"
}
```

For `help.json`:

```json
{
  "title": "Help",
  "intro": "We read every email.",
  "contact": "Contact support"
}
```

Mirror each file in `tr/` with native Turkish translations. Confirm length of each file matches.

- [ ] **Step 2: Extend `crisis.json`**

In `en/crisis.json`, add (or update if already present):

```json
{
  "title": "Crisis & support",
  "intro": "If you or someone you know is in danger, please reach out for help.",
  "disclaimer": "Neuronot is not a medical or emergency tool."
}
```

Mirror in `tr/`.

- [ ] **Step 3: Update `mobile/src/i18n/index.ts`**

Replace the `ns: [...]` array with:

```ts
ns: ['common', 'errors', 'onboarding', 'daily-log', 'events', 'timeline', 'insights', 'crisis', 'settings', 'account', 'consents', 'data', 'about', 'help'],
```

- [ ] **Step 4: Wire resources**

Open `mobile/src/i18n/resources/resources.ts`. For each of the 11 locales, add 6 new namespace imports (settings, account, consents, data, about, help). Following the existing alphabetical pattern. EN block:

```ts
import enAbout from '@/locales/en/about.json';
import enAccount from '@/locales/en/account.json';
// ... existing imports
import enConsents from '@/locales/en/consents.json';
import enData from '@/locales/en/data.json';
import enHelp from '@/locales/en/help.json';
import enSettings from '@/locales/en/settings.json';
```

In the `resources` map, add the 6 new namespace keys to each locale:

```ts
en: {
  // ... existing namespaces
  settings: enSettings,
  account: enAccount,
  consents: enConsents,
  data: enData,
  about: enAbout,
  help: enHelp,
},
```

Repeat for `tr` (same JSON paths).

For `es`/`de`/`fr`/`pt`/`it`/`ar`/`ru`/`ja`/`zh` — point to a temporary copy of `en/*` for now. Task 24 fills in real translations.

```bash
# Quickly scaffold copies as a stop-gap so the import doesn't fail at boot:
for L in es de fr pt it ar ru ja zh; do
  for N in settings account consents data about help; do
    cp mobile/src/locales/en/${N}.json mobile/src/locales/${L}/${N}.json
  done
done
```

- [ ] **Step 5: Tab key**

In `mobile/src/locales/en/common.json`, add to `tabs`:

```json
"profile": "Profile"
```

Mirror in `tr/common.json` with `"profile": "Profil"`.

- [ ] **Step 6: Verify**

```bash
cd mobile && bun run typecheck && bun run validate:i18n
```

Expected: typecheck clean. `validate:i18n` may flag missing keys in non-EN/TR locales — acceptable since they share EN content as a stop-gap.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/locales mobile/src/i18n
git commit -m "i18n: 6 new namespaces (en+tr native, others EN stop-gap)"
```

---

### Task 24: i18n — non-EN/TR translations (LLM pass)

**Files:**
- Modify: `mobile/src/locales/{es,de,fr,pt,it,ar,ru,ja,zh}/{settings,account,consents,data,about,help}.json` (54 files)
- Modify: existing `crisis.json` extensions in same 9 locales

This task is mechanical: copy EN content, then translate. If a translation pass is not yet feasible in the current session, leave the EN stop-gaps from Task 23 in place and FILE this task as a follow-up with status "BLOCKED — needs LLM translation cycle". Document this in the commit message.

- [ ] **Step 1: Translate each of the 54 files into the target locale**

For each locale `<L>` and namespace `<N>`, open `mobile/src/locales/<L>/<N>.json`, translate every value (preserving keys and `{{variables}}` placeholders) into the language. Use Task 23's EN content as the source. Native review is not required for this task — skim review per CLAUDE.md is acceptable for these languages.

- [ ] **Step 2: Validate**

```bash
cd mobile && bun run validate:i18n
```

Expected: PASS for all 11 locales.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/locales
git commit -m "i18n: LLM translations for 6 new namespaces in 9 locales"
```

---

### Task 25: Hafta 8 verification runbook

**Files:**
- Create: `docs/HAFTA8_VERIFICATION.md`

- [ ] **Step 1: Write the runbook**

Pattern after `docs/HAFTA7_VERIFICATION.md`. Cover:

```markdown
# Hafta 8 Verification Runbook

Profile/Settings mobile delivery: Profile tab + Settings root + 7 sub-screens, register consent UI, re-consent gate, local reminders, i18n × 11 locales.

## 0. Pre-requisites
- Plan 1 (`HAFTA7_VERIFICATION.md`) sections 1-9 PASS.
- Mobile dev server running: `make mobile-dev` from repo root.
- Test user `test@neuronot.app` exists.

## 1. Statik kontroller
```bash
cd mobile
bun run typecheck
bun run lint
bun run validate:i18n
bun run validate:assets
```

Beklenen: tümü PASS.

## 2. Register consent UI
- Open the app, fresh install (or wipe SecureStore via simulator → erase content).
- Navigate to register screen.
- Three checkboxes visible: ToS, Privacy, AI usage.
- Tap "Hesap oluştur" without checking AI → inline error (`AI consent required`).
- Check all three, submit → home screen renders.
- Backend log shows `POST /v1/auth/register` 201 with consents payload.

## 3. Profile tab
- Confirm bottom tabs are: Home · Timeline · Insights · Profile (no Settings).
- Tap Profile → see avatar, email, summary card, Edit Profile push, Settings push.
- Tap Edit Profile → ProfileEditSheet opens. Change one field, Save → toast, summary card refreshes.

## 4. Settings root
- From Profile, tap Settings.
- Inline: Theme (3-segment), Language (sheet), Daily reminder (switch + hour grid).
- Push rows: Account, My data, Consents, Crisis & support, Contact, About, Restart onboarding.
- Logout button at bottom (danger).

## 5. Reminder permission flow
- Toggle Reminder ON → system permission prompt.
- Grant → hour grid visible. Pick 09:00.
- Force-quit + relaunch tomorrow at 09:00 → notification fires (manually verify by setting hour to current+1min during testing).

## 6. Account screen
- Settings → Account.
- Wrong current password → toast `Mevcut şifre yanlış`.
- Correct → toast `Şifre güncellendi`.
- Tap Delete my account → sheet opens. Wrong email → toast mismatch. Correct email → 204, app navigates to login screen.

## 7. Data export
- Settings → My data → Export my data.
- File save + share sheet appears.
- Open shared JSON, confirm `profile`, `daily_logs`, `events`, `insights` keys.

## 8. Consents
- Settings → Consents.
- Three rows with current versions and granted=true.
- Tap Revoke on AI row → ai_usage row updates to "Revoked" with red border.
- Insights tab → Generate insight → backend returns 403 `INSIGHT_CONSENT_REVOKED` → mobile banner "AI consent required..."
- Tap banner → deep-link to Consents screen.

## 9. Re-consent gate
- DB-edit (psql): bump `currentVersions['privacy_policy']` to `2026-08` in `consents/types.go`, restart API.
- Mobile pull-to-refresh consents → ReConsentSheet appears for privacy_policy. Not dismissable.
- Tap Accept → 204; sheet closes; row updates.

## 10. Crisis screen
- Settings → Crisis & support. Calm mascot. Locale-correct hotline numbers (TR: 182, 155, 112).
- Tap a row → system phone dialer opens (manual verify on real device).

## 11. About + Help + Onboarding redo
- Settings → About → version row from `expo-application`.
- Settings → Contact → mailto opens.
- Settings → Restart onboarding → `/onboarding` route opens.

## 12. RTL (ar)
- Settings → Language → العربية.
- App layout flips. Push-row chevron flips. No `marginLeft`/`marginRight` glitches.
- Switch back to Türkçe.

## Exit criteria
- [ ] All sections above pass on iOS simulator + Android emulator.
- [ ] No console errors in dev tools.
- [ ] No `console.log` shipped in committed code.
```

- [ ] **Step 2: Commit**

```bash
git add docs/HAFTA8_VERIFICATION.md
git commit -m "docs: Hafta 8 verification runbook for mobile profile/settings"
```

---

## Plan complete

After Task 25 commits, the mobile half of the Profile/Settings overhaul ships. To verify end-to-end, follow `docs/HAFTA8_VERIFICATION.md` from section 0 to 12. Once Plan 1 + Plan 2 are merged, the entire Profile/Settings + consents audit feature is live.
