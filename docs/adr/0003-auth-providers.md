# ADR 0003: Auth Providers — Anonymous + Apple + Google

**Status:** Accepted
**Date:** 2026-05-07
**Spec:** [`docs/superpowers/specs/2026-05-07-auth-providers-design.md`](../superpowers/specs/2026-05-07-auth-providers-design.md)

## Context

Hafta 1'de auth tek bir kapı olarak yazıldı: email + password. Ürünü ilk dağıtacağımız mobile mağazaları için iki gerçek var:

1. App Store Review Guideline 4.8 — ürün başka bir sosyal sağlayıcı (Google, Facebook, vb.) sunarsa iOS'ta **Sign in with Apple** zorunlu, en az eşit görünürlükte.
2. Kullanıcı talebi: "hemen başlamak istiyorum, sonra düşünürüm" → anonim mod.

Bu üçünü (anonim, Apple, Google) eş zamanlı eklemek doğru pencere. Tasarım kararları spec dokümanında ayrıntılı; bu ADR sadece kararı + gerekçesini sabitler.

## Decision

### 1. Üç yeni giriş yolu

- **Anonymous**: `POST /v1/auth/anonymous` → email/şifre olmadan kullanıcı oluşturur, `is_anonymous = true`. ToS + Privacy onayı yine zorunlu; AI consent opsiyonel.
- **Apple**: `POST /v1/auth/apple` → mobile `expo-apple-authentication` ile alınan `identityToken` JWT'si server tarafında JWKS ile doğrulanır.
- **Google**: `POST /v1/auth/google` → mobile `expo-auth-session/providers/google` ile alınan `id_token` server tarafında JWKS ile doğrulanır.

Mevcut `register`/`login`/`refresh`/`logout` korunur.

### 2. Schema: tek tablo (Option A)

`users` tablosuna kolon eklenir; ayrı `auth_providers` tablosu yok.

```sql
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN apple_sub  text UNIQUE,
  ADD COLUMN google_sub text UNIQUE,
  ADD CONSTRAINT users_identity_required CHECK (
    is_anonymous = true
    OR email IS NOT NULL
    OR apple_sub IS NOT NULL
    OR google_sub IS NOT NULL
  );
```

YAGNI: bir kullanıcının iki Google hesabı bağlama senaryosu yok; gerekirse Option B'ye migrate edilir.

### 3. Email çakışmasında manuel link (no auto-link)

Aynı email ile zaten password hesabı varken Apple/Google girişi → server `AUTH_LINK_REQUIRED` döner. Mobile "önce email ile giriş yap, Settings'te bağla" der. E-posta doğrulamamız olmadığı için auto-link **yapılmaz** (account takeover riski).

### 4. Google mobile lib: `expo-auth-session/providers/google`

Managed Expo flow kullanılır; native build (prebuild / dev-client) gerekmez. Native Sign-In sheet daha pürüzsüz olurdu (`@react-native-google-signin/google-signin`) ama 5 haftalık MVP'de native config (GoogleService-Info.plist + google-services.json + EAS pre-build) overhead'i gereksiz.

### 5. Welcome ekran sırası: sosyal üstte

```
[Continue with Apple]   ← iOS-only render guard
[Continue with Google]
[Sign up with email]
Continue without account  ← link
```

Apple guideline'ına en az eşit görünürlük şartına uyar.

### 6. Anonymous → upgrade `user_id`'yi korur

Anon kullanıcı email/sosyal hesaba "yükseldiğinde" `users.id` aynı kalır; `daily_logs`, `events`, `insights` cascade taşır. Ek migration gerekmez.

### 7. Anonymous deletion: yok (MVP)

Yetim anon hesapları nightly silen cron yok — Worker scope'u (deferred). MVP'de anon hesap sonsuza kadar yaşar; tetik geldiğinde Worker README'den çıkarılıp eklenir.

### 8. Sosyal sağlayıcının verdiği e-postaya mail göndermek: yok (MVP)

Resend tetiği gelene kadar (ADR 0002) hiçbir email gönderilmez. Apple Private Relay adresi DB'de saklanır ama unutulur.

## Consequences

**Pozitif:**
- Üç giriş yolu tek migration + tek auth feature klasörünün genişletilmesiyle çalışır.
- JWKS doğrulamayı kendi yazıyoruz (~150 satır) — 3rd party lib eklenmiyor.
- Anonymous mode "sıfır sürtüşme" deneyimi sağlar; kullanıcı denemek isterse upgrade yolu açık.

**Negatif:**
- `email` artık nullable; auth/profile katmanlarında null-safe path'lerin korunması gerek.
- Manuel link akışı (auto-link reddedildiğinden) bazı kullanıcılar için ekstra adım. UX, takeover riskinden değerli.
- expo-auth-session web-OAuth modal'ı native sheet kadar pürüzsüz değil — ileride native lib'e geçiş açılabilir.
- Anon hesap birikimi (deletion yok) DB'de uzun vadede yığılır; trigger geldiğinde Worker yazılır.

## Alternatives Considered (özet)

- **Sadece email/password + magic link** — Reddedildi. Apple guideline + kullanıcı talebi ikisini birden karşılamaz.
- **Auth0 / Clerk / Supabase Auth** — Reddedildi. Tek vendor lock-in + paywall + KVKK lokasyon kontrolü zor + DB'mizdeki user_id kontrolünü kaybediyoruz.
- **Sadece sosyal (anon ve email yok)** — Reddedildi. Anonim deneme talebi var; email akışı zaten yazılı.
- **Ayrı auth_providers tablosu (Option B)** — Reddedildi (YAGNI). Tetik gelirse migrate edilir.
- **Auto-link on email match** — Reddedildi (takeover riski).

## Triggers for Revisit

- Kullanıcı "Aynı maili Google'da kullandım, neden tekrar şifre soruyorsun?" şikayeti üst üste gelirse → email verification ekle, sonra auto-link aç.
- "Birden çok Google hesabıyla bağlanmak istiyorum" senaryosu çıkarsa → `auth_providers` tablosuna migrate et.
- Anon hesap sayısı DB'yi şişirirse → Worker'da nightly cleanup job aç.
- Sign-In sheet UX şikayeti gelirse → `@react-native-google-signin/google-signin`'a geç (native build).
- Resend tetiği gelirse (ADR 0002) → password reset, account deletion confirmation, "your export is ready" bildirimleri açılır.
