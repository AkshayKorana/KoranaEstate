from __future__ import annotations

import random
import re
import sys
import time

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import env_bool, env_float, env_int, get_active_commodities
from models import build_error, build_item, now_iso
from parsers import parse_commodity_intelligence

SOURCE_NAME = "bing"
PAYLOAD_SOURCE = "Bing (Playwright)"
SEARCH_URL = "https://www.bing.com/search"
MAX_RETRIES_PER_PRODUCT = env_int("MAX_RETRIES_PER_PRODUCT", 0)
NAV_TIMEOUT_MS = env_int("NAV_TIMEOUT_MS", 12000)
RESULTS_TIMEOUT_MS = env_int("RESULTS_TIMEOUT_MS", 6000)
PRODUCT_TIMEOUT_MS = env_int("PRODUCT_TIMEOUT_MS", 18000)
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


def looks_blocked(text: str) -> bool:
    lowered = (text or "").lower()
    return any(
        marker in lowered
        for marker in [
            "unusual traffic",
            "verify you are a human",
            "captcha",
            "blocked",
            "access denied",
            "our systems have detected",
            "one last step",
            "please solve the challenge below to continue",
        ]
    )


def try_accept_banners(page) -> None:
    for selector in (
        'button:has-text("Accept")',
        'button:has-text("I agree")',
        'button:has-text("Agree")',
        'button:has-text("OK")',
    ):
        try:
            button = page.locator(selector).first
            if button.count() > 0:
                button.click(timeout=900)
                page.wait_for_timeout(150)
                return
        except Exception:
            continue


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


def fetch_bing_text(page, query: str) -> tuple[str | None, str, list[dict[str, str]], str]:
    search_url = SEARCH_URL + "?q=" + re.sub(r"\s+", "+", query.strip())
    page.goto(search_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    try_accept_banners(page)
    page.wait_for_timeout(250)

    body_text = (page.locator("body").inner_text(timeout=1500) or "")[:8000]
    if looks_blocked(body_text):
        return None, body_text, [], search_url

    try:
        page.wait_for_selector("#b_results li.b_algo, #b_context, #b_ans", state="attached", timeout=RESULTS_TIMEOUT_MS)
    except Exception:
        return None, body_text, [], search_url

    blocks: list[str] = []
    sources: list[dict[str, str]] = []

    for selector in ("#b_context", "#b_ans"):
        try:
            text = page.locator(selector).inner_text(timeout=800)
            if text:
                blocks.append(text)
        except Exception:
            continue

    result_items = page.locator("#b_results li.b_algo")
    for index in range(min(result_items.count(), 5)):
        result = result_items.nth(index)
        try:
            text = result.inner_text(timeout=1000)
            if text:
                blocks.append(text)
            link = result.locator("h2 a").first
            href = link.get_attribute("href") or ""
            title = (link.inner_text(timeout=500) or "").strip()
            if href.startswith("http"):
                sources.append({"title": title[:180], "url": href, "host": re.sub(r"^https?://([^/]+)/?.*$", r"\1", href)})
        except Exception:
            continue

    snippets = "\n\n".join(blocks).strip()
    return (snippets if snippets else None), body_text, sources, search_url


def build_failed_output(message: str) -> dict:
    items = []
    errors = []
    for commodity in get_active_commodities():
        item = build_item(
            product_key=commodity.product_key,
            display_name=commodity.display_name,
            unit=commodity.unit,
            status="FAILED",
            reason="SCRAPER_ERROR",
            source=SOURCE_NAME,
            source_url=SEARCH_URL,
            raw_text=None,
            confidence=None,
            error=message,
        )
        items.append(item)
        errors.append(build_error(commodity.product_key, message, SEARCH_URL))

    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": items,
        "errors": errors,
    }


