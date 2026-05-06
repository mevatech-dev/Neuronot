# Hafta 2 Verification Runbook

Hafta 2: onboarding + daily-log + events + timeline tamamlandı. Bu doküman uçtan uca smoke test adımlarıdır.

## Ön Koşul

Hafta 1 verification başarıyla tamamlanmış olmalı (DB ayağa kalkmış, API çalışıyor, mobile en az bir kere yüklenmiş).

## 1. Yeni Migration'ları Uygula

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
```

Beklenen: `OK 00003_profiles.sql`, `OK 00004_daily_logs.sql`, `OK 00005_events.sql`.

```bash
docker exec -it neuronot_postgres psql -U neuronot -d neuronot -c "\dt"
# tablolar: users, refresh_tokens, profiles, daily_logs, events
```

## 2. Go Bağımlılıkları (yeni paketler için)

```bash
cd api
go mod tidy
```

## 3. API'yi Yeniden Başlat

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
make api-dev
```

## 4. API Smoke Test

```bash
# Login (Hafta 1'deki test kullanıcısıyla)
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Profile (lazy create)
curl -s localhost:8080/v1/profile -H "Authorization: Bearer $TOKEN"

# Profile patch (onboarding tamamla)
curl -s -X PATCH localhost:8080/v1/profile \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"focus_problem":"focus","intensity_level":4,"avg_sleep_hours":6.5,"caffeine_daily":true,"complete_onboarding":true}'

# Daily log
curl -s -X POST localhost:8080/v1/daily-logs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"focus":3,"energy":4,"forgetfulness":2,"stress":3,"sleep_quality":4}'

# Aynı gün tekrar dene → 409 DAILY_LOG_DUPLICATE
curl -s -X POST localhost:8080/v1/daily-logs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"focus":3,"energy":4,"forgetfulness":2,"stress":3,"sleep_quality":4}'

# Event
curl -s -X POST localhost:8080/v1/events \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"headache","intensity":3,"note":"hafif"}'

# Timeline (daily log + event birlikte)
curl -s "localhost:8080/v1/timeline?limit=10" -H "Authorization: Bearer $TOKEN"
```

Beklenen: tüm endpoint'ler `{"data":...,"error":null}` envelope'ı döndürür. 409 case'i `{"data":null,"error":{"code":"DAILY_LOG_DUPLICATE",...}}` döner.

## 5. Object-Level Authorization Test

```bash
# İkinci kullanıcı oluştur
TOKEN_B=$(curl -s -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"b@neuronot.app","password":"anothersecret"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Kullanıcı A'nın event'lerinden birinin ID'sini al
EVENT_ID=$(curl -s localhost:8080/v1/events -H "Authorization: Bearer $TOKEN" \
  | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Kullanıcı B silmeye çalışsın → 404 (PRD: 403 değil)
curl -s -X DELETE "localhost:8080/v1/events/$EVENT_ID" -H "Authorization: Bearer $TOKEN_B"
# Beklenen: {"data":null,"error":{"code":"RESOURCE_NOT_FOUND",...}}
```

## 6. Mobile Smoke Test

```bash
cd mobile && bun install && bun start
```

Telefonda Expo Go ile yeni hesap aç (örn. `mobile@test.com`):

1. **Register** → tamam → otomatik onboarding'e yönlendir
2. **Onboarding**:
   - Step 1: bir focus problem seç (örn. "Odaklanma")
   - Step 2: intensity 1-5 seç
   - Step 3: ortalama uyku saati gir, kafein toggle
   - "Başla"ya bas → home'a gider
3. **Home**: "Bugünün kaydını ekle" kartı görünür
4. Karta dokun → QuickLogSheet açılır → 5 segment scale'i doldur → "Kaydet"
5. Sheet kapanır, kart "Odak X · Enerji Y" özetine döner
6. Sağ alt FAB'a dokun → EventQuickAdd sheet → bir tip seç (kullanıcının onboarding seçimine göre öne çıkmış olmalı), intensity, opsiyonel not → "Kaydet"
7. **Akış** sekmesi → daily log + event birlikte görünür, header "Bugün"
8. Diğer event'ler ve loglar eklendikçe pagination çalışır (en az 25+ kayıtla test et)
9. Aynı gün ikinci log denemesi → "Bugünün kaydını zaten girdin" hatası gösterir (i18n kullanıcının dilinde)

## Çıkış Kriterleri

- [ ] 3 yeni migration uygulandı, tablolar oluştu
- [ ] `/v1/profile` GET (lazy create) ve PATCH çalışıyor
- [ ] `/v1/daily-logs` POST + duplicate 409 çalışıyor
- [ ] `/v1/daily-logs/today` log varsa döner, yoksa null
- [ ] `/v1/events` POST + DELETE + cursor list çalışıyor
- [ ] Object-level auth: B → A'nın resource'ı 404 (not 403)
- [ ] `/v1/timeline` daily log + event sıralı, cursor pagination çalışıyor
- [ ] Mobile onboarding 3 step + profile PATCH
- [ ] Home'da DailyLogCard + QuickLogSheet
- [ ] FAB'dan EventQuickAdd
- [ ] Timeline ekranı infinite scroll, locale-aware date headers
- [ ] Aynı gün ikinci log → i18n error visible

## Bilinen Sınırlar

- Event silme UI'sı yok (Hafta 5 polish)
- Timeline'da event silme jest'i yok (Hafta 5 polish)
- Pull-to-refresh yok (Hafta 5 polish)
