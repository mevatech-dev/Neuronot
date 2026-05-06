# web/ — Boş

Bu klasör **bilerek boş**. MVP'de web dashboard yok.

## Eklenme Tetiği

- İlk paying customer "web'den de bakabileyim" deyince.
- Admin paneli için ayrı bir yüzey gerekince (kendi alt klasör/repo'su olabilir).
- Marketing landing page'inden ayrı bir authenticated experience gerekince.

## Beklenen Şekil

Next.js 15+ App Router. UI dili mobile ile **token paylaşır** ama component katmanı ayrıdır.

```
web/
├─ app/
├─ components/
├─ lib/
│  └─ api/            # api/ ile aynı endpoint'ler, fetch wrapper
├─ public/
└─ package.json
```

`packages/theme-tokens` monorepo paketine `mobile/src/theme/tokens.ts` çıkarıldığında ikisi de aynı palette'i kullanır. Semantic mapping ayrı (mobile RN style, web CSS).

## Şimdiki Aksiyon

Yok. Tetik gerçekleşene kadar boş kalır.
