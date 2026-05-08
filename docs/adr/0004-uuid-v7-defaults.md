# ADR 0004: UUID v7 Defaults (PostgreSQL Native)

**Status:** Accepted
**Date:** 2026-05-08
**Replaces:** Implicit "use `gen_random_uuid()` everywhere" choice from Hafta 1.

## Context

Hafta 1'de tablo PK'leri için PostgreSQL'in `pgcrypto.gen_random_uuid()` fonksiyonu kullanıldı — UUID v4, tamamen rastgele. Bu kararın iki sonucu var:

1. **Pgcrypto extension'ı yüklü** — sadece `gen_random_uuid()` için. Başka kullanımı yok (parola hash'i Go bcrypt; audit alan şifrelemesi Go AES-GCM).
2. **Random ID'ler B-tree'de scatter ediyor** — her INSERT, indexin rastgele bir noktasına yazıyor. MVP ölçeğinde sorun değil ama büyüdüğünde (özellikle `daily_logs`, `events`) cache locality ve insert maliyeti acıyor.

PostgreSQL 18 (Mart 2025) `uuidv7()` fonksiyonunu **core**'a aldı — extension gerekmez. UUID v7 RFC 9562 standardı: ilk 48 bit Unix milisaniye timestamp, kalan 74 bit rastgele. Aynı `uuid` veri tipi (16 bayt), aynı format (`xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`), sadece zaman-sıralı.

ULID alternatifi de tartışıldı ve **reddedildi**: 26 karakter Crockford-base32 string, app-side generation, kolon tipi değişikliği. Faydası UUID v7'den marjinal; maliyeti büyük.

## Decision

**Tüm migration'larda PK default'u `uuidv7()`.**

```sql
id uuid PRIMARY KEY DEFAULT uuidv7()
```

Mevcut 10 migration (`00001` … `00010`) bu default'a çevrildi. Henüz hiçbir migration production'a uygulanmadığı için (kullanıcı ortamı sıfırdan), geriye uyumluluk endişesi yok.

`infra/postgres/init.sql` artık sadece `citext` yüklüyor; `pgcrypto` kaldırıldı çünkü başka kullanımı yok.

## Consequences

**Pozitif:**
- Yeni satırlar B-tree'nin sağ kenarında kümelenir → INSERT amortized O(log n) yerine pratikte O(1) cache-friendly path.
- ID'lerden yaklaşık oluşturulma zamanı okunabilir (debug/log'da işe yarar; PG'de `uuid_extract_timestamp(id)` ile dönüştürülebilir).
- Saldırı yüzeyi azaldı (pgcrypto bağımlılığı yok).
- Cursor pagination değişmedi — `(occurred_at, id) < ($2, $3)` tuple'ı zaten doğru sıralamayı sağlıyor; UUID v7'nin zaman prefix'i bonus.

**Negatif:**
- ID'lerden yaklaşık zaman türetilebilir → "ID'den ne zaman oluşturulduğunu sızdırmak istemiyorum" senaryosunda v4 daha güvenliydi. Ürünümüzde bu bir tehdit değil (`created_at` zaten DTO'larda dönüyor).
- PostgreSQL <18'e indirme yapılamaz; biz zaten 18-alpine kullanıyoruz, sorun yok.

## Alternatives Considered

- **`gen_random_uuid()` (UUID v4) — STATUS QUO.** Reddedildi: insert locality kötü, ileride retroaktif değişim daha pahalı.
- **ULID (string).** Reddedildi: kolon tipi değişikliği, app-side generation, marjinal kazanç.
- **Snowflake ID / NanoID.** Reddedildi: distributed sistem, single-binary monolitte gereksiz karmaşa.
- **`int8`/serial PK.** Reddedildi: enumeration saldırısı (kaç hesabımız var?), public-facing path'lere konulamaz.

## Triggers for Revisit

- `uuid_extract_timestamp(id)`'den oluşturma zamanını sızdırmak yasal kaygı doğurursa → v4'e geri dön (zor; tablolar dolu olur).
- Çok-bölgeli aktif-aktif yazma gerekirse → Snowflake-style monotonic ID düşünülebilir (Worker scope, deferred).
- PG sürümü düşürülmek zorunda kalınırsa (16 veya 17) → `gen_random_uuid()` veya app-side `uuid` üretimine düş.
