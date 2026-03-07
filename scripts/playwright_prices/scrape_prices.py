"""
Bing price scraper with bounded per-product runtime.

- Emits JSON only to stdout.
- Logs only to stderr.
- Returns partial results instead of hanging.
"""

import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

PRODUCTS = [
    ("arabica_cherry", "Arabica Cherry"),
    ("arabica_parchment", "Arabica Parchment"),
    ("robusta_cherry", "Robusta Cherry"),
    ("robusta_parchment", "Robusta Parchment"),
    ("arabica_greenbean", "Arabica Green Bean"),
    ("robusta_greenbean", "Robusta Green Bean"),
]

UNIT = "INR/kg"
MAX_RETRIES_PER_PRODUCT = int(os.getenv("MAX_RETRIES_PER_PRODUCT", "0"))
NAV_TIMEOUT_MS = int(os.getenv("NAV_TIMEOUT_MS", "12000"))
RESULTS_TIMEOUT_MS = int(os.getenv("RESULTS_TIMEOUT_MS", "6000"))
PRODUCT_TIMEOUT_MS = int(os.getenv("PRODUCT_TIMEOUT_MS", "15000"))
DELAY_BETWEEN_PRODUCTS_MIN = float(os.getenv("DELAY_BETWEEN_PRODUCTS_MIN", "0.2"))
DELAY_BETWEEN_PRODUCTS_MAX = float(os.getenv("DELAY_BETWEEN_PRODUCTS_MAX", "0.6"))
DELAY_BETWEEN_RETRIES_MIN = float(os.getenv("DELAY_BETWEEN_RETRIES_MIN", "0.4"))
DELAY_BETWEEN_RETRIES_MAX = float(os.getenv("DELAY_BETWEEN_RETRIES_MAX", "1.0"))
SCRAPER_HEADLESS = os.getenv("SCRAPER_HEADLESS", "true").strip().lower() not in ("false", "0", "no")

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_query(name: str) -> str:
    return f"{name} price today per kg Kodagu Karnataka"


def looks_blocked(text: str) -> bool:
    t = (text or "").lower()
    markers = [
        "unusual traffic",
        "verify you are a human",
        "captcha",
        "blocked",
        "access denied",
        "our systems have detected",
        "one last step",
        "please solve the challenge below to continue",
    ]
    return any(marker in t for marker in markers)


