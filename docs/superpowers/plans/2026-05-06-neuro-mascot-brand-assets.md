# Neuro Mascot Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Neuro mascot into Expo native assets, splash, and selected mobile UI surfaces while preserving Neuronot's calm personal-awareness tone.

**Architecture:** Source mascot files stay under `mobile/assets/images/`; generated native assets stay under `mobile/assets/`. Runtime UI uses one reusable `NeuroMascot` component and one asset registry so screen files do not import PNGs directly. Documentation and validation scripts make the asset contract repeatable for TestFlight preparation.

**Tech Stack:** Expo SDK 52, React Native `Image`, TypeScript, Bun scripts, `sharp` for deterministic PNG generation and metadata validation, existing theme/i18n system.

---

## Source Context

Existing mascot source assets:

- `mobile/assets/images/neuro-angry.png`
- `mobile/assets/images/neuro-calm.png`
- `mobile/assets/images/neuro-curios.png`
- `mobile/assets/images/neuro-encouraging.png`
- `mobile/assets/images/neuro-excited.png`
- `mobile/assets/images/neuro-happy.png`
- `mobile/assets/images/neuro-playful.png`
- `mobile/assets/images/neuro-sad.png`
- `mobile/assets/images/neuro-shocked.png`
- `mobile/assets/images/neuro-sleepy.png`
- `mobile/assets/images/neuro-thinking.png`

Each is a 1254x1254 PNG. The implementation should not rename these source files in this slice.

## File Map

- Modify: `mobile/package.json`  
  Add `sharp` dev dependency through Bun and add `generate:assets` / `validate:assets` scripts.

- Create: `mobile/scripts/generate-neuro-assets.cjs`  
  Generate `icon.png`, `adaptive-icon.png`, and `splash.png` from source mascot files.

- Create: `mobile/scripts/validate-assets.cjs`  
  Verify generated asset existence and dimensions.

- Modify: `mobile/app.json`  
  Keep existing icon/splash paths but align `expo-splash-screen` plugin config with top-level splash config.

- Create: `mobile/src/components/brand/neuroAssets.ts`  
  Central registry of allowed mascot moods and PNG `require()` calls.

- Create: `mobile/src/components/brand/NeuroMascot.tsx`  
  Reusable mascot renderer with fixed semantic mood and size API.

- Modify: `mobile/app/(auth)/login.tsx`  
  Add calm mascot above app name.

- Modify: `mobile/app/(auth)/register.tsx`  
  Add happy mascot above register title.

- Modify: `mobile/app/onboarding.tsx`  
  Add mood mapping per onboarding step.

- Modify: `mobile/app/(tabs)/home.tsx`  
  Add compact mascot to the home header.

- Modify: `mobile/src/features/daily-log/DailyLogCard.tsx`  
  Add encouraging mascot to empty daily-log state.

- Modify: `mobile/app/(tabs)/insights.tsx`  
  Add thinking mascot to empty state and calm mascot to crisis card.

- Modify: `mobile/assets/README.md`  
  Document source vs generated assets and scripts.

- Modify: `docs/ARCHITECTURE.md`  
  Add mascot asset pipeline and UI usage rules.

- Modify: `docs/PRD.md`  
  Add mascot tone boundary under design direction.

- Modify: `CLAUDE.md`  
  Add asset generation/validation commands and mascot usage rule.

- Modify: `README.md`  
  Link asset verification docs.

- Create: `docs/HAFTA5_VERIFICATION.md`  
  Add polish/TestFlight asset and UI smoke checks.

---

### Task 1: Asset Generation and Validation Scripts

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/scripts/generate-neuro-assets.cjs`
- Create: `mobile/scripts/validate-assets.cjs`

- [ ] **Step 1: Add scripts and sharp dependency**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun add -d sharp
```

Then modify `mobile/package.json` scripts:

```json
"generate:assets": "node scripts/generate-neuro-assets.cjs",
"validate:assets": "node scripts/validate-assets.cjs"
```

Expected: `package.json` and `bun.lock` update. `sharp` appears under `devDependencies`.

