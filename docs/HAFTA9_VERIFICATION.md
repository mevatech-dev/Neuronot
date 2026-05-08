# Hafta 9 Verification Runbook

Hafta 9: Anonymous + Apple + Google sign-in + anon-account upgrade için end-to-end smoke test. JWKS doğrulama, üç giriş yolu, link-required defansı, anon→email/Apple/Google upgrade akışları, mobile welcome ekranı kapsamı dahildir.

Referans:
- ADR: [`docs/adr/0003-auth-providers.md`](adr/0003-auth-providers.md)
- Spec: [`docs/superpowers/specs/2026-05-07-auth-providers-design.md`](superpowers/specs/2026-05-07-auth-providers-design.md)
- Backend smoke (önceki haftalar): [`HAFTA7_VERIFICATION.md`](HAFTA7_VERIFICATION.md)

## 0. Pre-requisites

`api/.env` aşağıdaki yeni değişkenleri içerebilir (boş bırakılırsa ilgili sosyal endpoint 503 döner):

- `APPLE_BUNDLE_ID` — örn. `app.neuronot.ios`. Boşsa `/v1/auth/apple` 503.
- `GOOGLE_OAUTH_AUDIENCES` — virgülle ayrılmış OAuth client id listesi (iOS, Android, Expo). Boşsa `/v1/auth/google` 503.

Mobile config (`mobile/app.json` → `extra`):

- `googleClientIdIos`, `googleClientIdAndroid`, `googleClientIdExpo` — Google Cloud Console'dan alınan client id'ler. Boşsa welcome ekranında Google butonu görünmez.
- `usesAppleSignIn: true` — iOS bundle'ında Apple Sign-In capability'si.

API'yi başlat:

```bash
cd /home/user/Neuronot
set -a && source api/.env && set +a
make api-dev
```

## 1. Migration

```bash
make db-up
make db-migrate
```

`00010_auth_providers.sql` migration uygulanmalı. Doğrula:

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "\d users" | grep -E "is_anonymous|apple_sub|google_sub|email|password_hash"
```

Beklenen:
- `email` ve `password_hash` artık `not null` değil.
- `is_anonymous boolean not null default false`.
- `apple_sub text` UNIQUE, `google_sub text` UNIQUE.
- `users_identity_required` CHECK constraint mevcut.

## 2. Otomatik testler

```bash
cd api && go test ./...
cd ../mobile && bun run typecheck && bun run validate:i18n
```

Beklenen:
- Go testleri PASS — özellikle `internal/auth/oidc` içindeki 9 test (happy path, expired, wrong audience/issuer, nonce mismatch, email_verified=false, aud as list, JWKS rotation, hashNonce).
- `validate:i18n` → `11 languages x 14 namespaces complete`.

## 3. Provider disabled (config eksik)

Apple/Google config olmadan API'yi başlat (env'leri boşalt). Ardından:

```bash
curl -s -X POST http://localhost:8080/v1/auth/apple \
  -H "Content-Type: application/json" \
  -d '{"identity_token":"x","nonce":"y"}' | jq

curl -s -X POST http://localhost:8080/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"id_token":"x"}' | jq
```

Beklenen: 503, `code = AUTH_PROVIDER_DISABLED`, `message_key = errors.auth.provider_disabled`.

## 4. Anonymous sign-up

```bash
curl -s -X POST http://localhost:8080/v1/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{
    "preferred_language":"tr",
    "consents":[
      {"type":"terms_of_service","granted":true,"version":"2026-05"},
      {"type":"privacy_policy","granted":true,"version":"2026-05"}
    ]
  }' | jq
```

Beklenen 201:
- `data.is_anonymous == true`
- `data.email == ""`
- `data.access_token` ve `data.refresh_token` mevcut.

Consent eksikliği:

```bash
curl -s -X POST http://localhost:8080/v1/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{"preferred_language":"tr","consents":[]}' | jq
```

Beklenen 422, `code = AUTH_CONSENT_REQUIRED`.

## 5. Anonymous → Email upgrade

Anon token'ını sakla:

```bash
ANON=$(curl -s -X POST http://localhost:8080/v1/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{"consents":[
    {"type":"terms_of_service","granted":true,"version":"2026-05"},
    {"type":"privacy_policy","granted":true,"version":"2026-05"}
  ]}' | jq -r .data.access_token)

curl -s -X POST http://localhost:8080/v1/auth/upgrade/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON" \
  -d '{"email":"alice@neuronot.app","password":"changeme123"}' | jq
