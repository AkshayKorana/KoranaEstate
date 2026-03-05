# Korana Estate Backend (NestJS)

## API Base

- `http://localhost:4000/api/v1`
- Swagger docs: `http://localhost:4000/api/docs`

## Modules

- Auth: `/api/v1/auth`
- Users: `/api/v1/users`
- Marketplace: `/api/v1/marketplace`
- Store: `/api/v1/store`
- Orders: `/api/v1/orders`
- Chat: `/api/v1/chat`
- Market Intelligence: `/api/v1/market-intelligence`
- Subscriptions: `/api/v1/subscriptions`
- Payments: `/api/v1/payments`
- Admin: `/api/v1/admin`
- Prices: `/api/v1/prices`
- Jobs (prices): `/api/v1/jobs/prices`

## Auth Tokens

- Access token: 15 minutes (`ACCESS_JWT_SECRET`)
- Refresh token: 30 days (`REFRESH_JWT_SECRET`)
- Refresh endpoint: `POST /api/v1/auth/refresh`
- Logout endpoint: `POST /api/v1/auth/logout`

## Monetization

- Global commission rate (admin): `PATCH /api/v1/orders/commission-rate`
- Order stores: `commissionRate`, `platformFee`, `sellerPayout`
- PRO-only advanced intelligence: `GET /api/v1/market-intelligence/:commodityName/advanced`
- Payment webhook: `POST /api/v1/payments/webhook`
- Admin metrics: `GET /api/v1/admin/metrics`
- Admin payout release: `PATCH /api/v1/admin/payouts/:payoutId/release`
- Admin payout hold: `PATCH /api/v1/admin/payouts/:payoutId/hold`
- Raise dispute: `POST /api/v1/orders/:orderId/dispute`
- Admin disputes list: `GET /api/v1/admin/disputes`
- Admin dispute resolve: `PATCH /api/v1/admin/disputes/:id/resolve`
- Buyer confirm order: `PATCH /api/v1/orders/:orderId/confirm`
- Order review: `POST /api/v1/orders/:orderId/review`
- User reputation: `GET /api/v1/users/:id/reputation`
- Admin user verify: `PATCH /api/v1/admin/users/:id/verify`

## Production Rules

- Frontends call backend only.
- Backend owns Prisma + Supabase access.
- No Supabase service role key exposed to clients.

## Daily Price Pipeline (Config-Driven + Python Playwright)

### Endpoints

- `GET /api/v1/prices/products` -> enabled products from config table
- `GET /api/v1/prices/latest` -> latest run + per-product latest values
- `GET /api/v1/prices/history?days=30&productKey=arabica_cherry` -> historical points
- `POST /api/v1/prices/ingest` -> ingest one run payload (requires `CRON_SECRET`)
- `POST /api/v1/jobs/prices/run` -> trigger python playwright run (requires `CRON_SECRET`)

All price endpoints send `Cache-Control: no-store`.

### Ingest Contract

```json
{
  "runAt": "2026-03-05T06:30:00.000Z",
  "results": [
    {
      "productKey": "arabica_cherry",
      "value": 345.25,
      "unit": "INR/kg",
      "source": "Stub Deterministic Generator",
      "sourceUrl": "https://example.com/prices/arabica-cherry",
      "confidence": 0.88,
      "rawText": "Arabica Cherry 345.25 INR/kg"
    }
  ],
  "errors": [
    {
      "productKey": "robusta_parchment",
      "error": "Timeout",
      "sourceUrl": "https://example.com/prices/robusta-parchment"
    }
  ]
}
```

### Python scraper setup

```bash
cd python/prices_scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

Required env vars:

```bash
CRON_SECRET=...
PRICES_SCRAPER_ENABLED=true
PRICES_PYTHON_BIN=python3
PRICES_SCRAPER_SCRIPT=korana-estate/backend/python/prices_scraper/scraper.py
PRICES_SCRAPER_TIMEOUT_MS=120000
PRICES_SCRAPER_RETRIES=2
```

### Seed Initial Products (6)

```bash
npx tsx scripts/seed-price-products.ts
```

### Manual Daily Run

```bash
curl -X POST http://localhost:4000/api/v1/jobs/prices/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Manual Dry Run (no DB writes)

```bash
curl -X POST "http://localhost:4000/api/v1/jobs/prices/run?dryRun=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Cron Example (9:00 AM Asia/Kolkata)

```cron
30 3 * * * curl -sS -X POST https://your-backend-domain/api/v1/jobs/prices/run -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Setup

1. Copy `.env.example` to `.env`
2. Set Supabase Postgres `DATABASE_URL`
3. Run:

```bash
npm install
npm run prisma:generate -w backend
npm run prisma:migrate -w backend
npm run dev:backend
```

## Realtime

Use Supabase Realtime in backend for fanout to clients via backend-managed channels or websocket gateway.
