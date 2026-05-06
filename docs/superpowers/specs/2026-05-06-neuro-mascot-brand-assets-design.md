# Neuro Mascot Brand Assets Design

## Context

The repo now contains a source mascot set under `mobile/assets/images/`:

- `neuro-calm.png`
- `neuro-happy.png`
- `neuro-thinking.png`
- `neuro-encouraging.png`
- `neuro-excited.png`
- `neuro-playful.png`
- `neuro-sleepy.png`
- `neuro-sad.png`
- `neuro-shocked.png`
- `neuro-angry.png`
- `neuro-curios.png`

Each file is a 1254x1254 PNG. The mascot is glossy yellow-green, friendly, and strongly character-led. It can make Neuronot feel more approachable, but the product boundary still matters: Neuronot is a personal awareness product, not a diagnosis/treatment tool. The mascot must support calm guidance and lightweight emotional tone without turning serious health-adjacent screens into a game.

## Goal

Integrate the Neuro mascot as a restrained brand system across native app assets, splash, and selected mobile UI surfaces.

## Non-Goals

- No mascot animation in this slice.
- No new onboarding steps.
- No gamified streaks, rewards, achievements, badges, or “coach diagnosis” behavior.
- No AI-generated copy change based on mascot emotion.
- No backend or database changes.
- No web/admin/worker work.

## Approaches Considered

### Approach A: Asset-only branding

Generate `icon.png`, `adaptive-icon.png`, and `splash.png` from `neuro-calm.png`, then leave UI unchanged.

Trade-off: lowest risk and fastest, but the mascot would only be visible during install/launch. The app screens would still feel visually disconnected from the new brand.

### Approach B: Full mascot everywhere

Place a mascot on every major screen, every empty state, and every card.

Trade-off: visually obvious, but too noisy for a cognitive-awareness app. It risks making serious states, crisis support, and AI safety surfaces feel childish.

### Approach C: Brand system with controlled UI touchpoints

Generate native assets from the mascot, create a reusable `NeuroMascot` component, and use semantic variants in a small number of surfaces: auth, onboarding, home, daily-log empty state, insights empty/latest/crisis state, and optionally Settings as a small brand footer.

Recommendation: choose Approach C. It gives the app a recognizable visual identity while preserving the low-cognitive-load, calm medical-tech direction in `docs/PRD.md` and `docs/ARCHITECTURE.md`.

## Design

### Asset Pipeline

The source mascot files under `mobile/assets/images/` remain committed as source assets. Generated Expo assets live at:

- `mobile/assets/icon.png`
- `mobile/assets/adaptive-icon.png`
- `mobile/assets/splash.png`

Generation should be deterministic and scriptable through `mobile/scripts/generate-neuro-assets.cjs`, using `sharp` as a dev dependency. The script should:

- Use `neuro-calm.png` for `icon.png`.
- Use `neuro-happy.png` or `neuro-calm.png` for `splash.png`; default to calm if only one variant is desired.
- Use `neuro-calm.png` for Android adaptive foreground.
- Render on a `#0F1115` background for splash/adaptive assets.
- Preserve safe padding so antennae and tail are not cropped.
- Verify output dimensions:
  - `icon.png`: 1024x1024
  - `adaptive-icon.png`: 1024x1024
  - `splash.png`: 1284x2778

### Native Config

`mobile/app.json` already references the correct paths. The plan should keep:

- `expo.icon = "./assets/icon.png"`
- `expo.splash.image = "./assets/splash.png"`
- `expo.splash.backgroundColor = "#0F1115"`
- `expo.android.adaptiveIcon.foregroundImage = "./assets/adaptive-icon.png"`
- `expo.android.adaptiveIcon.backgroundColor = "#0F1115"`

The `expo-splash-screen` plugin should also include `image`, `resizeMode`, and `backgroundColor` so config plugin behavior matches the top-level splash config.

### Mobile UI Component

Create one reusable component:

- `mobile/src/components/brand/NeuroMascot.tsx`

Responsibilities:

- Map a limited set of semantic moods to source files.
- Render a fixed-size `Image`.
- Keep sizing controlled through `size`, not arbitrary style spread.
- Mark mascot images as decorative by default.
- Allow an optional accessibility label only if a future screen needs it.

Semantic moods:

- `calm` -> `neuro-calm.png`
- `happy` -> `neuro-happy.png`
- `thinking` -> `neuro-thinking.png`
- `encouraging` -> `neuro-encouraging.png`
- `sleepy` -> `neuro-sleepy.png`
- `sad` -> `neuro-sad.png`

Other source variants remain available for future use but should not be scattered throughout UI until a specific need appears.

### UI Placement

Use the mascot in places where it reduces emptiness or gives a gentle brand anchor:

- Auth login: small `calm` mascot above the app name.
- Register: small `happy` mascot above the title.
- Onboarding: `thinking` at the top of step 1, `encouraging` at step 2, `calm` at step 3.
- Home: compact `happy` or `calm` mascot in the top header beside app name/email.
- Daily log empty card: `encouraging`, small, inside the existing card.
- Insights empty state: `thinking`.
- Insights crisis state: `calm`, not playful, not excited.
- Settings: optional small calm footer only if it does not clutter the language list.

Avoid mascot placement in:

- Every timeline item.
- Every event card.
- Error text blocks.
- Primary CTAs.
- Crisis copy as a cartoon “helper” that could soften urgency.

### Theming

Mascot containers must use semantic theme tokens only. No inline hex in UI components. Asset generation scripts may use fixed colors because generated native assets are not runtime UI.

Recommended runtime container:

- `backgroundColor: theme.colors.surface.elevated`
- `borderColor: theme.colors.border.subtle`
- radius from `theme.radius`
- spacing from `theme.space`

### Localization

No new visible copy is required for the mascot component in this slice. Existing screen copy remains in i18n resources. If an accessibility label is added later, it must live under `common` or a feature namespace for all 11 locales.

### Testing and Verification

Add `mobile/scripts/validate-assets.cjs` with `sharp` metadata checks. Add `validate:assets` to `mobile/package.json`.

Required checks after implementation:

- `cd mobile && bun run validate:assets`
- `cd mobile && bun run validate:i18n`
- `cd mobile && bun run typecheck`
- `cd mobile && bun run lint`
- `cd api && go test ./...`

Manual smoke:

- Native splash shows Neuro on dark background and does not crop antennae/tail.
- App icon is centered and readable at small size.
- Auth, onboarding, home, daily-log empty state, insights empty state, and crisis state show the intended mood.
- Arabic RTL does not distort mascot placement or overlap text.

## Documentation Updates

Update:

- `mobile/assets/README.md` with source and generated asset contract.
- `docs/ARCHITECTURE.md` with mascot asset pipeline and UI usage constraints.
- `docs/PRD.md` design direction with mascot tone boundaries.
- `CLAUDE.md` with asset generation and validation commands.
- `README.md` with asset verification pointer.
- Create `docs/HAFTA5_VERIFICATION.md` for polish/TestFlight asset smoke checks.

## Approval Notes

This design intentionally uses Neuro as a restrained brand companion, not as a constant mascot overlay. That keeps the app friendly without breaking the product’s calm, low-risk personal-awareness boundary.
