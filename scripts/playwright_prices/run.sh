#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd "$SCRIPT_DIR/../../services/price-collector" && pwd)"
ENTRYPOINT="${1:-${PRICES_SCRAPER_ENTRY:-scrape_prices.py}}"

exec "$SERVICE_DIR/run.sh" "$ENTRYPOINT"
