# Hafta 6 Verification Runbook

Modüler folder pattern, SQLite sync, Nunito Sans, custom-SVG charts, onboarding redesign, profile edit ve weekly summary için end-to-end smoke test.

## 1. Statik kontroller

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run validate:assets
bun run validate:i18n
bun run typecheck
bun run lint

cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Beklenen: tümü PASS.

## 2. Folder pattern guard

Her birim kendi klasöründe yaşamalı. Düz dosya kalmadığını doğrula:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile/src
find components hooks features services store theme -mindepth 2 -maxdepth 2 \
  -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'index.ts' \
  | grep -v '/locales/'
```

Beklenen: çıktı yok (her birim klasör altında, dosya `index.ts` veya `Foo.{ts,tsx}` formunda olur ama bunların ana dosyası yine `Foo/Foo.{ts,tsx}` altında).

## 3. Backend migrations

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
make db-up
make db-migrate
```

Beklenen migration listesi 00001…00008 hepsi `applied`.

## 4. UI smoke (cihaz veya simulator)

### 4.1 Launch
- Splash beyaz parlama yapmadan açılmalı.
- Nunito Sans tipografisi tüm ekranlarda görünmeli (ActivityIndicator yerine LoadingDots).

### 4.2 Onboarding (yeni hesap için)
- Welcome ekranında calm Neuro + tek "Başlayalım" butonu.
- 5 adımda Neuro mood değişmeli: thinking → sad → sleepy → happy → encouraging.
- ProgressBar adımlarla animate olmalı.
- Geri butonu adım 1'den welcome'a döner.
- Step 5: reminder switch'i açıkken saat seçimi görünür.
- Ready ekranında "Take me in" butonu profili kaydedip Home'a iletir.

### 4.3 Home
- Header'da framed happy Neuro.
- DailyLogCard (boş veya bugünkü log).
- WeeklySummaryCard görünür: log_count + focus/energy averages + sparkline'lar.

### 4.4 Timeline
- Loading'de Skeleton bloklar (ActivityIndicator değil).
- Network kapatılınca pull-on-mount başarısız olsa bile cache'ten son liste görünür (offline-first).
- Pagination footer'da LoadingDots.

### 4.5 Insights
- Generate butonuna basınca LoadingDots + haptic.
- En altta TrendsSection: metric chips, days chips, TrendLineChart.
- Crisis insight kartında calm Neuro.

### 4.6 Settings
- "Profili düzenle" basınca ProfileEditSheet açılır.
- Sheet alanları sunucu profile değerleriyle dolu gelir.
- Kaydet → success Toast (üstten slide), sheet kapanır.
- Tema/dil/logout mevcut akış aynen çalışır.

## 5. Sync smoke

### 5.1 Offline write
1. Simulator'da Wi-Fi'yi kapat.
2. Bir günlük log oluştur veya mevcut logu düzenle.
3. UI anında güncellenmeli (read-first cache).
4. Wi-Fi'yi tekrar aç.
5. ~5 saniye içinde syncEngine push yapmalı; `useSyncStore.lastSyncAt` güncellenmeli.

### 5.2 Pull
1. Backend'de doğrudan SQL ile bir event'i güncelle (`UPDATE events SET intensity = ...`).
2. App'i foreground'a getir.
3. Timeline yeni intensity değerini gösterir.

### 5.3 Soft delete mirror
1. Backend'de `UPDATE events SET deleted_at = now() WHERE id = ...`.
2. App'i foreground'a getir.
3. Event timeline'dan kaybolur.

## 6. RTL smoke (Arabic)

1. Settings → dil = العربية.
2. Restart.
3. Tüm ekranlarda layout sağdan sola.
4. Sparkline ve TrendLineChart x-axis sağdan sola çiziliyor mu kontrol et.
5. Onboarding ProgressBar fill yönü doğru (sağdan sola).

## 7. Crisis card guard

Insights crisis card'ında:
- Sadece `calm` Neuro görünmeli (excited/playful değil).
- Maskot oyunlaştırıcı görünmemeli; copy ciddi tonda.

## Exit criteria

- [ ] Tüm statik kontroller PASS.
- [ ] Folder pattern guard çıktısız.
- [ ] Migration zinciri 00008'e kadar uygulanır.
- [ ] Onboarding 7 fazı sırayla geçilir.
- [ ] Home WeeklySummaryCard render eder.
- [ ] Insights TrendsSection chart çizer.
- [ ] ProfileEditSheet save sonrası Toast gösterir.
- [ ] Offline yazma → online'da push.
- [ ] RTL'de chart yönü doğru.
- [ ] Crisis card'da maskot calm.
