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

## COD Order Notifications

### Overview

When a COD (Cash on Delivery) order is successfully created, the system triggers non-blocking notifications:

1. **Email**: Admin notification via SMTP (Gmail or custom)
2. **Google Sheets**: Automatic CRM logging to Google Sheets

Both notifications are **completely optional** and **non-blocking**. If either fails, the order still succeeds.

### Email Notification

#### Configuration

Add to `.env`:

```bash
# SMTP Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@example.com
```

**Gmail Setup:**

1. Enable 2-factor authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an app-specific password
4. Use that as `EMAIL_PASS` (16 characters, no spaces)

**Self-hosted SMTP:**

Replace `EMAIL_HOST` and `EMAIL_PORT` with your SMTP server details.

**Default behavior:**

- If `EMAIL_HOST` is not set, defaults to `smtp.gmail.com` on port 587
- If any credential is missing, email notifications are skipped (logged as warning)

#### What gets sent

Email includes:

```
Order ID
Product / Listing ID
Quantity
Customer Name
Phone Number
Full Address (City, State, Pincode)
Order Notes (if any)
```

Subject: `🛒 New COD Order Received - <Order ID>`

### Google Sheets Logging

#### Configuration

Add to `.env`:

```bash
GOOGLE_SHEETS_ID=your-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**Setup (one-time):**

1. Create a Google Cloud project
2. Create a service account
3. Generate a JSON key
4. Share the Google Sheet with the service account email (Editor role)
5. Extract `GOOGLE_SHEETS_ID` from the sheet URL
6. Copy `client_email` and `private_key` from the JSON key to `.env`

**Note:** Newlines in the private key should be represented as `\n` in the `.env` file. The system automatically converts them at runtime.

**Default behavior:**

- If any credential is missing, sheet logging is skipped (logged as warning)
- Failures never block order creation

#### Sheet Columns

The system appends rows with columns in this order:

1. **Timestamp** - ISO 8601 format
2. **Order ID**
3. **Product / Listing ID**
4. **Quantity** (units or kg)
5. **Customer Name**
6. **Phone**
7. **Full Address**
8. **City**
9. **State**
10. **Pincode**
11. **Order Note**

### Debugging

All notification events are logged to stdout with the prefix `[Notification]`:

```
[Notification] Triggered for orderId=12345
[Notification] Sending email for orderId=12345 to admin@example.com
[Notification] Email sent successfully for orderId=12345
[Notification] Appending to Google Sheets for orderId=12345
[Notification] Google Sheets updated successfully for orderId=12345
```

**Error logs:**

```
[Notification] EMAIL_PASS not configured. Skipping email for orderId=12345
[Notification] Email failed for orderId=12345: <error message>
[Notification] Google Sheets update failed for orderId=12345: <error message>
```

### Testing

#### Without configuration

Place an order with no email/sheets env vars → Order succeeds, notifications skipped (warnings logged)

#### With email only

Place an order → Email received, sheet skipped (warning logged)

#### With both

Place an order → Email + sheet updated instantly

#### Failure mode

Break email config intentionally → Order succeeds, email fails (error logged), sheet still appends

### Non-blocking Guarantee

The notification layer uses `Promise.allSettled()`:

```javascript
void this.notificationService.notifyOrderCreated(order)
```

This means:

- Notifications run in the background
- Order returns to user immediately
- Failures never block the main flow
- Both email and sheets are attempted simultaneously