def scrape_product(page, commodity) -> dict:
    started_at = time.monotonic()
    log(f"[BING][headless={SCRAPER_HEADLESS}] {commodity.product_key} -> {commodity.query}")

    for attempt in range(MAX_RETRIES_PER_PRODUCT + 1):
        if (time.monotonic() - started_at) * 1000 > PRODUCT_TIMEOUT_MS:
            return build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit=commodity.unit,
                status="FAILED",
                reason="TIMEOUT",
                source=SOURCE_NAME,
                source_url=SEARCH_URL,
                raw_text=None,
                confidence=None,
                error=f"Per-product timeout exceeded ({PRODUCT_TIMEOUT_MS}ms).",
            )

        try:
            snippets, debug, sources, search_url = fetch_bing_text(page, commodity.query)
            if snippets is None:
                reason = "BLOCKED" if looks_blocked(debug) else "NO_DATA"
                error = "Search engine blocked the request." if reason == "BLOCKED" else "No result text detected."
                extras = {
                    "shortDescription": debug[:280] if debug else None,
                    "analysisSummary": debug[:600] if debug else None,
                    "analysisBullets": [debug[:240]] if debug else [],
                    "historicalPoints": [],
                    "forecastPoints": [],
                    "metadata": {"query": commodity.query, "aliases": list(commodity.aliases)},
                    "sources": sources,
                }
                return build_item(
                    product_key=commodity.product_key,
                    display_name=commodity.display_name,
                    unit=commodity.unit,
                    status="FAILED",
                    reason=reason,
                    source=SOURCE_NAME,
                    source_url=search_url,
                    raw_text=debug,
                    confidence=None,
                    error=error,
                    extras=extras,
                )

            intelligence = parse_commodity_intelligence(commodity, snippets, sources)
            value = intelligence.get("currentPrice")
            status = "OK" if value is not None else "FAILED"
            reason = "MATCHED" if value is not None else "NO_DATA"
            error = None if value is not None else "No structured current price extracted."
            return build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit=commodity.unit,
                status=status,
                reason=reason,
                source=SOURCE_NAME,
                source_url=intelligence.get("sourceUrl") or search_url,
                raw_text=snippets,
                confidence=intelligence.get("confidence"),
                value=value,
                error=error,
                extras=intelligence,
            )
        except PWTimeout as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return build_item(
                    product_key=commodity.product_key,
                    display_name=commodity.display_name,
                    unit=commodity.unit,
                    status="FAILED",
                    reason="TIMEOUT",
                    source=SOURCE_NAME,
                    source_url=SEARCH_URL,
                    raw_text=None,
                    confidence=None,
                    error=str(error),
                )
        except Exception as error:
            if attempt >= MAX_RETRIES_PER_PRODUCT:
                return build_item(
                    product_key=commodity.product_key,
                    display_name=commodity.display_name,
                    unit=commodity.unit,
                    status="FAILED",
                    reason="ERROR",
                    source=SOURCE_NAME,
                    source_url=SEARCH_URL,
                    raw_text=None,
                    confidence=None,
                    error=str(error),
                )

        retry_delay = random.uniform(DELAY_BETWEEN_RETRIES_MIN, DELAY_BETWEEN_RETRIES_MAX)
        time.sleep(retry_delay)

    return build_item(
        product_key=commodity.product_key,
        display_name=commodity.display_name,
        unit=commodity.unit,
        status="FAILED",
        reason="ERROR",
        source=SOURCE_NAME,
        source_url=SEARCH_URL,
        raw_text=None,
        confidence=None,
        error="Unknown failure.",
    )


def run() -> dict:
    output = {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": [],
        "errors": [],
    }

    commodities = get_active_commodities()
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
            for index, commodity in enumerate(commodities):
                item = scrape_product(page, commodity)
                output["items"].append(item)
                if item.get("status") != "OK":
                    output["errors"].append(
                        build_error(
                            commodity.product_key,
                            item.get("error") or item.get("reason") or "Unknown scraper failure.",
                            item.get("sourceUrl") or SEARCH_URL,
                        )
                    )

                if index < len(commodities) - 1:
                    time.sleep(random.uniform(DELAY_BETWEEN_PRODUCTS_MIN, DELAY_BETWEEN_PRODUCTS_MAX))
        finally:
            try:
                context.close()
            except Exception:
                pass
            browser.close()

    return output
