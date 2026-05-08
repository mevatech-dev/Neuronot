# Hafta 8 Verification Runbook

Hafta 8: Profile/Settings mobile overhaul için end-to-end smoke test. Profile tab, Settings root, yedi push child screen (account, data, consents, crisis, help, about, onboarding-redo), register-time consent UI, re-consent başlangıç gate'i ve ReminderRow lokal bildirim akışı kapsamı dahildir.

Referans:
- Spec: [`docs/superpowers/specs/2026-05-07-profile-settings-design.md`](superpowers/specs/2026-05-07-profile-settings-design.md)
- Plan: [`docs/superpowers/plans/2026-05-07-profile-settings-mobile.md`](superpowers/plans/2026-05-07-profile-settings-mobile.md)
- Backend smoke: [`HAFTA7_VERIFICATION.md`](HAFTA7_VERIFICATION.md) — Hafta 8 mobile akışı bunu yeşil varsayar.

## 0. Pre-requisites

- API çalışıyor (`make api-dev`) ve Hafta 7 runbook'u geçmiş durumda (`/v1/me/consents`, `/v1/me/password`, `/v1/me`, `/v1/me/export` aktif).
- `mobile/.env` veya runtime config içinde API base URL doğru.
- Native build veya Expo dev client (expo-notifications, expo-application native module gerektirir; pure Expo Go simülatöründe permission akışı mock'tur).

## 1. Statik kontroller

```bash
cd /home/user/Neuronot/mobile
bun install
bun run validate:assets
bun run validate:i18n
bun run typecheck
bun run lint

cd /home/user/Neuronot/api
go test ./...
```

Beklenen: tümü PASS. `validate:i18n` çıktısı `11 languages x 14 namespaces complete`.

## 2. Folder pattern guard

```bash
cd /home/user/Neuronot/mobile/src
find components hooks features services store theme -mindepth 2 -maxdepth 2 \
  -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'index.ts' \
  | grep -v '/locales/'
```

Beklenen: çıktı yok.

## 3. Register consent UI

1. Logout (varsa) → `/auth/register`.
2. Form en altında üç checkbox görünmeli: ToS, Privacy, AI usage.
3. ToS veya Privacy kutusu işaretsizken **Hesap oluştur** disabled.
4. AI consent kutusu opsiyonel (işaretsiz olarak da submit kabul).
5. Hepsi onaylı → submit → 200, otomatik login + onboarding'e yönlendirme.
6. Backend'e gönderilen payload `consents[].type ∈ {terms_of_service, privacy_policy, ai_usage}` ve `granted` doğru bayraklarla.

## 4. Profile tab

1. Login sonrası bottom tab'larda **Settings** yerine **Profile** yazıyor.
2. Profile tab'ına bas:
   - calm Neuro maskotu üstte ortalanmış.
   - "Profile" başlığı.
   - ProfileSummaryCard: e-posta, focus problem, intensity, avg sleep, caffeine, reminder bilgileri (tümü `—` placeholder'ı veya gerçek değerle).
   - "✏️ Edit profile" satırı → ProfileEditSheet açılıyor; kayıt sonrası success Toast.
   - "⚙️ Settings" satırı → `/profile/settings` push.
3. RTL (`ar`) modunda layout sağdan sola, satır chevron yönü doğru.

## 5. Settings root

`/profile/settings` ekranında, yukarıdan aşağı şu yapı görünmeli:

1. **Theme picker** (system / light / dark) → seçim anında theme değişir.
2. **Language picker** → 11 dil; `ar` seçimi yanında "Beta" rozeti.
3. **Daily reminder row** → switch + 6 saat seçeneği (Task 5'te detaylı test).
4. Bölüm başlığı **"Account & data"** + üç push satırı: Account, My data, Consents.
5. Bölüm başlığı **"Help"** + iki push satırı: Crisis & support, Contact.
6. Bölüm başlığı **"About"** + iki push satırı: About, Restart onboarding.
7. **Logout** butonu en altta.

Push satırlarına basınca header'lı bir Stack screen açılmalı (settings sub-screen layout `headerShown: true`).

## 6. Reminder permission flow

> Pure Expo Go'da test ederken `expo-notifications` izin akışı mock'lanır; Dev Client veya gerçek build kullan.

1. Reminder row switch'i kapalı, hour `—`.
2. Switch'i aç → OS izin sheet'i çıkmalı.
3. **Allow** → switch açık kalmalı; default saat 9, hour chip 9 görünmeli.
4. Hour chip'i 21'e değiştir → switch hâlâ açık, persisted hour 21.
5. Switch'i kapat → backend `reminder_enabled = false`, hour bilgisi korunur (`reminder_hour` korunsun).
6. Switch açıkken `expo-notifications` zamanlanmış bildirim listesinde `neuronot.daily.reminder` ID'li daily trigger var:

```js
await Notifications.getAllScheduledNotificationsAsync()
```

## 7. Account screen

`/profile/settings/account`:

### 7.1 Change password
1. Üç secureTextEntry alan (current, new, confirm).
2. New ≠ confirm → submit'e basınca inline mismatch satırı.
3. New = confirm + current doğru → 204, success toast `account:password.changed`, alanlar boşalır.
4. Current yanlış → server `AUTH_INVALID_CREDENTIALS` döner, danger toast (mesaj key'i error.messageKey).

### 7.2 Delete account sheet
1. "Delete my account" satırına bas → modal sheet alttan açılır.
2. Email retype boşken Delete forever disabled.
3. Yanlış email → server `ACCOUNT_DELETE_EMAIL_MISMATCH`, danger toast.
4. Doğru email → 204, logout, login ekranına yönlendirme.
5. Sonraki request 401 (token geçersiz).

## 8. Data screen

`/profile/settings/data`:

1. "Export my data" → loading dots → `useExportData` mutation `expo-file-system` ile dosya yazar, `expo-sharing` ile system share sheet açılır.
2. Share sheet'te dosya adı `neuronot-export-YYYY-MM-DD.json`.
3. JSON içeriği `profile`, `daily_logs`, `events`, `insights` anahtarlarını barındırmalı.
4. Success toast `data:export.saved`.
5. "Delete my account" kısayolu → Account screen'e push.

## 9. Consents

`/profile/settings/consents`:

1. Loading'de 3 Skeleton 88px.
2. Yüklenince üç ConsentRow: Terms of Service, Privacy Policy, AI insight analysis.
3. Server güncel version ile aynıyse status = "Granted", border subtle.
4. Server'da `terms_version` veya `privacy_version` artırırsan ilgili satır "Update required" + danger border.
5. AI usage row'da "Revoke" butonu görünür; ToS/Privacy'de görünmez.
6. AI usage revoke → satır "Revoked"'a döner; Insights screen'de generate denenince `INSIGHT_AI_CONSENT_REQUIRED` → ReConsentSheet açılır.

## 10. Re-consent gate

1. Backend'de `terms_version` veya `privacy_version`'u artır (env veya constants).
2. Restart app.
3. Splash sonrası ReConsentSheet otomatik açılmalı (gate `_layout.tsx`'te aktif).
4. Accept → mutation, gate kapanır, akış normalleşir.

## 11. Crisis screen

`/profile/settings/crisis`:

1. Üst ortada calm Neuro (88px).
2. `crisis:body` ve `crisis:card_hint` kopyaları.
3. CrisisHotlineList: kullanıcının diline göre 1-3 hotline kartı.
4. Karta basınca `tel:` URL'i açılır (cihazda telefon uygulaması).
5. `ar` dilinde tek "Emergency / 112" kartı görünmeli.

## 12. About + Help + Onboarding redo

### 12.1 About
- VersionRow `version_label` + `Application.nativeApplicationVersion (build)` gösterir.

### 12.2 Help
- "Contact support" butonu `mailto:support@neuronot.app` açar.

### 12.3 Onboarding redo
- "Restart" butonu `/onboarding`'e replace eder; onboarding flow başa döner; mevcut server profile silinmez.

## 13. RTL (ar)

1. Settings → Language → العربية.
2. Restart.
3. Tüm Settings, Profile, sub-screen'lerde layout sağdan sola.
4. SettingsLinkRow chevron sağdan sola dönmüş (Pressable `flexDirection: 'row'` auto-flip).
5. ProfileSummaryCard kolonları `marginStart`/`marginEnd` ile.

## 14. Offline davranışı

1. Wi-Fi kapalıyken Profile tab → `profileQuery` cache'ten dolar.
2. Settings'te theme/language değişimi (local-only) sorunsuz.
3. Account / Data / Consents akışları çevrimdışı 'network' tonlu danger toast verir.

## Exit criteria

- [ ] Statik kontroller PASS (`validate:i18n` 11×14).
- [ ] Folder pattern guard çıktısız.
- [ ] Register consent UI ToS/Privacy/AI üç-kutu davranışı doğru.
- [ ] Profile tab summary card + edit + settings push.
- [ ] Settings root yedi push child + theme/language/reminder.
- [ ] Reminder permission ve schedule akışı çalışıyor.
- [ ] Change password + delete account akışları doğru hata kodlarını gösteriyor.
- [ ] Data export dosyası paylaşılıyor.
- [ ] Consents revoke AI gate'i tetikliyor.
- [ ] Re-consent gate stale version'da otomatik açılıyor.
- [ ] Crisis hotline `tel:` linkleri açılıyor.
- [ ] About sürüm bilgisi cihazdan geliyor.
- [ ] RTL'de layout doğru.
- [ ] Offline'da cache okuması, mutation'lar danger toast veriyor.
