# ADR 0001: Modular Monolith over Microservices

**Status:** Accepted
**Date:** 2026-05-06

## Context

Neuronot 5 hafta içinde TestFlight'a giden bir MVP. Tek developer, tek dağıtım hedefi (iOS önce). Backend kararı: tek binary mi (modular monolith), birden çok binary mi (microservices/SOA)?

## Decision

**Modular monolith.** Tek `api/` binary, içinde domain'ler için vertical slice klasörleri (`auth`, `dailylog`, `events`, `insights`). Worker, web, admin için klasörler hazır ama içleri boş — eklenme sinyali çıkana kadar yazılmaz.

## Consequences

**Pozitif:**
- Tek deploy, tek log stream, tek DB connection pool. Operasyon kolay.
- Vertical slice + three-layer pattern domain sınırlarını korur — ayırma kararı sonra rahat verilir.
- 5 hafta dar takvimde overhead yok.

**Negatif:**
- Domain'ler arası "yanlışlıkla import" riski var (örn. `dailylog` → `auth` repository). Lint kuralı veya code review ile yakalanır.
- Yatay scale tek binary için sınırlı. 100 kullanıcıda problem değil; 10000 kullanıcıda konuşulur.

## Alternatives Considered

- **Microservices:** Reddedildi. 5 haftada deploy/network/observability overhead'i ürünü öldürür.
- **Onion architecture (full):** Reddedildi. 5 endpoint için DI container, repository interface, use case katmanı overkill. Three-layer yeterli.
- **CQRS:** Reddedildi. Read/write ayrımı henüz gerek değil.

## Triggers for Revisit

- API binary build süresi 60sn'yi geçince.
- Bir domain'in deploy cycle'ı bağımsız olmak zorunda kalınca (örn. AI worker batch job'ları için).
- Yatay scale gerekince (>1000 concurrent user).

Bu sinyallerden biri çıkmadan, monolith bozulmaz.