```

Beklenen 200:
- `data.is_anonymous == false`
- `data.email == "alice@neuronot.app"`
- Yeni access/refresh token (eskileri rotate edilir).

`user_id` aynı kalmalı: aynı anon kullanıcı için bir günlük log oluşturup upgrade sonrası okunduğunda log mevcut olmalı (cascade test).

Aynı anon access token ile tekrar dene:

```bash
curl -s -X POST http://localhost:8080/v1/auth/upgrade/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ANON" \
  -d '{"email":"bob@neuronot.app","password":"changeme123"}' | jq
```

Beklenen 409, `code = AUTH_NOT_ANONYMOUS` (kullanıcı artık anon değil).

## 6. Email collision (manual link)

Mevcut bir password hesabıyla sosyal sağlayıcı subject'inin aynı email döndüğü senaryo:

```bash
# Önce password hesabı oluştur:
curl -s -X POST http://localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"shared@neuronot.app",
    "password":"changeme123",
    "consents":[
      {"type":"terms_of_service","granted":true,"version":"2026-05"},
      {"type":"privacy_policy","granted":true,"version":"2026-05"},
      {"type":"ai_usage","granted":true,"version":"2026-05"}
    ]
  }' | jq -r .data.user_id
```

Sonra Apple veya Google ile aynı email döndüren bir token ile dene (test JWT'si veya gerçek). Beklenen:

- `code = AUTH_LINK_REQUIRED`, HTTP 409, `message_key = errors.auth.link_required`.

Bu test için OIDC verifier birim testlerindeki `internal/auth/oidc/oidc_test.go` örnekleri referans; gerçek JWT yerine fake JWKS kullanmak için end-to-end integration test yazılırsa orada `httptest.Server` mock'u kullanılır.

## 7. Apple sign-in (gerçek cihaz)

> Apple Sign-In simülatörde sınırlıdır; gerçek bir iOS cihazı + Apple Developer hesabı gerekir.

1. Welcome ekranı → "Apple ile devam et" butonuna bas.
2. iOS yerel sheet'i açılmalı; bir Apple ID ile devam et.
3. Mobile, identityToken + raw nonce'yi `/v1/auth/apple`'a postlar.
4. Sunucu JWKS ile JWT'yi doğrular, `apple_sub` ile yeni kullanıcı yaratır.
5. Mobile token'ı persist eder, `/onboarding` veya `/(tabs)/home`'a yönlendirir.

Tekrar Apple ile gir → aynı `user_id` (apple_sub eşleşir).

Apple "Hide my email" seçeneği → `email = xxx@privaterelay.appleid.com` olur, DB'de saklanır, akış aynı.

## 8. Google sign-in (Android emülatör veya iOS)

> Google Play Services + Google Cloud Console OAuth client'ları gerekir.

1. Welcome → "Google ile devam et".
2. Web tabanlı Google sayfası açılır; bir hesapla giriş yap.
3. Mobile id_token alır → `/v1/auth/google` POST.
4. Sunucu JWKS ile doğrular, `google_sub` ile yeni kullanıcı yaratır.

`email_verified=false` olan bir Google hesabı denenirse → 401, `code = AUTH_GOOGLE_EMAIL_UNVERIFIED`.

## 9. Mobile Welcome ekran smoke

1. Logout / fresh install → splash sonrası Welcome ekranı.
2. Üst sırada calm Neuro + app name + welcome subtitle.
3. iOS: Apple butonu görünür. Android: gizli.
4. Google config'i mobile'da boşsa → Google butonu gizli; doluysa görünür.
5. "Sign up with email" → mevcut register ekranına push.
6. "Continue without account" (ghost link) → anon flow → `/(tabs)/home`.
7. "Have an account? Sign in with email" → login ekranı.
8. Legal note ToS ve Privacy linkleri tarayıcıda açılır.
9. RTL (`ar`): butonların ve legal note'un layout yönü doğru, hizalama sağdan sola.

## 10. Settings → Account anon davranışı

Anon kullanıcı olarak Profile → Settings → Account:

1. Üstte "Save your account" kartı görünmeli (accent border).
2. "Add email & password" → modal sheet açılır, üç alan (email, password, confirm).
3. Submit → 200, success toast `account:save.saved`, sheet kapanır, kart kaybolur (kullanıcı artık anon değil).
4. Apple/Google butonları → ilgili native flow → upgrade endpoint → toast.
5. Aynı ekran upgrade sonrası `ChangePasswordForm` ve `Delete account` butonu gösterir.

Email upgrade çakışması: aynı email zaten kayıtlıysa danger toast `errors.auth.email_taken`.

## 11. Legal & button order

- Apple butonu (varsa) en üstte → Google → email → anon ghost link altta.
- Apple App Store Review Guideline 4.8: Apple Sign-In en az diğer sağlayıcılarla **eşit görünürlükte**. ✓ üstte ve aynı yükseklikte/genişlikte.
- "By continuing you agree to..." metni butonların altında, ToS ve Privacy linkleri tıklanabilir.

## 12. Linked providers (link / unlink)

> Apple flow için iOS cihaz; Google flow için emulator/iOS gerekir. Backend doğrulaması için sahte JWT'lerle integration test cmd-line'dan da denenebilir.

### 12.1 Links summary

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@neuronot.app","password":"changeme123"}' \
  | jq -r .data.access_token)

curl -s http://localhost:8080/v1/auth/links \
  -H "Authorization: Bearer $TOKEN" | jq
```

