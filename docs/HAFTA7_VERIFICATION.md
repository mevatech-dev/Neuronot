# Hafta 7 Verification Runbook

Hafta 7: Profile/Settings backend overhaul (zorunlu AI consent + 9 endpoint) için end-to-end smoke test. Consents audit, AI consent gate, şifre değiştir, veri export ve hesap silme akışlarını kapsar.

Referans:
- Spec: [`docs/superpowers/specs/2026-05-07-profile-settings-design.md`](superpowers/specs/2026-05-07-profile-settings-design.md)
- Plan: [`docs/superpowers/plans/2026-05-07-profile-settings-backend.md`](superpowers/plans/2026-05-07-profile-settings-backend.md)

## 0. Pre-requisites

`api/.env` aşağıdaki değişkenleri içermeli:

- `DATABASE_URL`
- `JWT_SECRET` (≥32 karakter)
- `OPENAI_API_KEY`
- `CONSENT_KEK` — consents audit kolonlarını şifrelemek için 32 byte base64 KEK.

`CONSENT_KEK` üretmek için:

```bash
openssl rand -base64 32
```

Çıktıyı `api/.env` içine `CONSENT_KEK=...` olarak ekle.

API'yi başlat:

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
set -a && source api/.env && set +a
make api-dev
```

Beklenen: `listening on :8080` log satırı; `CONSENT_KEK` eksikse boot hata vererek durmalı.

## 1. Migration

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
make db-up
make db-migrate
```

`00009_consents.sql` migration'ı uygulandığını psql ile doğrula:

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "\d consents"
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "\di consents*"
```

Beklenen:

- `consents` tablosu mevcut, kolonlar: `id, user_id, type, granted, version, occurred_at, ip_encrypted, device_id_encrypted, user_agent, created_at`.
- `idx_consents_user_type_occurred` index'i `(user_id, type, occurred_at DESC)` üstünde mevcut.
- `goose_db_version` tablosunda 00001…00009 hepsi `applied`.

## 2. Otomatik testler

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...
```

Beklenen: tüm paketler PASS — özellikle `internal/consents`, `internal/account`, `internal/dataexport`, `internal/auth`, `internal/insights`.

## 3. Register: zorunlu AI consent

### 3.1 Consent body olmadan → 422

```bash
curl -s -X POST http://localhost:8080/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' | jq
```

Beklenen:

```json
{
  "data": null,
  "error": {
    "code": "AUTH_AI_CONSENT_REQUIRED",
    "message_key": "errors.auth.ai_consent_required",
    "message": "AI usage consent is required to register."
  }
}
```

HTTP 422.

### 3.2 Üç consent ile → 201

```bash
curl -s -X POST http://localhost:8080/v1/auth/register \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: HAFTA7-smoke/1.0' \
  -d '{
    "email":"test@neuronot.app",
    "password":"changeme123",
    "consents":[
      {"type":"ai_usage","version":"1.0","granted":true},
      {"type":"terms_of_service","version":"1.0","granted":true},
      {"type":"privacy_policy","version":"1.0","granted":true}
    ]
  }' | jq
```

Beklenen: HTTP 201; `data.access_token` ve `data.refresh_token` döner.

Token'ı sakla:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | jq -r '.data.access_token')
```

## 4. Consents endpoint

### 4.1 List

```bash
curl -s http://localhost:8080/v1/me/consents \
  -H "Authorization: Bearer $TOKEN" | jq
```

Beklenen: `data.consents` 3 entry (ai_usage / terms_of_service / privacy_policy), her biri `granted: true`, `version: "1.0"`, ve `current_version` alanı dolu.

### 4.2 Revoke

```bash
curl -s -i -X DELETE http://localhost:8080/v1/me/consents/ai_usage \
  -H "Authorization: Bearer $TOKEN"
```

Beklenen: HTTP 204, body yok.

Tekrar list:

```bash
curl -s http://localhost:8080/v1/me/consents \
  -H "Authorization: Bearer $TOKEN" | jq '.data.consents[] | select(.type=="ai_usage")'
```

Beklenen: `granted: false` (en son audit satırı revoke kaydı).

## 5. Insights AI consent gate

AI consent revoke iken insight üretimi reddedilmeli.

```bash
curl -s -X POST http://localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq
```

Beklenen:

```json
{
  "data": null,
  "error": {
    "code": "INSIGHT_CONSENT_REVOKED",
    "message_key": "errors.insights.consent_revoked",
    "message": "AI usage consent must be active to generate insights."
  }
}
```

HTTP 403.

AI consent'i geri ver:

```bash
curl -s -X POST http://localhost:8080/v1/me/consents \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"type":"ai_usage","version":"1.0","granted":true}' | jq
```

## 6. Şifre değiştir

### 6.1 Yanlış mevcut şifre → 401

```bash
curl -s -X POST http://localhost:8080/v1/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"wrongpass123","new_password":"newpass123"}' | jq
```

Beklenen:

```json
{
  "data": null,
  "error": {
    "code": "AUTH_PASSWORD_INCORRECT",
    "message_key": "errors.auth.password_incorrect",
    "message": "Current password is incorrect."
  }
}
```

HTTP 401.

### 6.2 Doğru şifre → 204

Önce mevcut refresh token'ı yakala:

```bash
LOGIN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@neuronot.app","password":"changeme123"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.access_token')
REFRESH=$(echo "$LOGIN" | jq -r '.data.refresh_token')

