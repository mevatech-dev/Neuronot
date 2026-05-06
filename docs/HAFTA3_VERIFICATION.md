# Hafta 3 Verification Runbook

Hafta 3: AI insight + multilingual prompt + safety filter + crisis boundary smoke test.

## Ön Koşul

Hafta 2 verification başarıyla tamamlanmış olmalı. `api/.env` içinde `DATABASE_URL`, `JWT_SECRET`, opsiyonel olarak `ANTHROPIC_API_KEY` bulunmalı.

## 1. Migration

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
```

Beklenen: `00006_insights.sql` uygulanır ve `insights` tablosu oluşur.

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot -c "\d insights"
```

## 2. Automated Checks

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/api
go test ./...

cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun run typecheck
bun run lint
```

Beklenen: üç komut da PASS.

## 3. API Smoke: Auth Token

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
```

## 4. Insufficient Data Case

```bash
curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: 7 günde 3'ten az daily log varsa `INSIGHT_INSUFFICIENT_DATA`.

## 5. AI Unavailable Case

`ANTHROPIC_API_KEY` boşken ve kullanıcıda en az 3 daily log varken:

```bash
curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: `INSIGHT_AI_UNAVAILABLE`.

## 6. Crisis Bypass Case

Kullanıcıya 3 daily log ekle, sonra kriz keyword içeren event ekle:

```bash
curl -s -X POST localhost:8080/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"brain_fog","intensity":3,"note":"I might harm myself"}'

curl -s -X POST localhost:8080/v1/insights/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

Beklenen: HTTP 200, `crisis: true`, AI çağrısı gerekmeden destek kartı.

## 7. Mobile Smoke

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun start
```

1. Expo Go veya development build ile uygulamayı aç.
2. En az 3 daily log olan kullanıcıyla giriş yap.
3. Insights tabına git.
4. `Generate insight` butonuna bas.
5. AI unavailable durumunda lokalize hata metni gösterilir.
6. Kaydedilmiş insight varsa latest card ve history listesi görünür.
7. Crisis insight varsa sarı uyarı border'ı ve crisis namespace hint metni görünür.

## Çıkış Kriterleri

- [ ] `00006_insights.sql` uygulanıyor.
- [ ] `go test ./...` geçiyor.
- [ ] `bun run typecheck` geçiyor.
- [ ] `bun run lint` geçiyor.
- [ ] `/v1/insights` list endpoint'i envelope döndürüyor.
- [ ] `/v1/insights/generate` insufficient data, AI unavailable, rate limit ve crisis bypass yollarında doğru error/code/body döndürüyor.
- [ ] Mobile Insights tabı empty, loading, error, latest, history ve crisis state'lerini gösteriyor.
