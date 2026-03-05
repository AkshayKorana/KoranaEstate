#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Virtual environment not found at $VENV_DIR. Run ./setup.sh first." >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

SCRAPER_FILE="${1:-${PRICES_SCRAPER_ENTRY:-scrape_prices.py}}"
SCRAPER_PATH="$SCRIPT_DIR/$SCRAPER_FILE"

if [ ! -f "$SCRAPER_PATH" ]; then
  echo "Scraper script not found: $SCRAPER_PATH" >&2
  exit 1
fi

python "$SCRAPER_PATH"
