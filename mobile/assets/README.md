# Assets

This folder contains Expo runtime assets.

## Source mascot images

`assets/images/neuro-*.png` files are source mascot variants (1254x1254). Do not edit them in place. Generated app assets are derived from these files.

## Generated files

- `icon.png` 1024x1024 — iOS / App Store icon source
- `adaptive-icon.png` 1024x1024 — Android adaptive icon foreground
- `splash.png` 1284x2778 — native splash image

## Commands

```bash
cd mobile
bun run generate:assets
bun run validate:assets
```

`generate:assets` uses `neuro-calm.png` for icon/adaptive icon and `neuro-happy.png` for splash. The background color is `#0F1115`, matching the default soft dark theme.
