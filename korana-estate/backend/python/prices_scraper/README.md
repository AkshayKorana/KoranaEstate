# Python Prices Scraper (Playwright Chromium)

This scraper runs headless Chromium and outputs structured JSON for backend ingestion.

## 1) Create venv and install deps

```bash
cd korana-estate/backend/python/prices_scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
```

## 2) Run dry-run with sample input

```bash
cat <<'JSON' | python scraper.py --input - --dry-run
{
  "products": [
    {
      "productKey": "arabica_cherry",
      "displayName": "Arabica Cherry",
      "unit": "INR/kg",
      "source": "Playwright Scraper",
      "sourceUrl": "https://example.com"
    }
  ]
}
JSON
```

## Output contract

```json
{
  "runAt": "ISO string",
  "observations": [
    {
      "productKey": "string",
      "price": 123.45,
      "unit": "INR/kg",
      "source": "string",
      "sourceUrl": "string",
      "observedAt": "ISO string",
      "rawText": "string"
    }
  ],
  "errors": [
    {
      "productKey": "string",
      "error": "string",
      "sourceUrl": "string"
    }
  ]
}
```

Notes:
- Default mode is headless Chromium.
- Use `--headed` only for local debugging.
- Script is OS-safe for macOS/Linux and requires no admin permissions.
