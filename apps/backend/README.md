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

## Daily Prices Pipeline

### Endpoints

- `GET /api/v1/prices/products`
- `GET /api/v1/prices/latest`
- `GET /api/v1/prices/history?days=30&productKey=arabica_cherry`
- `POST /api/v1/prices/ingest`
- `POST /api/v1/jobs/prices/run`

All prices endpoints return `Cache-Control: no-store`.

### Python Playwright Scraper

Script path:
- `scripts/playwright_prices/scrape_prices.py`
- Wrapper path:
- `scripts/playwright_prices/run.sh`

Requirements file:
- `scripts/playwright_prices/requirements.txt`

Setup scraper once (idempotent):

```bash
cd scripts/playwright_prices
./setup.sh
```

Run scraper manually (prints JSON to stdout):

```bash
cd scripts/playwright_prices
./run.sh | jq
```

The scraper writes debug text files to:
- `apps/backend/.artifacts/prices/`

### Required / Optional env vars

```bash
CRON_SECRET=replace_with_long_random_secret
PRICES_SCRAPER_ENABLED=true
PRICES_SCRAPER_RUNNER=scripts/playwright_prices/run.sh
PRICES_SCRAPER_ENTRY=scrape_prices.py
PRICES_SCRAPER_TIMEOUT_MS=120000
PRICES_SCRAPER_RETRIES=2
BROWSER_CHANNEL=
```

Notes:
- Default browser mode: Chromium headless.
- Optional desktop debugging mode:
  - set `BROWSER_CHANNEL=msedge`
  - scraper will try Edge channel with `headless=false` on supported platforms.

### Run ingestion job manually

```bash
curl -sS -X POST http://localhost:4000/api/v1/jobs/prices/run \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Or with header fallback:

```bash
curl -sS -X POST http://localhost:4000/api/v1/jobs/prices/run \
  -H "X-Cron-Secret: $CRON_SECRET" | jq
```

### One Command Runbook

```bash
cd scripts/playwright_prices && ./setup.sh
cd scripts/playwright_prices && ./run.sh | jq
npm --prefix apps/backend run dev
curl -sS http://localhost:4000/api/v1/prices/products | jq
curl -sS http://localhost:4000/api/v1/prices/latest | jq
curl -sS -X POST http://localhost:4000/api/v1/jobs/prices/run -H "Authorization: Bearer $CRON_SECRET" | jq
```

### Scheduling at 9:00 AM Asia/Kolkata

Linux cron (server timezone must be IST or converted):

```cron
30 3 * * * curl -sS -X POST https://your-backend-domain/api/v1/jobs/prices/run -H "Authorization: Bearer YOUR_CRON_SECRET"
```

macOS launchd example (`~/Library/LaunchAgents/com.korana.prices.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.korana.prices</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/curl</string>
      <string>-sS</string>
      <string>-X</string>
      <string>POST</string>
      <string>https://your-backend-domain/api/v1/jobs/prices/run</string>
      <string>-H</string>
      <string>Authorization: Bearer YOUR_CRON_SECRET</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key><integer>9</integer>
      <key>Minute</key><integer>0</integer>
    </dict>
    <key>StandardOutPath</key><string>/tmp/korana-prices.out</string>
    <key>StandardErrorPath</key><string>/tmp/korana-prices.err</string>
  </dict>
</plist>
```

Load it:

```bash
launchctl load ~/Library/LaunchAgents/com.korana.prices.plist
```

## Setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Run:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
