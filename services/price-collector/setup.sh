#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ">>> Python setup starting in: $SCRIPT_DIR"

# Ensure Python exists
python3 --version

# Recreate venv if missing or broken
if [ ! -x ".venv/bin/python" ]; then
  echo ">>> Creating fresh virtual environment"
  rm -rf .venv
  python3 -m venv .venv
fi

# Validate venv interpreter
if [ ! -x ".venv/bin/python" ]; then
  echo "ERROR: virtual environment creation failed"
  exit 1
fi

echo ">>> Using Python: $(pwd)/.venv/bin/python"

. .venv/bin/activate

python -m pip install --upgrade pip setuptools wheel

if [ -f requirements.txt ]; then
  pip install -r requirements.txt
fi

# Optional: Playwright install if used by scraper
if grep -qi "playwright" requirements.txt 2>/dev/null; then
  python -m playwright install chromium || true
fi

echo ">>> Python setup completed successfully"
