#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PLAYWRIGHT_BROWSERS_DIR="$SCRIPT_DIR/.playwright-browsers"

echo ">>> Python setup starting in: $SCRIPT_DIR"

echo ">>> Checking python3 availability"
python3 --version

if [ ! -x ".venv/bin/python" ]; then
  echo ">>> Creating fresh virtual environment"
  rm -rf .venv
  python3 -m venv .venv
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "ERROR: virtual environment creation failed"
  exit 1
fi

echo ">>> Using Python: $(pwd)/.venv/bin/python"

. .venv/bin/activate

echo ">>> Upgrading pip, setuptools, and wheel"
python -m pip install --upgrade pip setuptools wheel

if [ ! -f "requirements.txt" ]; then
  echo "ERROR: requirements.txt not found in $SCRIPT_DIR"
  exit 1
fi

echo ">>> Installing Python dependencies from requirements.txt"
pip install -r requirements.txt

export PLAYWRIGHT_BROWSERS_PATH="$PLAYWRIGHT_BROWSERS_DIR"
echo ">>> Using Playwright browser path: $PLAYWRIGHT_BROWSERS_PATH"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

echo ">>> Installing Playwright Chromium and Firefox browsers"
python -m playwright install chromium firefox

echo ">>> Verifying Playwright browser installs"
CHROMIUM_EXECUTABLE="$(
  find "$PLAYWRIGHT_BROWSERS_PATH" -type f \( -path '*/chrome-linux/chrome' -o -path '*/chrome-linux64/chrome' -o -path '*/chrome.exe' \) | head -n 1
)"
FIREFOX_EXECUTABLE="$(
  find "$PLAYWRIGHT_BROWSERS_PATH" -type f \( -path '*/firefox/firefox' -o -path '*/firefox.exe' \) | head -n 1
)"

if [ -z "$CHROMIUM_EXECUTABLE" ]; then
  echo "ERROR: Chromium browser executable was not found under $PLAYWRIGHT_BROWSERS_PATH"
  exit 1
fi

if [ -z "$FIREFOX_EXECUTABLE" ]; then
  echo "ERROR: Firefox browser executable was not found under $PLAYWRIGHT_BROWSERS_PATH"
  exit 1
fi

echo ">>> Chromium executable found at: $CHROMIUM_EXECUTABLE"
echo ">>> Firefox executable found at: $FIREFOX_EXECUTABLE"

echo ">>> Python setup completed successfully"
