# API Error Codes

Her error response standart envelope döner:

```json
{
  "data": null,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message_key": "errors.auth.invalid_credentials",
    "message": "Invalid email or password"
  }
}
```

Client `code` veya `message_key` üzerinden kendi locale'inden çeviri yapar. `message` İngilizce fallback olarak server tarafından üretilir.

---

## Auth

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | `errors.auth.invalid_credentials` | Email/şifre uyuşmuyor |
| `AUTH_EMAIL_TAKEN` | 409 | `errors.auth.email_taken` | Bu email kayıtlı |
| `AUTH_WEAK_PASSWORD` | 422 | `errors.auth.weak_password` | Min 8 karakter şartı |
| `AUTH_INVALID_EMAIL` | 422 | `errors.auth.invalid_email` | Email format geçersiz |
| `AUTH_TOKEN_EXPIRED` | 401 | `errors.auth.token_expired` | Access token süresi dolmuş |
| `AUTH_TOKEN_INVALID` | 401 | `errors.auth.token_invalid` | Token imzası geçersiz |
| `AUTH_REFRESH_EXPIRED` | 401 | `errors.auth.refresh_expired` | Refresh token süresi dolmuş |
| `AUTH_REFRESH_REVOKED` | 401 | `errors.auth.refresh_revoked` | Refresh token iptal edilmiş |
| `AUTH_RATE_LIMITED` | 429 | `errors.auth.rate_limited` | Çok fazla deneme |

---

## Daily Log

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `DAILY_LOG_DUPLICATE` | 409 | `errors.daily_log.duplicate` | Aynı gün ikinci log |
| `DAILY_LOG_INVALID_RANGE` | 422 | `errors.daily_log.invalid_range` | Slider değeri 1-5 dışında |
| `RESOURCE_NOT_FOUND` | 404 | `errors.generic.not_found` | PATCH'de id yok / başkasına ait (404, 403 değil) |

---

## Event

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `EVENT_INVALID_TYPE` | 422 | `errors.event.invalid_type` | Bilinmeyen event type |
| `EVENT_INVALID_INTENSITY` | 422 | `errors.event.invalid_intensity` | intensity 1-5 dışında |
| `EVENT_NOTE_TOO_LONG` | 422 | `errors.event.note_too_long` | Note > 500 karakter |

---

## Profile

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `PROFILE_INVALID_FOCUS` | 422 | `errors.profile.invalid_focus` | Bilinmeyen focus_problem |
| `PROFILE_INVALID_INTENSITY` | 422 | `errors.profile.invalid_intensity` | intensity_level 1-5 dışında |
| `PROFILE_INVALID_SLEEP` | 422 | `errors.profile.invalid_sleep` | avg_sleep_hours 0-24 dışında |
| `PROFILE_INVALID_TIMEZONE` | 422 | `errors.profile.invalid_timezone` | Geçersiz IANA timezone |
| `PROFILE_INVALID_REMINDER_HOUR` | 422 | `errors.profile.invalid_reminder_hour` | reminder_hour 0-23 dışında |
| `PROFILE_REMINDER_HOUR_REQUIRED` | 422 | `errors.profile.reminder_hour_required` | reminder_enabled true ise saat şart |

---

## Stats

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `STATS_INVALID_METRIC` | 422 | `errors.stats.invalid_metric` | Bilinmeyen trend metric |
| `STATS_INVALID_DAYS` | 422 | `errors.stats.invalid_days` | days 1-90 dışında |

---

## Sync

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `SYNC_INVALID_SINCE` | 422 | `errors.sync.invalid_since` | since RFC3339 değil |
| `SYNC_BATCH_TOO_LARGE` | 413 | `errors.sync.batch_too_large` | push body > 200 op |
| `SYNC_UNKNOWN_TABLE` | 422 | `errors.sync.unknown_table` | Bilinmeyen sync tablosu |

---

## Insight

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `INSIGHT_INSUFFICIENT_DATA` | 422 | `errors.insight.insufficient_data` | 7 günde 3'ten az log |
| `INSIGHT_AI_UNAVAILABLE` | 503 | `errors.insight.ai_unavailable` | Claude API çağrısı başarısız |
| `INSIGHT_RATE_LIMITED` | 429 | `errors.insight.rate_limited` | Günde 1 generate hakkı |
| `INSIGHT_CRISIS_DETECTED` | 200 | `errors.insight.crisis_detected` | Output crisis card; HTTP 200 ama bayrak set |

---

## Generic

| Code | HTTP | message_key | Anlam |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | `errors.generic.not_found` | ID yok veya başka kullanıcının |
| `VALIDATION_FAILED` | 422 | `errors.generic.validation_failed` | Schema doğrulama hatası |
| `INTERNAL_ERROR` | 500 | `errors.generic.internal_error` | Bilinmeyen hata |
| `UNAUTHORIZED` | 401 | `errors.generic.unauthorized` | Auth header yok |
| `FORBIDDEN` | 403 | `errors.generic.forbidden` | Yetki yok (genelde 404 dönmek tercih, varlık ifşası önle) |

---

## Authorization Note

Bir kullanıcı başka kullanıcının kaynağına erişmeye çalışırsa **404** dönülür (403 değil). Bu, varlığın varlığını ifşa etmemek içindir.