def extract_inr_per_kg(text: str) -> Tuple[Optional[float], Optional[str]]:
    patterns = [
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*(?:kg|KG|kilogram)",
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*per\s*(?:kg|kilogram)",
        r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG",
        r"₹\s*([\d,]+)\s*(?:to|-)\s*₹\s*([\d,]+)\s*per\s*50\s*kg",
        r"Rs\.?\s*([\d,]+)\s*(?:to|-)\s*Rs\.?\s*([\d,]+)\s*per\s*50\s*kg",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue

        if match.lastindex == 2:
            low = float(match.group(1).replace(",", ""))
            high = float(match.group(2).replace(",", ""))
            return round(((low + high) / 2.0) / 50.0, 2), f"range 50kg ₹{low}-{high}"

        value = float(match.group(1).replace(",", ""))
        if value > 1000:
            return round(value / 50.0, 2), f"50kg bag ₹{value}"
        return round(value, 2), f"per kg ₹{value}"

    return None, None


def make_item(
    product_key: str,
    value: Optional[float],
    *,
    status: str,
    reason: str,
    raw_text: Optional[str] = None,
    confidence: Optional[float] = None,
    error: Optional[str] = None,
    source_url: str = "",
) -> dict:
    return {
        "productKey": product_key,
        "value": value,
        "unit": UNIT,
        "meta": {
            "query": raw_text[:240] if raw_text else None,
            "confidence": confidence,
            "reason": reason,
            "sourceUrl": source_url,
        },
        "rawText": raw_text[:1500] if raw_text else None,
        "confidence": confidence,
        "status": status,
        "reason": reason,
        "error": error,
    }


def make_failed_output(message: str) -> dict:
    return {
        "source": "Bing (Playwright)",
        "fetchedAt": now_iso(),
        "items": [
            make_item(
                product_key,
                None,
                status="FAILED",
                reason="SCRAPER_ERROR",
                error=message,
            )
            for product_key, _name in PRODUCTS
        ],
        "errors": [
            {
                "productKey": product_key,
                "error": message,
                "sourceUrl": "",
            }
            for product_key, _name in PRODUCTS
        ],
    }


def new_context(browser):
    context = browser.new_context(
        viewport={"width": 1280, "height": 720},
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        user_agent=random.choice(USER_AGENTS),
    )
    page = context.new_page()
    page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
    page.set_default_timeout(max(RESULTS_TIMEOUT_MS, 3000))
    page.set_default_navigation_timeout(max(NAV_TIMEOUT_MS, 3000))
    return context, page


def try_accept_banners(page) -> None:
    for selector in [
        'button:has-text("Accept")',
        'button:has-text("I agree")',
        'button:has-text("Agree")',
        'button:has-text("OK")',
    ]:
        try:
            button = page.locator(selector).first
            if button.count() > 0:
                button.click(timeout=900)
                page.wait_for_timeout(150)
                return
        except Exception:
            continue


def fetch_bing_text(page, query: str) -> Tuple[Optional[str], str]:
    url = "https://www.bing.com/search?q=" + re.sub(r"\s+", "+", query.strip())
    page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    try_accept_banners(page)
    page.wait_for_timeout(250)

    body_text = (page.locator("body").inner_text(timeout=1500) or "")[:4000]
    if looks_blocked(body_text):
        return None, body_text

    try:
        page.wait_for_selector("#b_results li.b_algo, #b_context, #b_ans", state="attached", timeout=RESULTS_TIMEOUT_MS)
    except Exception:
        return None, body_text

    blocks: List[str] = []
    for selector in ["#b_context", "#b_ans"]:
        try:
            text = page.locator(selector).inner_text(timeout=800)
            if text:
                blocks.append(text)
        except Exception:
            continue

    for index in range(3):
        try:
            text = page.locator("#b_results li.b_algo").nth(index).inner_text(timeout=1000)
            if text:
                blocks.append(text)
        except Exception:
            continue

    snippets = "\n\n".join(blocks).strip()
    return (snippets if snippets else None), body_text


def scrape_product(page, product_key: str, name: str) -> dict:
    query = build_query(name)
    started_at = time.monotonic()
    log(f"[BING][headless={SCRAPER_HEADLESS}] {product_key} -> {query}")

    for attempt in range(MAX_RETRIES_PER_PRODUCT + 1):
        elapsed_ms = int((time.monotonic() - started_at) * 1000)
        remaining_ms = PRODUCT_TIMEOUT_MS - elapsed_ms
        if remaining_ms <= 0:
            return make_item(
                product_key,
                None,
                status="FAILED",
                reason="TIMEOUT",
                error=f"Per-product timeout exceeded ({PRODUCT_TIMEOUT_MS}ms).",
            )

        try:
            snippets, debug = fetch_bing_text(page, query)

            if snippets is None:
                reason = "BLOCKED" if looks_blocked(debug) else "NO_DATA"
                error = "Search engine blocked the request." if reason == "BLOCKED" else "No result text detected."
                return make_item(
                    product_key,
                    None,
                    status="FAILED",
                    reason=reason,
                    raw_text=debug,
                    error=error,
                    source_url="https://www.bing.com/search",
                )

            value, note = extract_inr_per_kg(snippets)
            if value is None:
                return make_item(
                    product_key,
                    None,
                    status="FAILED",
                    reason="NO_DATA",
                    raw_text=snippets,
                    error="No INR/kg pattern matched.",
                    source_url="https://www.bing.com/search",
                )

            return make_item(
                product_key,
                value,
                status="OK",
                reason="MATCHED",
                raw_text=f"{note} | {snippets}",
                confidence=0.58,
                source_url="https://www.bing.com/search",
            )
        except PWTimeout as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return make_item(
                    product_key,
                    None,
                    status="FAILED",
                    reason="TIMEOUT",
                    error=str(error),
                    source_url="https://www.bing.com/search",
                )
        except Exception as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return make_item(
                    product_key,
                    None,
                    status="FAILED",
                    reason="ERROR",
                    error=str(error),
                    source_url="https://www.bing.com/search",
                )

        retry_delay = random.uniform(DELAY_BETWEEN_RETRIES_MIN, DELAY_BETWEEN_RETRIES_MAX)
        log(f"Retrying {product_key} after {retry_delay:.1f}s")
        time.sleep(retry_delay)

    return make_item(
        product_key,
        None,
        status="FAILED",
        reason="ERROR",
        error="Unknown failure.",
        source_url="https://www.bing.com/search",
    )


def run() -> dict:
    output = {
        "source": "Bing (Playwright)",
        "fetchedAt": now_iso(),
        "items": [],
        "errors": [],
    }

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=SCRAPER_HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context, page = new_context(browser)

        try:
            for index, (product_key, name) in enumerate(PRODUCTS):
                item = scrape_product(page, product_key, name)
                output["items"].append(item)
                if item.get("status") != "OK":
                    output["errors"].append(
                        {
                            "productKey": product_key,
                            "error": item.get("error") or item.get("reason") or "Unknown scraper failure.",
                            "sourceUrl": item.get("meta", {}).get("sourceUrl") or "",
                        }
                    )

                if index < len(PRODUCTS) - 1:
                    time.sleep(random.uniform(DELAY_BETWEEN_PRODUCTS_MIN, DELAY_BETWEEN_PRODUCTS_MAX))
        finally:
            try:
                context.close()
            except Exception:
                pass
            browser.close()

    return output


if __name__ == "__main__":
    try:
        sys.stdout.write(json.dumps(run(), ensure_ascii=False))
    except Exception as error:
        log(f"Fatal scraper error: {error}")
        sys.stdout.write(json.dumps(make_failed_output(str(error)), ensure_ascii=False))
    sys.stdout.flush()
