#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
from pathlib import Path


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    service_run = script_dir.parent.parent / "services" / "price-collector" / "run.sh"
    env = {**os.environ, "PRICES_SCRAPER_ENTRY": "scrape_prices_google_ai.py"}
    completed = subprocess.run(["bash", str(service_run), "scrape_prices_google_ai.py"], env=env)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
