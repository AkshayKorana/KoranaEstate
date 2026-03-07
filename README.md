# coffee-backend monorepo

Active apps:

- Web (Next.js): `apps/web`
- Backend (NestJS): `apps/backend`
- Services: `services/price-collector`

The legacy root AI dashboard has been quarantined under `_legacy_ai_dashboard/` and is not part of active runtime.

## Architecture

- `apps/backend` owns business logic, read APIs, ingest APIs, and the manual/dev job trigger
- `services/price-collector` owns price acquisition, parsing, and normalized JSON emission
- `apps/web` continues reading prices through backend/web APIs
- `scripts/playwright_prices` remains as a compatibility wrapper for older workflows

## Run

```bash
npm run dev:backend
npm run dev:web
```

## Build

```bash
npm --prefix apps/backend run build
npm --prefix apps/web run build
```

## Prices pipeline checks

```bash
curl -sS http://localhost:3000/api/prices/products
curl -sS http://localhost:3000/api/prices/latest
curl -sS "http://localhost:3000/api/prices/history?days=30&productKey=arabica_cherry"
```

## Price Collector Service

Setup:

```bash
cd services/price-collector
./setup.sh
```

Run manually:

```bash
cd services/price-collector
./run.sh | jq
```

Legacy wrapper path still works:

```bash
cd scripts/playwright_prices
./run.sh | jq
```
