# Hafta 5 Verification Runbook

Hafta 5: polish, Neuro maskot entegrasyonu, native asset üretimi (splash/icon) ve TestFlight hazırlığı için smoke test.

## 1. Generated Assets

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run generate:assets
bun run validate:assets
```

Beklenen çıktı:

```text
[assets] generated icon.png, adaptive-icon.png, splash.png
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

Beklenen: tüm komutlar PASS.

## 3. App Icon ve Splash Smoke

1. Expo veya development build üzerinden uygulamayı aç.
2. Native splash'in `#0F1115` üstünde Neuro ile geldiğini doğrula.
3. Maskotun ortalı ve kırpılmamış olduğunu doğrula.
4. `mobile/assets/icon.png`, `mobile/assets/adaptive-icon.png`, `mobile/assets/splash.png` dosyalarının `validate:assets` adımından geçtiğini doğrula.

## 4. UI Mascot Smoke

Aşağıdaki ekranları kontrol et:

- Login: app adının üstünde `calm` Neuro.
- Register: başlığın üstünde `happy` Neuro.
- Onboarding: adıma göre `thinking` / `encouraging` / `calm`.
- Home: header'da kompakt `happy` Neuro (framed).
- Daily log empty card: `encouraging` Neuro.
- Insights empty state: `thinking` Neuro.
- Crisis insight kartı: `calm` Neuro; oyunlaştırıcı (excited/playful) ifade görünmemeli.

## 5. RTL Smoke

1. Settings → dil = Arabic.
2. Uygulamayı yeniden başlat.
3. Layout RTL olmalı; maskot yerleşimi metinle çakışmamalı, kesilmemeli.

## 6. Raw Asset Import Guard

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
rg -n "assets/images/neuro|neuro-.*\\.png" mobile/app mobile/src --glob '!mobile/src/components/brand/neuroAssets.ts'
```

Beklenen: çıktı yok (yalnızca registry maskot PNG'lerini referans alır).

## Exit Criteria

- [ ] `validate:assets` geçer.
- [ ] Splash ve icon Neuro maskotunu kullanır.
- [ ] Maskot yalnızca onaylı yüzeylerde görünür.
- [ ] Hiçbir ekran maskot PNG'yi doğrudan import etmez.
- [ ] Tüm otomatik kontroller (`typecheck`, `lint`, `validate:i18n`, `go test ./...`) PASS.
