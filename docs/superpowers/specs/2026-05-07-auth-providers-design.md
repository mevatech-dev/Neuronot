# Auth Providers Design — Anonymous + Apple + Google

**Status:** Draft, awaiting approval
**Date:** 2026-05-07
**Owner:** Neuronot mobile + api
**Supersedes:** Hafta 1 auth was email/password only.

## Goal

Üç yeni giriş yolu eklenir:

1. **Anonymous** — kullanıcı email/şifre vermeden hemen uygulamayı kullanmaya başlayabilir; ileride sosyal/email hesaba "yükseltebilir".
2. **Sign in with Apple** — iOS'ta zorunlu (App Store Review Guideline 4.8) ve Android'de opsiyonel.
3. **Sign in with Google** — iOS + Android.

Mevcut `register` / `login` / `refresh` / `logout` endpoint'leri korunur; yeni endpoint'ler bunlara eklenir.

## Non-Goals

- Facebook, Microsoft, Twitter girişleri (App Store guideline'ı bu üçü için zorunluluk yaratmaz; kullanıcı talebi henüz yok).
- Web login (web/ folder'ı zaten boş).
- Multi-device session management UI (sadece refresh token rotation mevcut).
- E-mail magic link / passwordless email login.

## Schema değişiklikleri

### `00010_auth_providers.sql` (proposed)

```sql
-- Email/password artık opsiyonel (anonymous + sosyal-only kullanıcılar için).
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

-- Anonymous bayrağı.
ALTER TABLE users
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

-- Sosyal sağlayıcı bağlantıları users üzerinde (MVP). İleride çoklu hesap
-- bağlama gerekirse ayrı `auth_providers` tablosuna migrate edilir
-- (ADR 0003 kapsamı).
ALTER TABLE users
  ADD COLUMN apple_sub  text UNIQUE,
  ADD COLUMN google_sub text UNIQUE;

-- "En az bir kimlik yolu" CHECK constraint'i
ALTER TABLE users
  ADD CONSTRAINT users_identity_required CHECK (
    is_anonymous = true
    OR email IS NOT NULL
    OR apple_sub IS NOT NULL
    OR google_sub IS NOT NULL
  );

-- Kısmi unique index — `email` artık nullable, ama doluysa tek olmalı.
-- (UNIQUE constraint nullable kolon için zaten bunu yapar; doğrulama notu.)
```

**Down migration:** her ALTER ters çevrilir; `apple_sub`/`google_sub` doluysa hata vermek için `WHERE` ile dolu satır var mı kontrol edilir, varsa migration durur (bilgi kaybı önler). MVP'de henüz veri yok, sorun değil.

### Neden tek tablo (Option A) seçildi

Alternatif: ayrı `auth_providers (id, user_id, provider, subject, email_at_provider, created_at)` tablosu, UNIQUE(provider, subject).

- **Pro (B):** Bir user'ın birden çok Google hesabı, ya da aynı sağlayıcının yeniden bağlanması gibi senaryolar.
- **Con (B):** Her login JOIN gerektirir; kod karmaşası; YAGNI.

MVP'de bir user → bir Apple subject + bir Google subject + bir email/password yeterli. Şimdilik **Option A**. ADR 0003 ileride değişimi belgeler.

## Verification (sunucu tarafı)

### Apple

1. Mobile `expo-apple-authentication` ile kullanıcıyı doğrular, `identityToken` (JWT) alır.
2. Mobile sunucuya gönderir: `{ identity_token, nonce, ... }`. **Nonce mecburi**: mobile rastgele üretir, SHA256(nonce) hash'ini Apple isteğine gönderir; ham nonce sunucuya gider.
3. Sunucu:
   - Apple JWKS'i `https://appleid.apple.com/auth/keys` adresinden çeker, 24h cache'ler.
   - JWT signature'ı doğrular.
   - Claim'leri kontrol eder:
     - `iss == "https://appleid.apple.com"`
     - `aud == APPLE_BUNDLE_ID` (env var: `tech.mevatech.neuronot`)
     - `exp` geçerli, `iat` makul (60 sn skew tolerance)
     - `nonce == base64url(SHA256(rawNonce))` — replay koruması
   - `sub` claim'i Apple'ın kalıcı user id'si.
   - `email` claim'i **sadece ilk girişte** garantili (sonraki girişlerde Apple bunu göndermez); ilk seferde DB'ye yaz, sonraki seferlerde mevcut değeri koru.
   - `email_verified` ve `is_private_email` (Apple Private Relay maili) claim'leri loglanır ama akışı değiştirmez.
4. Lookup: `WHERE apple_sub = $1`. Bulunursa token döner; bulunmazsa **yeni kullanıcı** oluşturulur (`is_anonymous = false`).

### Google

1. Mobile `expo-auth-session/providers/google` (veya `@react-native-google-signin/google-signin`) ile `id_token` alır.
2. Mobile sunucuya `{ id_token, ... }` gönderir.
3. Sunucu:
   - Google JWKS'i `https://www.googleapis.com/oauth2/v3/certs` adresinden çeker, 1h cache'ler (Google sıkça rotate eder).
   - JWT signature + claim'ler:
     - `iss ∈ { "https://accounts.google.com", "accounts.google.com" }`
     - `aud ∈ GOOGLE_OAUTH_AUDIENCES` env (iOS client id, Android client id virgülle ayrılmış)
     - `exp` / `iat`
     - `email_verified == true` (Google'ın kendi doğrulaması; `false` ise reddet)
   - `sub` Google'ın kalıcı user id'si.
4. Lookup `WHERE google_sub = $1`. Aynı flow.

### JWKS cache

- HTTP fetcher + in-memory cache (per provider).
- TTL: response `Cache-Control: max-age=...` header'ı varsa onu kullan; yoksa Apple 24h, Google 1h.
- Cache miss veya stale ise senkron fetch, başarısızsa eski cache ile devam et (graceful) ama 5 dk'dan eski hard miss'te 503.

### Library seçimi (Go)

Mevcut: `github.com/golang-jwt/jwt/v5` (zaten `auth/service.go`'da access token signing için kullanılıyor — kontrol edilmeli).

Yeni: tek dosya JWKS fetcher. Eklenecek bağımlılık YOK; `crypto/rsa` + `crypto/ecdsa` + `encoding/base64` + `net/http` ile yazılır (~120 satır). 3rd party JWKS lib (`MicahParks/keyfunc`) eklenmez (YAGNI; davranış zaten basit).

## Endpoint'ler

```
POST /v1/auth/anonymous          — anon kullanıcı oluştur
POST /v1/auth/apple              — Apple ile giriş/kayıt
POST /v1/auth/google             — Google ile giriş/kayıt

POST /v1/auth/upgrade/email      — anon → email/şifre hesabı
POST /v1/auth/upgrade/apple      — anon → Apple bağla
POST /v1/auth/upgrade/google     — anon → Google bağla

POST /v1/auth/link/apple         — mevcut kullanıcı Apple bağlasın
POST /v1/auth/link/google        — mevcut kullanıcı Google bağlasın
DELETE /v1/auth/link/{provider}  — bağlantıyı sök (kullanıcının başka kimlik yolu varsa)
```

`upgrade/*` ve `link/*` authenticated. `anonymous`, `apple`, `google` public.

### Request/response şekli

`POST /v1/auth/anonymous`:
```json
{
  "preferred_language": "tr",
  "consents": [
    { "type": "terms_of_service", "granted": true, "version": "1.0" },
    { "type": "privacy_policy", "granted": true, "version": "1.0" },
    { "type": "ai_usage", "granted": false, "version": "1.0" }
  ]
}
```
Response: standart `TokenResponse` (mevcut shape) + `is_anonymous: true`.

`POST /v1/auth/apple`:
```json
{
  "identity_token": "eyJhbGc...",
  "nonce": "raw-random-string",
  "preferred_language": "tr",
  "consents": [...]
}
```
Response: standart `TokenResponse`. İlk girişte ek alan: `is_new_user: bool`.

`POST /v1/auth/google`:
```json
{
  "id_token": "eyJhbGc...",
  "preferred_language": "tr",
  "consents": [...]
}
```

### Hata kodları (`docs/api-errors.md`'ye eklenir)

| Code | HTTP | message_key | Açıklama |
|---|---|---|---|
| `AUTH_APPLE_TOKEN_INVALID` | 401 | `errors.auth.apple_invalid` | Apple JWT signature veya claim hatası |
| `AUTH_APPLE_NONCE_MISMATCH` | 401 | `errors.auth.apple_nonce` | Nonce hash uyuşmuyor |
| `AUTH_GOOGLE_TOKEN_INVALID` | 401 | `errors.auth.google_invalid` | Google JWT verification hatası |
| `AUTH_GOOGLE_EMAIL_UNVERIFIED` | 401 | `errors.auth.google_email_unverified` | `email_verified == false` |
| `AUTH_LINK_TAKEN` | 409 | `errors.auth.link_taken` | Bu Apple/Google subject başka hesaba bağlı |
| `AUTH_LINK_REQUIRED` | 409 | `errors.auth.link_required` | Email zaten bir password hesabıyla kayıtlı; önce email ile login + link gerek |
| `AUTH_DETACH_LAST_IDENTITY` | 422 | `errors.auth.detach_last` | Son kimlik yolu sökülemez |
| `AUTH_ANON_NOT_UPGRADABLE` | 409 | `errors.auth.anon_not_upgradable` | Anon değil zaten / link kayıtlı |

## Mobile akış

### Welcome / login ekranı

```
[NeuroMascot calm]

       Welcome to Neuronot

  ┌──────────────────────────┐
  │  Continue with Apple     │   (iOS only)
  └──────────────────────────┘
  ┌──────────────────────────┐
  │  Continue with Google    │
  └──────────────────────────┘
  ┌──────────────────────────┐
  │  Sign up with email      │
  └──────────────────────────┘

  Continue without account  ← link, küçük punto
```

`Login` ekranında (zaten hesap olanlar için): yukarıdaki üç buton (anon yok) + alt link "Forgot password? Reset" (placeholder, MVP scope dışı).

### Consent placement

- Anon ve sosyal akışlarda da ToS + Privacy onayı **zorunlu**. Welcome ekranındaki butonların altında "By continuing you agree to ToS + Privacy" copy + tıklanabilir link.
- Backend, ilgili consent'leri body'de bekler. Mobile bunları otomatik olarak `granted: true, version: <client current>` olarak ekler.
- AI usage consent **anon kullanıcı için varsayılan false**. Insights ekranı bunu zaten gate ediyor (Hafta 7); insight üretmek için ReConsentSheet'e benzer bir prompt çıkar.

### Anonymous → upgrade akışı

- Anon kullanıcı Settings → Account ekranına girince **password change ve delete account UI'ları gizlenir**, yerine "Save your account" kartı çıkar. İki seçenek:
  - "Add email & password" → form (email, password, confirm) → `POST /v1/auth/upgrade/email`.
  - "Continue with Apple/Google" butonu → identity token alındıktan sonra `POST /v1/auth/upgrade/apple` veya `/upgrade/google`.
- Başarı sonrası `is_anonymous = false`, fresh token döner, store güncellenir.

### Mevcut Settings/Account davranışı

- Non-anon kullanıcı için akış aynen kalır.
- Linked provider'lar Account ekranında listelenir:
  - "Linked: Apple ✓ — [Disconnect]"
  - "Linked: Google ✗ — [Connect]"
  - Email password bağlı değilse "Add password" satırı.
- Disconnect: `DELETE /v1/auth/link/{provider}` → server son kimlik kontrolü yapar.

## Apple özellikleri

- **Bundle ID** Apple Developer Console'da Sign-In with Apple capability açık olmalı.
- **Service ID** sadece web/cross-platform için gerekli; iOS native akışında bundle id audience yeterli.
- **Email Relay:** Apple kullanıcısı "Hide my email" seçerse `email` field'ı `xyz@privaterelay.appleid.com` formunda gelir. Bu adres'e mail göndermek için Apple'ın "Communication Email" allowlist'ine `noreply@<domain>` eklenmeli (Cloudflare Email tarafında SPF/DKIM zaten hizalı). MVP'de mail göndermiyoruz; sadece DB'de depolarız.
- **`name` claim:** sadece ilk girişte; mobile bunu `display_name` olarak server'a göndermek isteyebilir. MVP'de profile.display_name yok, gerek yok.

## Google özellikleri

- **OAuth client'lar:** Google Cloud Console'da:
  - iOS app (bundle id) — `GOOGLE_CLIENT_ID_IOS`
  - Android app (package name + SHA1) — `GOOGLE_CLIENT_ID_ANDROID`
  - (Web client_id Expo Auth Session bazı akışlarda istiyor — `GOOGLE_CLIENT_ID_EXPO`)
- **Audience valid:** server `aud` claim'ini bu üçünden biriyle eşleştirmeli.
- **`hd` claim:** Google Workspace domain. Kontrol etmiyoruz (consumer kullanıcı target).

## Konfigürasyon (api/.env)

```env
# Apple
APPLE_BUNDLE_ID=tech.mevatech.neuronot
APPLE_JWKS_URL=https://appleid.apple.com/auth/keys

# Google
GOOGLE_OAUTH_AUDIENCES=<ios-cid>,<android-cid>,<expo-cid>
GOOGLE_JWKS_URL=https://www.googleapis.com/oauth2/v3/certs
```

JWKS URL'leri sabit; env üzerinden değiştirme imkânı sadece test için.

## Account merge / takeover defansı

**Senaryo:** Alice email/password ile `alice@gmail.com` kaydolur. Sonra Apple ile login dener; Apple `alice@gmail.com` döner.

- Server Apple `sub`'ını DB'de bulamaz → email'le kontrol eder. Email mevcutsa **otomatik link YAPMAZ**, `AUTH_LINK_REQUIRED` döner.
- Mobile bu hatayı yakaladığında "Bu email ile bir hesap zaten var. Apple'ı eklemek için lütfen önce email ile giriş yap, sonra Settings → Account'tan bağla" toast/sheet gösterir.

Bu kasıtlı sürtüşme; hesap ele geçirme'yi (henüz email verification yok) önler.

**Senaryo:** Email verification eklendiğinde (post-MVP) auto-link açılabilir.

## Test stratejisi

### Server unit/integration

- **Apple/Google JWT verification:** test'te kendimiz RSA key çifti üretir, sahte JWKS endpoint mock'lar (httptest.Server), private key ile token imzalar, server'a yollar. Bu sayede production sertifikalarına bağımlı olmadan tüm yolları test ederiz (geçerli, expired, wrong aud, wrong iss, wrong nonce).
- **Account linking:** anon → upgrade, email → link Apple, link conflict, detach last identity testleri table-driven.

### Mobile manuel

- iOS gerçek cihazda Apple flow.
- Android emülatörde Google flow (Google Play Services gerekli).
- Anon flow: hızlı tap-through, sonra upgrade.

### Verification runbook (Hafta 9)

`docs/HAFTA9_VERIFICATION.md` ayrı bir runbook olarak yazılır.

## Açık karar noktaları (kullanıcı onayı gerekli)

1. **Schema:** Tek tablo (Option A — bu spec'in seçimi) vs ayrı `auth_providers` tablosu (Option B). YAGNI ile A öneriliyor.
2. **Anon → email upgrade**: anon hesabın olası tüm verileri (daily_logs, events, insights) yeni email hesabına `user_id`'yi koruduğumuz için **otomatik taşınır**. Onay var mı?
3. **Email çakışmasında auto-link:** Reddedildi (`AUTH_LINK_REQUIRED` döner, manuel link). Onaylar mısın?
4. **Anonymous deletion policy:** 90 gün hiç login olmamış anon hesaplar nightly job ile silinsin mi (Worker scope, deferred)? Yoksa MVP'de hiç silmeyelim mi?
5. **Apple/Google butonları onboarding sırası:** önce sosyal mı email mi? "Email'de bir kez göster, sosyal'i altta tut" mu?
6. **Mobile lib seçimi (Google):**
   - `expo-auth-session/providers/google` (managed Expo, native build gerek YOK)
   - `@react-native-google-signin/google-signin` (native build gerekir, daha pürüzsüz UX)
   Hangi yol?
7. **Mail gönderimi:** Apple/Google bazen email yollar; MVP'de bunlara mail göndermiyoruz (Cloudflare Email tetiği gelene kadar). Onay?

Bu yedi karar netleşmeden kod yazılmaz. Karar verildiğinde:

- Plan dosyaları yazılır: `docs/superpowers/plans/2026-05-08-auth-providers-backend.md` ve `-mobile.md`.
- Backend önce: migration → JWKS verifier → 3 yeni endpoint → upgrade/link → tests.
- Mobile sonra: welcome ekranı + 3 buton + Account ekranı linked-provider satırları + upgrade flow.

## ADR

Kararlar netleştikten sonra `docs/adr/0003-auth-providers.md` yazılır; bu spec'in özeti + kabul edilen seçimler + revisit tetikleri.
