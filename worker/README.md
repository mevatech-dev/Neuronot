# worker/ — Boş

Bu klasör **bilerek boş**. MVP'de worker process yok.

## Eklenme Tetiği

Şu sinyallerden biri çıkınca buraya kod yazılır:

- Senkron AI insight üretimi >10s sürmeye başlayınca (kullanıcı bekleyemez).
- Haftalık/aylık batch insight feature'ı eklenince (cron iş yükü).
- Push notification scheduling gerekince.

## Beklenen Şekil

Eklendiğinde aynı `api/` ile pattern paylaşır:

```
worker/
├─ cmd/worker/main.go
├─ internal/
│  ├─ config/         # api'den paylaşılabilir
│  ├─ db/             # api'den paylaşılabilir
│  ├─ jobs/           # her batch job kendi vertical slice
│  └─ scheduler/
└─ Dockerfile
```

Queue: Redis (BullMQ benzeri Go kütüphanesi) veya `pgx` üzerinden Postgres `LISTEN/NOTIFY`. Karar tetik geldiğinde verilir.

## Şimdiki Aksiyon

Yok. Bu klasöre dosya eklemek isteyen biri varsa, önce yukarıdaki tetiklerden birinin gerçekleştiğini doğrulamalı, sonra ADR yazmalı (`docs/adr/`).
