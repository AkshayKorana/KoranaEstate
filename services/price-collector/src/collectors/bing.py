from __future__ import annotations

import random
import re
import sys
import time
from typing import Optional

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import PRODUCTS, UNIT, env_bool, env_float, env_int
from models import CollectorError, NormalizedItem, now_iso
from parsers import extract_inr_per_kg

SOURCE_NAME = "bing"
PAYLOAD_SOURCE = "Bing (Playwright)"
SOURCE_URL = "https://www.bing.com/search"
MAX_RETRIES_PER_PRODUCT = env_int("MAX_RETRIES_PER_PRODUCT", 0)
NAV_TIMEOUT_MS = env_int("NAV_TIMEOUT_MS", 12000)
RESULTS_TIMEOUT_MS = env_int("RESULTS_TIMEOUT_MS", 6000)
PRODUCT_TIMEOUT_MS = env_int("PRODUCT_TIMEOUT_MS", 15000)
DELAY_BETWEEN_PRODUCTS_MIN = env_float("DELAY_BETWEEN_PRODUCTS_MIN", 0.2)
DELAY_BETWEEN_PRODUCTS_MAX = env_float("DELAY_BETWEEN_PRODUCTS_MAX", 0.6)
DELAY_BETWEEN_RETRIES_MIN = env_float("DELAY_BETWEEN_RETRIES_MIN", 0.4)
DELAY_BETWEEN_RETRIES_MAX = env_float("DELAY_BETWEEN_RETRIES_MAX", 1.0)
SCRAPER_HEADLESS = env_bool("SCRAPER_HEADLESS", True)

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


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


def failed_item(product_key: str, reason: str, error: str, raw_text: Optional[str] = None) -> dict:
    return NormalizedItem(
        product_key=product_key,
        value=None,
        unit=UNIT,
        status="FAILED",
        reason=reason,
        source=SOURCE_NAME,
        source_url=SOURCE_URL,
        raw_text=raw_text[:1500] if raw_text else None,
        confidence=None,
        error=error,
    ).to_dict()


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


def fetch_bing_text(page, query: str) -> tuple[Optional[str], str]:
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

    blocks: list[str] = []
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
        if PRODUCT_TIMEOUT_MS - elapsed_ms <= 0:
            return failed_item(product_key, "TIMEOUT", f"Per-product timeout exceeded ({PRODUCT_TIMEOUT_MS}ms).")

        try:
            snippets, debug = fetch_bing_text(page, query)

            if snippets is None:
                reason = "BLOCKED" if looks_blocked(debug) else "NO_DATA"
                error = "Search engine blocked the request." if reason == "BLOCKED" else "No result text detected."
                return failed_item(product_key, reason, error, debug)

            value, note = extract_inr_per_kg(snippets)
            if value is None:
                return failed_item(product_key, "NO_DATA", "No INR/kg pattern matched.", snippets)

            return NormalizedItem(
                product_key=product_key,
                value=value,
                unit=UNIT,
                status="OK",
                reason="MATCHED",
                source=SOURCE_NAME,
                source_url=SOURCE_URL,
                raw_text=f"{note} | {snippets}"[:1500],
                confidence=0.58,
                error=None,
            ).to_dict()
        except PWTimeout as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return failed_item(product_key, "TIMEOUT", str(error))
        except Exception as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return failed_item(product_key, "ERROR", str(error))

        retry_delay = random.uniform(DELAY_BETWEEN_RETRIES_MIN, DELAY_BETWEEN_RETRIES_MAX)
        log(f"Retrying {product_key} after {retry_delay:.1f}s")
        time.sleep(retry_delay)

    return failed_item(product_key, "ERROR", "Unknown failure.")


def build_failed_output(message: str) -> dict:
    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": [failed_item(product.product_key, "SCRAPER_ERROR", message) for product in PRODUCTS],
        "errors": [CollectorError(product.product_key, message, SOURCE_URL).to_dict() for product in PRODUCTS],
    }


def run() -> dict:
    output = {
        "source": PAYLOAD_SOURCE,
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
            for index, product in enumerate(PRODUCTS):
                item = scrape_product(page, product.product_key, product.display_name)
                output["items"].append(item)
                if item.get("status") != "OK":
                    output["errors"].append(
                        CollectorError(
                            product.product_key,
                            item.get("error") or item.get("reason") or "Unknown scraper failure.",
                            item.get("sourceUrl") or "",
                        ).to_dict()
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
