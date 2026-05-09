# ADR 0002: Cloudflare R2 (Storage) ve Resend (Transactional Mail)

**Status:** Accepted (Revised 2026-05-09)
**Date:** 2026-05-07
**Revised:** 2026-05-09 — email sağlayıcısı **Resend** olarak güncellendi (önceki taslakta Cloudflare Email idi, hiç implement edilmedi). Storage kararı (R2) değişmedi.
**Supersedes (partially):** ARCHITECTURE.md §3 deferred satırı "MinIO".

## Context

İki ayrı yardımcı kapasitenin "tetik geldiğinde nasıl açılacağı" şu ana kadar belirsizdi:

1. **Object storage.** İlk olarak `MinIO` placeholder'ı konulmuştu. Ancak ürünü barındıracağımız self-hosted VM'de MinIO çalıştırma niyetimiz yok — operasyonel yük (disk, replikasyon, backup, izleme) küçük takım için fazla. MVP'de hâlâ ihtiyaç yok ama tetik geldiğinde (ilk dosya upload, off-DB export artifact) "ne kullanacağız?" sorusu cevapsızdı.
2. **Transactional email.** Plan 1/2 (Profile/Settings) sırasında parola sıfırlama, hesap silme onayı ve "export'unuz hazır" gibi outbound mail ihtiyaçlarının er/geç çıkacağı görüldü. SMTP server işletmek istemiyoruz; ESP seçimi gerekiyor.

Kriterler her iki karar için aynı:
- Düşük operasyonel yük (managed servis).
- Dakikalar içinde DNS + token ile devreye alınabilir.
- Maliyet: MVP trafiğinde sıfıra yakın.
- Storage tarafında mevcut Cloudflare kullanım yüzeyiyle hizalı (DNS, edge, zone). Email tarafında olgun bir transactional ESP — observability ve template tooling MVP'den itibaren güvenilir.

## Decision

### Storage: Cloudflare R2

- Backend: **Cloudflare R2**, S3-uyumlu API.
- SDK: standart **AWS S3 SDK** (Go: `github.com/aws/aws-sdk-go-v2/service/s3`). Endpoint `<account>.r2.cloudflarestorage.com`, region `auto`, path-style addressing.
- Erişim: hesap-scope'lu API token (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`). Bucket başına ayrı token vermeyiz, env üzerinden tek bucket'a giriyoruz (`R2_BUCKET`).
- Public erişim: gerekirse pre-signed URL üzerinden (default 15 dk TTL). Bucket public açılmaz.
- Tetik koşulları (entegrasyon yazma izni veren olaylar):
  - Kullanıcının kendi yüklediği bir dosyayı tutmamız gereken ilk feature (MVP'de yok).
  - DB'de tutmak istemediğimiz ilk export artifact (mevcut `/v1/me/export` JSON inline döner — büyüyene kadar gerek yok).
  - Insight için görsel/grafik artifact üretimi (yine yok).

### Email: Resend

- Sağlayıcı: **Resend** (`https://api.resend.com`).
- Wire: HTTP API (SMTP açmıyoruz). Go istemcisi `github.com/resend/resend-go/v2`; SDK ağır gelirse düz `net/http` ile aynı endpoint'e konuşulur.
- Auth: tek `RESEND_API_KEY` env değişkeni; per-domain bağlama Resend dashboard üzerinden yapılır. Gönderim adresi `EMAIL_FROM` env'inden okunur (örn. `noreply@<domain>`).
- DNS: domain'in SPF + DKIM kayıtları Resend'in verdiği değerlerle **Cloudflare DNS** üzerinde tutulur (zone yönetimi hâlâ Cloudflare'de). DMARC zaten Cloudflare DNS'te.
- Inbound: Resend inbound email desteklemiyor — `support@<domain>` aliasing gerekirse **Cloudflare Email Routing** ayrı (sadece routing, gönderim değil) entegrasyon olarak kalır.
- Şablonlar: server-side i18n kullanıcının `preferred_language` değerine göre seçer; içerik kullanıcı diline çevrilmiş olarak gönderilir. Template dosyaları feature'a ait klasörde (`api/internal/<feature>/email_templates/<lang>/...`) kalır — ortak `email/` paketi yok.
- Tetik koşulları:
  - Parola sıfırlama linki (forgot-password feature'ı eklenince).
  - Hesap silme onayı (mevcut akış email retype + parola; ek onay maili henüz şart değil).
  - "Export'unuz hazır" bildirimi (büyük export R2'ye yazıldığında).
  - Konsent değişikliği audit'ı (yasal gereklilik çıkarsa).

## Consequences

**Pozitif:**
- Cloudflare storage + DNS + edge yüzeyimiz değişmez; R2 entegrasyonu tek panele bağlı kalır.
- R2: egress ücretsiz; periyodik export indirme maliyetimizi ısırmaz.
- S3 SDK kullandığımız için lock-in marjinal; ileride başka bir S3-uyumlu provider'a (Backblaze B2, Wasabi) taşıma maliyet düşük.
- Resend transactional email için olgun bir ürün: webhook tabanlı delivery/bounce eventleri, dashboard logs, structured tagging. MVP'de "deliverability sorununu daha sonra düşünürüm" demeyi göze alabiliriz.

**Negatif:**
- Vendor sayısı 1'den 2'ye çıktı (Cloudflare + Resend); fatura ve secret yönetimi iki yerde.
- Inbound (`support@`) routing Resend kapsamında değil — gerekirse Cloudflare Email Routing ayrı integration.
- R2 region `auto`: latency ve replikasyon detayları AWS S3 multi-region deployment'a göre opaque. MVP'de problem değil.

## Alternatives Considered

**Storage:**
- **MinIO (self-hosted)** — Reddedildi. Operasyonel yük (disk büyütme, replikasyon, backup) küçük takım için çok. Hedef VM'de zaten yok.
- **AWS S3** — Reddedildi (şimdilik). Egress ücreti R2'den yüksek; profit yok.
- **Local disk + nginx static** — Reddedildi. Backup, çoklu instance, signed URL desteği yok.

**Email:**
- **Cloudflare Email** — Reddedildi. Cloudflare'in transactional gönderim ürünü hâlâ erken; observability ve template tooling Resend kadar olgun değil. Tek panele toplamak için ilk taslakta seçilmişti, fakat hiç implement edilmediği için maliyet yok.
- **Postmark / SendGrid / Amazon SES** — Reddedildi. Resend'in DX'i (basit API, webhooks, dashboard logs) MVP için daha rahat; SES'in domain warmup süreci, SendGrid'in fiyatlama eğrisi MVP'ye fazla.
- **SMTP relay (Mailgun SMTP, SES SMTP)** — Reddedildi. SMTP yerine HTTP API tercih ediliyor (tooling, gözlemlenebilirlik, retry).
- **Self-hosted Postfix** — Asla. IP reputation yönetmek istemiyoruz.

## Triggers for Revisit

- R2 egress veya request fiyatlaması ürünü etkileyecek seviyeye gelirse → ikinci provider'a portable kalmak için S3 SDK soyutlamasını koru.
- Resend deliverability/uptime/fiyat sorun çıkarırsa → Postmark veya SES'e portable kalmak için template katmanını sağlayıcı-özgül kod dışında tut; provider çağrısı tek bir `internal/email` paketinde izole olsun.
- Multi-region storage gerektiren bir yasal kısıtlama çıkarsa (KVKK lokasyonu, AB residency) → R2'nin location hint'leri ya da farklı provider değerlendirilir.

Bu tetiklerden biri çıkmadıkça karar bozulmaz; her iki entegrasyonun **kodu da yazılmaz** (deferred).