Beklenen 200:
```json
{ "data": { "has_password": true, "has_apple": false, "has_google": false, "is_anonymous": false } }
```

### 12.2 Link Apple (mobile cihazda)

1. Settings → Account ekranında **"Linked sign-in methods"** bölümü görünür.
2. iOS cihazda Apple satırı → "Connect" butonu.
3. Tap → Apple sheet açılır → kullanıcı onaylar.
4. Mobile `/v1/auth/link/apple` POST'lar, 204 alır.
5. UI satırı "Connected" yeşiline döner; "Connect" → "Disconnect".
6. `/v1/auth/links` çağrısında `has_apple: true`.

Aynı Apple subject başka bir hesapta varsa: `AUTH_LINK_REQUIRED`, danger toast.

### 12.3 Unlink Apple

1. "Disconnect" butonuna tap.
2. Mobile `DELETE /v1/auth/link/apple` çağırır, 204 alır.
3. Satır "Not connected" griye döner.

Edge: kullanıcı sadece Apple'a bağlıysa (password ve google yok), unlink → 422 `AUTH_DETACH_LAST`. UI danger toast `errors.auth.detach_last` gösterir.

### 12.4 Google link/unlink

Aynı akış Google için: Settings → Account → Google satırı → Connect → expo-auth-session web sheet → 204.
Disconnect aynı şekilde; son kimlik kontrolü uygulanır.

### 12.5 Provider gizleme

- Android cihazda Apple satırı görünmez (`isAppleSignInLikelyAvailable`).
- Google client id `app.json`'da boşsa Google satırı görünmez.

## 13. Token rotation after upgrade

Anon token'la `/v1/me`'i çağırırsın → 200. Upgrade et → eski refresh token revoked olmalı:

```bash
curl -s -X POST http://localhost:8080/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$OLD_ANON_REFRESH\"}" | jq
```

Beklenen 401, `AUTH_TOKEN_INVALID`. Yeni access ile devam.

## Exit criteria

- [ ] Migration 00010 uygulanır, CHECK constraint aktif.
- [ ] `go test ./...` PASS, `oidc` testleri yeşil.
- [ ] Provider disabled config'i 503 döner.
- [ ] `/v1/auth/anonymous` ToS+Privacy zorunluluğunu uygular.
- [ ] Anon → email upgrade `user_id`'yi korur; aynı anon token tekrar denenince 409.
- [ ] Email collision → `AUTH_LINK_REQUIRED`.
- [ ] Apple gerçek cihazda çalışır; ikinci girişte aynı `user_id`.
- [ ] Google emulator/iOS'ta çalışır; `email_verified=false` reddedilir.
- [ ] Welcome ekranı doğru sırada butonları render eder; RTL'de hizalama doğru.
- [ ] Anon kullanıcı için Settings → Account "Save your account" kartı; upgrade sonrası kart kaybolur.
- [ ] Upgrade sonrası eski anon refresh token revoked.
- [ ] `/v1/auth/links` doğru summary döner; UI satırlarda yeşil/gri durum doğru.
- [ ] Apple/Google link → 204; satır "Connected"'a döner.
- [ ] Aynı subject başka hesaba bağlıysa link → `AUTH_LINK_REQUIRED`.
- [ ] Son kimlik unlink → `AUTH_DETACH_LAST`, UI danger toast.
