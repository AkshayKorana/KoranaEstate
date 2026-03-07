# Price Collector Service

`services/price-collector` is the dedicated price acquisition service for the monorepo. It owns source-specific scraping, parsing, and normalization, and emits JSON that the backend ingests through the existing prices pipeline.

## Responsibilities

- Collect raw price data from external sources
- Parse and normalize observations into a backend-ingest compatible JSON contract
- Stay runnable independently from the backend
- Keep source-specific scraping logic out of `apps/backend`

## Layout

```text
services/price-collector/
├── src/
│   ├── collectors/
│   │   ├── bing.py
│   │   ├── google_ai.py
│   │   └── __init__.py
│   ├── parsers/
│   │   ├── prices.py
│   │   └── __init__.py
│   ├── config.py
│   ├── main.py
│   ├── models.py
│   └── __init__.py
├── requirements.txt
├── run.sh
└── setup.sh
```

## Setup

```bash
cd services/price-collector
./setup.sh
```

## Run Manually

Default Bing collector:

```bash
cd services/price-collector
./run.sh | jq
```

Google AI collector:

```bash
cd services/price-collector
./run.sh scrape_prices_google_ai.py | jq
```

## Output Contract

The service emits JSON only. Each item is normalized like:

```json
{
  "productKey": "arabica_cherry",
  "value": 520,
  "unit": "INR/kg",
  "status": "OK",
  "reason": "MATCHED",
  "source": "bing",
  "sourceUrl": "https://www.bing.com/search",
  "rawText": "per kg ₹520 | ...",
  "confidence": 0.58,
  "capturedAt": "2026-03-07T12:00:00+00:00",
  "error": null
}
```

The payload also keeps the legacy `meta` object on each item so the current backend ingest path remains compatible during the transition.

## Backend Interaction

- `apps/backend` remains the source of read APIs and ingest logic
- `apps/backend/src/jobs/jobs.service.ts` shells out to this service runner
- legacy `scripts/playwright_prices/run.sh` and `setup.sh` remain as compatibility wrappers

## Adding New Sources

1. Add a new source module under `src/collectors/`
2. Reuse shared parsing helpers from `src/parsers/prices.py`
3. Register the source alias in `src/main.py`
4. Keep the emitted JSON aligned with the normalized item shape above