curl -s -i -X POST http://localhost:8080/v1/me/password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"changeme123","new_password":"newpass123"}'
```

Beklenen: HTTP 204.

Eski refresh token artık geçersiz olmalı:

```bash
curl -s -X POST http://localhost:8080/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq
```

Beklenen: `error.code = AUTH_INVALID_REFRESH` veya benzeri (HTTP 401). Yeni şifreyle login yapılmalı.

## 7. Veri export

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@neuronot.app","password":"newpass123"}' \
  | jq -r '.data.access_token')

curl -s http://localhost:8080/v1/me/export \
  -H "Authorization: Bearer $TOKEN" | jq 'keys, .data | keys'
```

Beklenen: HTTP 200, root keys `["data","error"]`, `data` keys şunları içerir:

- `profile`
- `daily_logs`
- `events`
- `insights`
- `generated_at`

`generated_at` ISO8601 timestamp; tüm listeler kullanıcıya ait kayıtları içerir, başka kullanıcının verisi sızmaz.

## 8. Hesap sil

### 8.1 Yanlış email → 422

```bash
curl -s -X DELETE http://localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"wrong@neuronot.app","password":"newpass123"}' | jq
```

Beklenen:

```json
{
  "data": null,
  "error": {
    "code": "ACCOUNT_DELETE_EMAIL_MISMATCH",
    "message_key": "errors.account.delete_email_mismatch",
    "message": "Email confirmation does not match the authenticated account."
  }
}
```

HTTP 422.

### 8.2 Doğru email → 204

```bash
curl -s -i -X DELETE http://localhost:8080/v1/me \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@neuronot.app","password":"newpass123"}'
```

Beklenen: HTTP 204.

Aynı token ile sonraki istek 401 dönmeli (refresh token cascade silinmiş olmalı):

```bash
curl -s -i http://localhost:8080/v1/me/consents \
  -H "Authorization: Bearer $TOKEN"
```

Beklenen: HTTP 401 (`AUTH_INVALID_TOKEN` veya benzeri).

DB seviyesinde kullanıcı kaydı silindiğini doğrula:

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "SELECT count(*) FROM users WHERE email = 'test@neuronot.app';"
```

Beklenen: `0`.

## 9. Audit verisi şifreli

Consents tablosundaki IP / device kolonlarının plaintext olmadığını doğrula:

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot \
  -c "SELECT type, granted, version, length(ip_encrypted), length(device_id_encrypted), user_agent FROM consents ORDER BY occurred_at DESC LIMIT 5;"
```

Beklenen:

- `length(ip_encrypted) > 12` (AES-GCM nonce 12 byte + ciphertext + 16 byte tag).
- Çıktıda hiçbir okunabilir IP (`192.168.x.x`, `127.0.0.1`, vb.) görünmemeli.
- `user_agent` plaintext'tir (PII değil, telemetri); `HAFTA7-smoke/1.0` değeri görünür.

## Exit Criteria

- [ ] `CONSENT_KEK` eksikken API boot fail eder.
- [ ] Migration 00009 uygulanır, `idx_consents_user_type_occurred` mevcut.
- [ ] `go test ./...` PASS.
- [ ] Register consent olmadan 422 `AUTH_AI_CONSENT_REQUIRED`.
- [ ] Register 3 consent ile 201; `GET /v1/me/consents` 3 entry döner.
- [ ] `DELETE /v1/me/consents/ai_usage` sonrası ai_usage `granted: false`.
- [ ] AI revoke iken `POST /v1/insights/generate` 403 `INSIGHT_CONSENT_REVOKED`.
- [ ] Yanlış şifre 401 `AUTH_PASSWORD_INCORRECT`; doğru şifre 204 + refresh token revoke.
- [ ] `GET /v1/me/export` 200 ve `profile/daily_logs/events/insights/generated_at` keys içerir.
- [ ] Yanlış email ile delete 422 `ACCOUNT_DELETE_EMAIL_MISMATCH`; doğru email 204 + sonraki istek 401.
- [ ] `consents.ip_encrypted` length > 12 bytes ve plaintext IP görünmez.
