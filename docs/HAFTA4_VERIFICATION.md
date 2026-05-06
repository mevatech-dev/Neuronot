# Hafta 4 Verification Runbook

Hafta 4: 11 dil locale kapsamı, namespace eşitliği ve Arabic RTL smoke test.

## Ön Koşul

Hafta 3 verification başarıyla tamamlanmış olmalı. `mobile/node_modules` kurulu değilse:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun install
```

## 1. Locale Coverage Check

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run validate:i18n
```

Beklenen:

```text
[i18n] 11 languages x 8 namespaces complete
```

Bu kontrol her dil için şu namespace dosyalarının varlığını ve İngilizce kaynakla aynı key yapısına sahip olduğunu doğrular:

- `common`
- `errors`
- `onboarding`
- `daily-log`
- `events`
- `timeline`
- `insights`
- `crisis`

## 2. Mobile Static Checks

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Beklenen: iki komut da PASS.

## 3. Backend Regression Check

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Beklenen: PASS.

## 4. Language Switch Smoke

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun start
```

1. Uygulamayı Expo Go veya development build ile aç.
2. Settings sekmesine git.
3. Sırasıyla `Español`, `Deutsch`, `Français`, `Português`, `Italiano`, `Русский`, `日本語`, `简体中文` seç.
4. Home, Timeline, Insights ve Settings tab başlıklarının seçilen dile geçtiğini kontrol et.
5. Daily log sheet, event sheet, empty timeline ve empty insights ekranlarını aç.
6. UI'da İngilizce fallback görünmediğini kontrol et.

## 5. Arabic RTL Smoke

1. Settings sekmesinden `العربية` seç.
2. Uygulamayı kapatıp tekrar aç.
3. Tab başlıkları, Settings dil listesi ve temel ekran metinleri Arapça görünmeli.
4. React Native layout direction RTL olmalı.
5. Beta rozeti görünmeli.

Not: `I18nManager.forceRTL()` layout yönünü kalıcı olarak değiştirebilir; RTL geçişinin tam etkisi için uygulama restart gerekebilir.

## Çıkış Kriterleri

- [ ] `bun run validate:i18n` 11 dil x 8 namespace PASS.
- [ ] `bun run typecheck` PASS.
- [ ] `bun run lint` PASS.
- [ ] `go test ./...` PASS.
- [ ] Dil değiştirince common/daily-log/events/timeline/insights/crisis metinleri ilgili locale'den geliyor.
- [ ] Arabic seçilince RTL direction restart sonrası aktif.
- [ ] Non-English locale'lerde İngilizce fallback görünmüyor.