- [ ] **Step 2: Create asset generation script**

Create `mobile/scripts/generate-neuro-assets.cjs`:

```js
/* global __dirname */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');
const sourceDir = path.join(assetsDir, 'images');
const darkBackground = '#0F1115';

const outputs = {
  icon: path.join(assetsDir, 'icon.png'),
  adaptiveIcon: path.join(assetsDir, 'adaptive-icon.png'),
  splash: path.join(assetsDir, 'splash.png'),
};

function source(name) {
  const file = path.join(sourceDir, name);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing source mascot asset: ${file}`);
  }
  return file;
}

async function squareAsset(input, output, size, padding) {
  const mascotSize = size - padding * 2;
  const mascot = await sharp(input)
    .resize(mascotSize, mascotSize, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: darkBackground,
    },
  })
    .composite([{ input: mascot, gravity: 'center' }])
    .png()
    .toFile(output);
}

async function splashAsset(input, output) {
  const width = 1284;
  const height = 2778;
  const mascot = await sharp(input)
    .resize(720, 720, { fit: 'contain' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: darkBackground,
    },
  })
    .composite([{ input: mascot, top: 820, left: Math.round((width - 720) / 2) }])
    .png()
    .toFile(output);
}

async function main() {
  await squareAsset(source('neuro-calm.png'), outputs.icon, 1024, 104);
  await squareAsset(source('neuro-calm.png'), outputs.adaptiveIcon, 1024, 136);
  await splashAsset(source('neuro-happy.png'), outputs.splash);
  console.log('[assets] generated icon.png, adaptive-icon.png, splash.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 3: Create asset validation script**

Create `mobile/scripts/validate-assets.cjs`:

```js
/* global __dirname */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'assets');

const expected = [
  { file: 'icon.png', width: 1024, height: 1024 },
  { file: 'adaptive-icon.png', width: 1024, height: 1024 },
  { file: 'splash.png', width: 1284, height: 2778 },
];

async function main() {
  for (const item of expected) {
    const file = path.join(assetsDir, item.file);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing generated asset: ${file}`);
    }
    const meta = await sharp(file).metadata();
    if (meta.width !== item.width || meta.height !== item.height) {
      throw new Error(`${item.file} must be ${item.width}x${item.height}; got ${meta.width}x${meta.height}`);
    }
  }
  console.log('[assets] generated assets are present with expected dimensions');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 4: Run generator and validator**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run generate:assets
bun run validate:assets
```

Expected:

```text
[assets] generated icon.png, adaptive-icon.png, splash.png
[assets] generated assets are present with expected dimensions
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add mobile/package.json mobile/bun.lock mobile/scripts/generate-neuro-assets.cjs mobile/scripts/validate-assets.cjs mobile/assets/icon.png mobile/assets/adaptive-icon.png mobile/assets/splash.png
git commit -m "Generate Neuro native assets"
```

---

### Task 2: Expo Config and Asset Docs

**Files:**
- Modify: `mobile/app.json`
- Modify: `mobile/assets/README.md`

- [ ] **Step 1: Align splash plugin config**

Modify `mobile/app.json` plugin entry:

```json
[
  "expo-splash-screen",
  {
    "image": "./assets/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#0F1115"
  }
]
```

Keep top-level `expo.splash` unchanged:

```json
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "contain",
  "backgroundColor": "#0F1115"
}
```

- [ ] **Step 2: Update asset README**

Replace `mobile/assets/README.md` with:

```md
# Assets

This folder contains Expo runtime assets.

## Source mascot images

`assets/images/neuro-*.png` files are source mascot variants. Do not edit them in place. Generated app assets are derived from these files.

## Generated files

- `icon.png` 1024x1024 — iOS/App Store icon source
- `adaptive-icon.png` 1024x1024 — Android adaptive icon foreground
- `splash.png` 1284x2778 — native splash image

## Commands

```bash
cd mobile
bun run generate:assets
bun run validate:assets
```

