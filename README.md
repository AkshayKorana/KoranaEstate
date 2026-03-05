# coffee-backend monorepo

Active apps:

- Web (Next.js): `korana-estate/web`
- Backend (NestJS): `korana-estate/backend`

The legacy root AI dashboard has been quarantined under `_legacy_ai_dashboard/` and is not part of active runtime.

## Run

```bash
npm run dev:backend
npm run dev:web
```

## Build

```bash
npm --prefix korana-estate/backend run build
npm --prefix korana-estate/web run build
```

## Prices pipeline checks

```bash
curl -sS http://localhost:3000/api/prices/products
curl -sS http://localhost:3000/api/prices/latest
curl -sS "http://localhost:3000/api/prices/history?days=30&productKey=arabica_cherry"
```
