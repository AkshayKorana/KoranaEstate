#!/usr/bin/env python3
"""Playwright-based commodity price scraper.

Input JSON (stdin or --input file):
{
  "runAt": "ISO string",
  "products": [
    {
      "productKey": "arabica_cherry",
      "displayName": "Arabica Cherry",
      "unit": "INR/kg",
      "source": "...",
      "sourceUrl": "https://..."
    }
  ]
}

Output JSON (stdout):
{
  "runAt": "ISO string",
  "observations": [
    {
      "productKey": "arabica_cherry",
      "price": 345.2,
      "unit": "INR/kg",
      "source": "...",
      "sourceUrl": "...",
      "observedAt": "ISO string",
      "rawText": "..."
    }
  ],
  "errors": [
    {
      "productKey": "robusta_parchment",
      "error": "...",
      "sourceUrl": "..."
    }
  ]
}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

PRICE_PATTERN = re.compile(r"(?:₹|Rs\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?)", re.IGNORECASE)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_input(input_path: str) -> Dict[str, Any]:
    if input_path == "-":
        raw = sys.stdin.read()
    else:
        with open(input_path, "r", encoding="utf-8") as handle:
            raw = handle.read()

    if not raw.strip():
        return {"runAt": iso_now(), "products": []}

    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Input JSON must be an object")
    return data


def normalize_price(raw_text: str) -> Optional[float]:
    for match in PRICE_PATTERN.finditer(raw_text):
        value = match.group(1).replace(",", "")
        try:
            parsed = float(value)
        except ValueError:
            continue
        if parsed > 0:
            return round(parsed, 2)
    return None


def fallback_source(source: str, source_url: str) -> str:
    if source:
        return source
    if source_url:
        parsed = urlparse(source_url)
        if parsed.netloc:
            return f"Playwright Scraper ({parsed.netloc})"
    return "Playwright Scraper"


def scrape_product(page, product: Dict[str, Any], timeout_ms: int) -> Dict[str, Any]:
    product_key = str(product.get("productKey", "")).strip()
    source_url = str(product.get("sourceUrl", "")).strip()

    if not product_key:
        raise ValueError("Missing productKey")
    if not source_url:
        raise ValueError(f"Missing sourceUrl for {product_key}")

    page.goto(source_url, wait_until="domcontentloaded", timeout=timeout_ms)
    body_text = page.locator("body").inner_text(timeout=timeout_ms)
    body_text = " ".join(body_text.split())

    price = normalize_price(body_text)
    if price is None:
        raise ValueError(f"Could not parse price for {product_key}")

    return {
        "productKey": product_key,
        "price": price,
        "unit": str(product.get("unit") or "INR/kg"),
        "source": fallback_source(str(product.get("source") or ""), source_url),
        "sourceUrl": source_url,
        "observedAt": iso_now(),
        "rawText": body_text[:500],
    }


def scrape_with_retry(page, product: Dict[str, Any], timeout_ms: int, retries: int) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            return scrape_product(page, product, timeout_ms)
        except Exception as exc:  # noqa: BLE001 - keep scraper resilient
            last_error = exc
            if attempt < retries:
                backoff = 1.0 * (2**attempt)
                print(
                    f"[scraper] retry product={product.get('productKey')} attempt={attempt + 1} backoff={backoff}s reason={exc}",
                    file=sys.stderr,
                )
                time.sleep(backoff)

    raise RuntimeError(str(last_error) if last_error else "Unknown scrape error")


def run_scraper(products: List[Dict[str, Any]], headless: bool, timeout_ms: int, retries: int) -> Dict[str, Any]:
    observations: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=headless)
        context = browser.new_context()
        page = context.new_page()

        for product in products:
            product_key = str(product.get("productKey", "")).strip() or "unknown"
            source_url = str(product.get("sourceUrl", "")).strip()
            try:
                result = scrape_with_retry(page, product, timeout_ms=timeout_ms, retries=retries)
                observations.append(result)
                print(
                    f"[scraper] ok product={product_key} price={result['price']} unit={result['unit']}",
                    file=sys.stderr,
                )
            except (PlaywrightTimeoutError, Exception) as exc:  # noqa: BLE001
                errors.append(
                    {
                        "productKey": product_key,
                        "error": str(exc),
                        "sourceUrl": source_url,
                    }
                )
                print(f"[scraper] failed product={product_key} reason={exc}", file=sys.stderr)

        context.close()
        browser.close()

    return {
        "runAt": iso_now(),
        "observations": observations,
        "errors": errors,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="KoranaEstate Playwright commodity scraper")
    parser.add_argument("--input", default="-", help="Input JSON file path (or '-' for stdin)")
    parser.add_argument("--timeout-ms", type=int, default=30000, help="Per-page timeout in milliseconds")
    parser.add_argument("--retries", type=int, default=2, help="Per-product retries")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode for debugging")
    parser.add_argument("--dry-run", action="store_true", help="No-op flag for compatibility; always outputs JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        input_payload = read_input(args.input)
        products = input_payload.get("products") or []
        if not isinstance(products, list):
            raise ValueError("Input field 'products' must be an array")

        output = run_scraper(
            products=products,
            headless=not args.headed,
            timeout_ms=max(1000, int(args.timeout_ms)),
            retries=max(0, int(args.retries)),
        )

        print(json.dumps(output, ensure_ascii=True))
        return 0
    except Exception as exc:  # noqa: BLE001
        fail_output = {
            "runAt": iso_now(),
            "observations": [],
            "errors": [
                {
                    "productKey": "*",
                    "error": f"SCRAPER_FATAL: {exc}",
                    "sourceUrl": "",
                }
            ],
        }
        print(json.dumps(fail_output, ensure_ascii=True))
        print(f"[scraper] fatal error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