`generate:assets` uses `neuro-calm.png` for icon/adaptive icon and `neuro-happy.png` for splash. The background color is `#0F1115`, matching the default soft dark theme.
```

- [ ] **Step 3: Validate config JSON and assets**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json ok')"
bun run validate:assets
```

Expected: `app.json ok` and asset validation PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add mobile/app.json mobile/assets/README.md
git commit -m "Document Neuro asset pipeline"
```

---

### Task 3: Mascot Asset Registry and Component

**Files:**
- Create: `mobile/src/components/brand/neuroAssets.ts`
- Create: `mobile/src/components/brand/NeuroMascot.tsx`

- [ ] **Step 1: Create asset registry**

Create `mobile/src/components/brand/neuroAssets.ts`:

```ts
import type { ImageSourcePropType } from 'react-native';

export const neuroMoods = {
  calm: require('../../../assets/images/neuro-calm.png'),
  happy: require('../../../assets/images/neuro-happy.png'),
  thinking: require('../../../assets/images/neuro-thinking.png'),
  encouraging: require('../../../assets/images/neuro-encouraging.png'),
  sleepy: require('../../../assets/images/neuro-sleepy.png'),
  sad: require('../../../assets/images/neuro-sad.png'),
} satisfies Record<string, ImageSourcePropType>;

export type NeuroMood = keyof typeof neuroMoods;
```

- [ ] **Step 2: Create mascot component**

Create `mobile/src/components/brand/NeuroMascot.tsx`:

```tsx
import { Image, View } from 'react-native';

import { useTheme } from '@/theme';

import { neuroMoods, type NeuroMood } from './neuroAssets';

type Props = {
  mood?: NeuroMood;
  size?: number;
  framed?: boolean;
  accessibilityLabel?: string;
};

