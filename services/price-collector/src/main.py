from __future__ import annotations

import json
import os
import sys

from collectors.bing import build_failed_output as build_bing_failed_output
from collectors.bing import run as run_bing
from collectors.google_ai import build_failed_output as build_google_failed_output
from collectors.google_ai import run as run_google_ai

COLLECTOR_ALIASES = {
    "main.py": "bing",
    "scrape_prices.py": "bing",
    "bing": "bing",
    "bing.py": "bing",
    "scrape_prices_google_ai.py": "google-ai",
    "google-ai": "google-ai",
    "google_ai": "google-ai",
}


def resolve_target() -> str:
    requested = sys.argv[1] if len(sys.argv) > 1 else os.getenv("PRICES_SCRAPER_ENTRY", "scrape_prices.py")
    return COLLECTOR_ALIASES.get(requested, COLLECTOR_ALIASES.get(os.path.basename(requested), "bing"))


def main() -> int:
    target = resolve_target()
    try:
        payload = run_google_ai() if target == "google-ai" else run_bing()
    except Exception as error:
        payload = build_google_failed_output(str(error)) if target == "google-ai" else build_bing_failed_output(str(error))

    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
