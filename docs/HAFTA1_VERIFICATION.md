# Hafta 1 Verification Runbook

Hafta 1 iskeleti tamamlandı. Bu doküman yerel makinede uçtan uca çalışmasını doğrulamak için adımları içerir.

## Ön Koşullar

```bash
# Sadece ilk kez:
brew install go bun docker
go install github.com/pressly/goose/v3/cmd/goose@latest
bun add -g expo

# Docker Desktop'ı başlat (Apps → Docker)
```

## 1. Postgres'i Ayağa Kaldır

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
make db-up
```

Docker Compose `postgres:18-alpine` indirir, `neuronot_pg_data` volume'ı yaratır, port 5432'de listen eder.

```bash
docker ps | grep neuronot_postgres   # healthy görünmeli
```

## 2. Go Bağımlılıklarını Çek

```bash
cd api
go mod tidy
```

`go.sum` üretilir. Hata yoksa devam.

## 3. .env Hazırla

```bash
cd api
cp .env.example .env
# JWT_SECRET için: openssl rand -hex 32 → çıktıyı .env'e yapıştır
```

## 4. Migrations Çalıştır

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot
export $(cat api/.env | xargs)
make db-migrate
```

Beklenen çıktı: `OK 00001_users.sql` ve `OK 00002_refresh_tokens.sql`.

## 5. API'yi Başlat

```bash
make api-dev
```

Beklenen log (JSON):
```json
{"time":"...","level":"INFO","msg":"api starting","port":"8080"}
```

## 6. Health Check

Yeni bir terminalde:

```bash
curl localhost:8080/health
```

Beklenen:
```json
{"data":{"status":"ok"},"error":null}
```

## 7. Auth Smoke Test

```bash
# Register
curl -X POST localhost:8080/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123","preferred_language":"tr"}'

# Beklenen: 201 Created, access_token + refresh_token

# Login
curl -X POST localhost:8080/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@neuronot.app","password":"changeme123"}'

# Beklenen: 200 OK, taze token'lar
```

## 8. Mobile Bağımlılıkları

```bash
cd /Users/mustafamac/Documents/Projelerim/neuronot/mobile
bun install
```

İlk kurulum 1-2 dk sürebilir.

## 9. Mobile Dev Server

```bash
bun start
```

Expo Metro bundler açılır. iPhone'da Expo Go uygulamasıyla QR kodu tara.

> **Not:** API `localhost:8080`'da. iPhone fiziksel cihaz ise `app.json` içindeki `extra.apiBaseUrl`'i bilgisayarın LAN IP'sine güncelle (örn. `http://192.168.1.42:8080`).

## 10. Smoke Test (Mobile)

Telefonda:

1. App açılır → login ekranı görünür (theme dark default)
2. "Hesap oluştur"a bas → register ekranı
3. Email + şifre (8+ karakter) gir → "Hesap oluştur"
4. Tab'lar görünür: Anasayfa, Akış, İçgörü, Ayarlar
5. **Ayarlar** sekmesi → Theme'i "Açık"a çevir → arka plan açık olur
6. **Ayarlar** → Dil "English"e çevir → tüm metinler İngilizce olur
7. **Ayarlar** → "Çıkış yap" → login ekranına döner
8. App'i kapat-aç → hala login ekranında (token silindi)
9. Login → token persist eder, app reload sonrası ana sekmeye düşer

## Çıkış Kriterleri

- [ ] `make db-up` postgres healthy
- [ ] `make api-dev` 8080'de listen ediyor
- [ ] `/health` 200 OK
- [ ] `/v1/auth/register` 201 + tokens
- [ ] `/v1/auth/login` 200 + tokens
- [ ] Expo dev server açılıyor
- [ ] iOS/Android'de register → login → home akışı
- [ ] Theme toggle dark ↔ light çalışıyor
- [ ] Language toggle en ↔ tr çalışıyor
- [ ] Logout → token silinir, login ekranı

## Yaygın Sorunlar

**`go.sum` mismatch:** `cd api && go clean -modcache && go mod tidy`

**Postgres connect refused:** Docker Desktop açık mı? `docker ps` boşsa `docker compose up -d`.

**Expo Metro hata:** `cd mobile && rm -rf node_modules .expo && bun install`

**iPhone API'ye bağlanamıyor:** `app.json` içindeki `apiBaseUrl`'i LAN IP yap, `expo start --clear` ile cache temizle.

**`expo-secure-store` simulator hata:** Simulator'da SecureStore bazen ilk run'da fail eder, app'i restart et.

---

Bu runbook tamamlandıktan sonra Hafta 2'ye geçilebilir (onboarding + daily-log + events + timeline).
