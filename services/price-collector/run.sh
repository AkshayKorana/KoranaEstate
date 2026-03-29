#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEGACY_DIR="$SCRIPT_DIR/../../scripts/playwright_prices"
PLAYWRIGHT_BROWSERS_DIR="$SCRIPT_DIR/.playwright-browsers"

find_venv_dir() {
  for candidate in "$SCRIPT_DIR/.venv" "$LEGACY_DIR/.venv"; do
    if [ -x "$candidate/bin/python" ] && "$candidate/bin/python" -c "import playwright" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

if ! VENV_DIR="$(find_venv_dir)"; then
  echo "Compatible virtual environment not found. Run services/price-collector/setup.sh first." >&2
  exit 1
fi

ENTRYPOINT="${1:-${PRICES_SCRAPER_ENTRY:-scrape_prices.py}}"

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$PLAYWRIGHT_BROWSERS_DIR}"

exec "$VENV_DIR/bin/python" "$SCRIPT_DIR/src/main.py" "$ENTRYPOINT"
