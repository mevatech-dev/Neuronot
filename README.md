# Neuronot

Kişisel zihinsel farkındalık uygulaması. Kullanıcının günlük bilişsel durumunu (odak, enerji, unutkanlık, stres, uyku, baş ağrısı, brain fog) hızlıca kaydedip AI destekli **örüntü insight'ları** üretir.

**Tanı veya tedavi sistemi değildir.** Yalnızca kullanıcının kendi verisinden gözlemlenebilir, düşük riskli ve kişisel farkındalık üretir.

---

## Stack

- **Mobile**: Expo SDK 52+ + React Native + TypeScript
- **API**: Go 1.22+, `chi`, `pgx`, `goose`
- **DB**: PostgreSQL 18
- **AI**: Anthropic Claude (Sonnet 4.6)
- **i18n**: 11 dil (en, tr native; es, de, fr, pt, it, ru, ja, zh ML+review; ar Beta)

---

## Hızlı Başlangıç

```bash
# 1. Bağımlılıklar
brew install go bun docker
go install github.com/pressly/goose/v3/cmd/goose@latest
bun add -g expo

# 2. Postgres ayağa
make db-up

# 3. .env oluştur
cp api/.env.example api/.env
# DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY doldur

# 4. Migrations
export $(cat api/.env | xargs)
make db-migrate

# 5. API
make api-dev          # localhost:8080

# 6. Mobile (yeni terminal)
make mobile-dev       # Expo dev server
```

`/health` endpoint 200 dönerse API çalışıyor demek.

---

## Repo Yapısı

```
neuronot/
├─ mobile/            Expo app
├─ api/               Go REST API (modular monolith)
├─ worker/            Boş — eklenme tetiği için bkz. worker/README.md
├─ web/               Boş — eklenme tetiği için bkz. web/README.md
├─ infra/             Docker compose, postgres init
├─ docs/              PRD, ARCHITECTURE, ADR, api-errors
└─ .github/workflows/ CI: lint + test
```

---

## Daha Fazla

- [PRD](docs/PRD.md) — ürün vizyonu, kullanıcı, scope
- [ARCHITECTURE](docs/ARCHITECTURE.md) — teknik kararlar, sınırlar, patternler
- [ADR](docs/adr/) — mimari karar kayıtları
- [api-errors](docs/api-errors.md) — error code katalog
- [Hafta 4 Verification](docs/HAFTA4_VERIFICATION.md) — 11 dil i18n ve RTL smoke test
- [Hafta 5 Verification](docs/HAFTA5_VERIFICATION.md) — Neuro maskot, splash, icon, polish smoke test