export function NeuroMascot({
  mood = 'calm',
  size = 96,
  framed = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const image = (
    <Image
      source={neuroMoods[mood]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    />
  );

  if (!framed) return image;

  return (
    <View
      style={{
        width: size + theme.space[4],
        height: size + theme.space[4],
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.elevated,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      {image}
    </View>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add mobile/src/components/brand/neuroAssets.ts mobile/src/components/brand/NeuroMascot.tsx
git commit -m "Add Neuro mascot component"
```

---

### Task 4: Auth and Onboarding UI Placement

**Files:**
- Modify: `mobile/app/(auth)/login.tsx`
- Modify: `mobile/app/(auth)/register.tsx`
- Modify: `mobile/app/onboarding.tsx`

- [ ] **Step 1: Add mascot to login**

In `mobile/app/(auth)/login.tsx`, add:

```ts
import { NeuroMascot } from '@/components/brand/NeuroMascot';
```

Inside the centered container, before app name:

```tsx
<View style={{ alignItems: 'center', marginBottom: theme.space[5] }}>
  <NeuroMascot mood="calm" size={112} />
</View>
```

- [ ] **Step 2: Add mascot to register**

In `mobile/app/(auth)/register.tsx`, add:

```ts
import { NeuroMascot } from '@/components/brand/NeuroMascot';
```

Inside the centered container, before register title:

```tsx
<View style={{ alignItems: 'center', marginBottom: theme.space[5] }}>
  <NeuroMascot mood="happy" size={112} />
</View>
```

- [ ] **Step 3: Add mood mapping to onboarding**

In `mobile/app/onboarding.tsx`, add:

```ts
import { NeuroMascot, type NeuroMood } from '@/components/brand/NeuroMascot';
```

If `NeuroMood` is not exported from the component file, export it there:

```ts
export type { NeuroMood } from './neuroAssets';
```

Add near constants:

```ts
const STEP_MASCOT: Record<number, NeuroMood> = {
  1: 'thinking',
  2: 'encouraging',
  3: 'calm',
};
```

Add below subtitle:

```tsx
<View style={{ alignItems: 'center', marginBottom: theme.space[6] }}>
  <NeuroMascot mood={STEP_MASCOT[step]} size={128} />
</View>
```

- [ ] **Step 4: Run checks**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add 'mobile/app/(auth)/login.tsx' 'mobile/app/(auth)/register.tsx' mobile/app/onboarding.tsx mobile/src/components/brand/NeuroMascot.tsx
git commit -m "Use Neuro mascot in auth and onboarding"
```

---

### Task 5: Home, Daily Log, and Insights UI Placement

**Files:**
- Modify: `mobile/app/(tabs)/home.tsx`
- Modify: `mobile/src/features/daily-log/DailyLogCard.tsx`
- Modify: `mobile/app/(tabs)/insights.tsx`

- [ ] **Step 1: Add compact mascot to Home header**

In `mobile/app/(tabs)/home.tsx`, import:

```ts
import { NeuroMascot } from '@/components/brand/NeuroMascot';
```

Replace the top header `<View>` with:

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[4] }}>
  <NeuroMascot mood="happy" size={72} framed />
  <View style={{ flex: 1 }}>
    <Text style={{ ...theme.typography.title, color: theme.colors.text.primary }}>
      {t('app.name')}
    </Text>
    <Text
      style={{
        ...theme.typography.caption,
        color: theme.colors.text.muted,
        marginTop: theme.space[1],
      }}
    >
      {user?.email ?? ''}
    </Text>
  </View>
</View>
```

- [ ] **Step 2: Add mascot to empty daily log card**

In `mobile/src/features/daily-log/DailyLogCard.tsx`, import:

```ts
import { NeuroMascot } from '@/components/brand/NeuroMascot';
```

Inside the empty `Pressable`, before the first text:

```tsx
<View style={{ alignItems: 'flex-start', marginBottom: theme.space[3] }}>
  <NeuroMascot mood="encouraging" size={72} />
</View>
```

- [ ] **Step 3: Add mascot to insights empty state**

In `mobile/app/(tabs)/insights.tsx`, import:

```ts
import { NeuroMascot } from '@/components/brand/NeuroMascot';
```

Inside the empty-state card, before `empty_title`:

```tsx
<View style={{ alignItems: 'flex-start', marginBottom: theme.space[3] }}>
  <NeuroMascot mood="thinking" size={82} />
</View>
```

- [ ] **Step 4: Add calm mascot to crisis cards**

Inside `InsightCard`, before the crisis label:

```tsx
{item.crisis && (
  <View style={{ alignItems: 'flex-start', marginBottom: theme.space[3] }}>
    <NeuroMascot mood="calm" size={76} />
  </View>
)}
```

- [ ] **Step 5: Run checks**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add 'mobile/app/(tabs)/home.tsx' mobile/src/features/daily-log/DailyLogCard.tsx 'mobile/app/(tabs)/insights.tsx'
git commit -m "Place Neuro mascot in core UI states"
```

---

### Task 6: Documentation Updates

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRD.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Create: `docs/HAFTA5_VERIFICATION.md`

- [ ] **Step 1: Update architecture design section**

In `docs/ARCHITECTURE.md` after Theming, add:

```md
## Mascot and Native Assets

Neuro mascot source files live under `mobile/assets/images/neuro-*.png`. Generated native assets live under `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png`, and `mobile/assets/splash.png`.

Runtime UI uses `mobile/src/components/brand/NeuroMascot.tsx`; screens must not import mascot PNG files directly. Mascot use is restricted to brand anchors and selected empty/support states. Do not place Neuro in every card or timeline row.

Asset commands:

```bash
cd mobile
bun run generate:assets
bun run validate:assets
```
```

- [ ] **Step 2: Update PRD design direction**

In `docs/PRD.md` after `## 19. Design Direction`, add:

```md
Neuro maskotu ürünün sakin rehber hissini destekler. Maskot; tanı, tedavi, acil durum değerlendirmesi veya medikal otorite gibi davranmaz. Kullanım alanı marka kimliği, onboarding destekleyici görselleri ve boş durumları yumuşatmaktır.
```

- [ ] **Step 3: Update CLAUDE commands**

In `CLAUDE.md` command section, add:

```bash
# Mobile native asset generation/check
cd mobile && bun run generate:assets
cd mobile && bun run validate:assets
```

In frontend guidance, add:

```md
Neuro mascot usage goes through `mobile/src/components/brand/NeuroMascot.tsx`; do not import `mobile/assets/images/neuro-*.png` directly in screens.
```

- [ ] **Step 4: Update README**

Add to README "Daha Fazla":

```md
- [Hafta 5 Verification](docs/HAFTA5_VERIFICATION.md) — mascot, splash, icon, polish smoke test
```

- [ ] **Step 5: Create Hafta 5 verification**

Create `docs/HAFTA5_VERIFICATION.md`:

```md
# Hafta 5 Verification Runbook

Hafta 5: polish, mascot, native assets, splash/icon, and TestFlight readiness smoke test.

## 1. Generated Assets

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run generate:assets
bun run validate:assets
```

Expected:

```text
[assets] generated assets are present with expected dimensions
```

## 2. Static Checks

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run validate:i18n
bun run typecheck
bun run lint

cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Expected: all commands PASS.

## 3. App Icon and Splash Smoke

1. Start the app in Expo or a development build.
2. Confirm native splash uses Neuro on `#0F1115`.
3. Confirm mascot is centered and not cropped.
4. Confirm app icon/adaptive icon files exist and validate.

## 4. UI Mascot Smoke

Check these screens:

- Login: calm Neuro visible above app name.
- Register: happy Neuro visible above title.
- Onboarding: thinking/encouraging/calm mood changes by step.
- Home: compact Neuro in header.
- Daily log empty card: encouraging Neuro.
- Insights empty state: thinking Neuro.
- Crisis insight card: calm Neuro with support copy; not playful or excited.

## 5. RTL Smoke

1. Switch language to Arabic.
2. Restart the app.
3. Confirm layout is RTL and mascot placement does not overlap text.

## Exit Criteria

- [ ] Generated assets validate.
- [ ] Splash and icon use Neuro.
- [ ] Mascot appears only in approved surfaces.
- [ ] No screen imports raw mascot PNGs directly.
- [ ] All automated checks pass.
```

- [ ] **Step 6: Run docs sanity**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
rg -n "PLACEHOLDER_MARKER|UNFILLED_SECTION|DEFERRED_WITHOUT_SCOPE" docs CLAUDE.md README.md
git diff --check
```

Expected: no matches and no whitespace errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git add docs/ARCHITECTURE.md docs/PRD.md CLAUDE.md README.md docs/HAFTA5_VERIFICATION.md
git commit -m "Document Neuro mascot asset usage"
```

---

### Task 7: Final Verification and Push

**Files:**
- No new files expected.

- [ ] **Step 1: Run full verification**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run validate:assets
bun run validate:i18n
bun run typecheck
bun run lint

cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Expected: all commands PASS.

- [ ] **Step 2: Check raw image import rule**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
rg -n "assets/images/neuro|neuro-.*\\.png" mobile/app mobile/src --glob '!mobile/src/components/brand/neuroAssets.ts'
```

Expected: no output.

- [ ] **Step 3: Review git status**

Run:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
git status --short
```

Expected: only intended files changed. Do not stage `.DS_Store` files.

- [ ] **Step 4: Final commit if needed and push**

If any final verification-only edits were made:

```bash
git add <changed-files>
git commit -m "Finalize Neuro mascot polish"
```

Then:

```bash
git push origin main
```

Expected: `main -> main`.

---

## Self-Review

- Spec coverage: icon, adaptive icon, splash, UI usage, validation scripts, docs, and Hafta 5 verification are covered.
- Placeholder scan: no placeholder markers or deferred sections are present.
- Scope check: plan is limited to mobile mascot/asset polish and docs; no backend/database/web/worker work.
- Type consistency: `NeuroMood`, `neuroMoods`, and `NeuroMascot` names are consistent across tasks.
- Testing: includes asset validation, i18n validation, typecheck, lint, backend regression, and raw import guard.
