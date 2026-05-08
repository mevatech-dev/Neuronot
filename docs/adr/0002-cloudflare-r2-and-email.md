# ADR 0002: Cloudflare R2 (Storage) ve Cloudflare Email (Transactional Mail)

**Status:** Accepted
**Date:** 2026-05-07
**Supersedes (partially):** ARCHITECTURE.md §3 deferred satırı "MinIO". Email için yeni karar.

## Context

İki ayrı yardımcı kapasitenin "tetik geldiğinde nasıl açılacağı" şu ana kadar belirsizdi:

1. **Object storage.** İlk olarak `MinIO` placeholder'ı konulmuştu. Ancak ürünü barındıracağımız self-hosted VM'de MinIO çalıştırma niyetimiz yok — operasyonel yük (disk, replikasyon, backup, izleme) küçük takım için fazla. MVP'de hâlâ ihtiyaç yok ama tetik geldiğinde (ilk dosya upload, off-DB export artifact) "ne kullanacağız?" sorusu cevapsızdı.
2. **Transactional email.** Plan 1/2 (Profile/Settings) sırasında parola sıfırlama, hesap silme onayı ve "export'unuz hazır" gibi outbound mail ihtiyaçlarının er/geç çıkacağı görüldü. SMTP server işletmek istemiyoruz; ESP seçimi gerekiyor.

Kriterler her iki karar için aynı:
- Düşük operasyonel yük (managed servis).
- Dakikalar içinde DNS + token ile devreye alınabilir.
- Maliyet: MVP trafiğinde sıfıra yakın.
- Mevcut Cloudflare kullanım yüzeyiyle hizalı (DNS, edge, zone). Tek faturalı sağlayıcı.

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

### Email: Cloudflare Email

- Sağlayıcı: **Cloudflare'in transactional e-posta gönderim ürünü**.
- Wire: HTTP API ile çağrı (SMTP açmıyoruz).
- DNS: domain'in MX/SPF/DKIM/DMARC kayıtları Cloudflare üzerinden yönetilir; `From` adresi `noreply@<domain>` (transactional) ve `support@<domain>` (alias, Email Routing ile inbox'a yönlenir).
- Şablonlar: server-side i18n kullanıcının `preferred_language` değerine göre seçer; içerik kullanıcı diline çevrilmiş olarak gönderilir. Template dosyaları feature'a ait klasörde (`api/internal/<feature>/email_templates/<lang>/...`) kalır — ortak `email/` paketi yok.
- Tetik koşulları:
  - Parola sıfırlama linki (forgot-password feature'ı eklenince).
  - Hesap silme onayı (mevcut akış email retype + parola; ek onay maili henüz şart değil).
  - "Export'unuz hazır" bildirimi (büyük export R2'ye yazıldığında).
  - Konsent değişikliği audit'ı (yasal gereklilik çıkarsa).

## Consequences

**Pozitif:**
- Tek vendor (Cloudflare) DNS, edge, storage, email — operasyonel sürtünme düşük.
- R2: egress ücretsiz; periyodik export indirme maliyetimizi ısırmaz.
- S3 SDK kullandığımız için lock-in marjinal; ileride başka bir S3-uyumlu provider'a (Backblaze B2, Wasabi) taşıma maliyet düşük.
- Email gönderimini Cloudflare üzerinden yapmak SPF/DKIM align'ı kolay; teslim oranı yönetimi vendor'a düşer.

**Negatif:**
- Cloudflare'in transactional email ürünü yeni; kullanım kotaları, throttle, başarısız teslim retry semantiği üretimde gözlenmeli. Tetik geldiğinde önce küçük bir spike test gerekir.
- R2 region `auto`: latency ve replikasyon detayları AWS S3 multi-region deployment'a göre opaque. MVP'de problem değil.
- "Tek vendor" → vendor outage tek çuval. Banking-grade availability hedefimiz yok; kabul edilir risk.

## Alternatives Considered

**Storage:**
- **MinIO (self-hosted)** — Reddedildi. Operasyonel yük (disk büyütme, replikasyon, backup) küçük takım için çok. Hedef VM'de zaten yok.
- **AWS S3** — Reddedildi (şimdilik). Egress ücreti R2'den yüksek; profit yok.
- **Local disk + nginx static** — Reddedildi. Backup, çoklu instance, signed URL desteği yok.

**Email:**
- **Resend / Postmark / SendGrid** — Tercih edilebilirdi; Cloudflare zaten DNS yüzeyimizi yönetiyor olduğundan tek panele toplamak yerel optimum.
- **SMTP relay (Mailgun SMTP, Amazon SES SMTP)** — Reddedildi. SMTP yerine HTTP API tercih ediliyor (tooling, gözlemlenebilirlik, retry).
- **Self-hosted Postfix** — Asla. IP reputation yönetmek istemiyoruz.

## Triggers for Revisit

- R2 egress veya request fiyatlaması ürünü etkileyecek seviyeye gelirse → ikinci provider'a portable kalmak için S3 SDK soyutlamasını koru.
- Cloudflare email gönderim ürünü deliverability sorunu yaşatırsa → Resend'a düş, template'lar zaten i18n dosyalarında.
- Multi-region storage gerektiren bir yasal kısıtlama çıkarsa (KVKK lokasyonu, AB residency) → R2'nin location hint'leri ya da farklı provider değerlendirilir.

Bu tetiklerden biri çıkmadıkça karar bozulmaz; her iki entegrasyonun **kodu da yazılmaz** (deferred).
