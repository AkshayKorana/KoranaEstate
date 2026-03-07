from __future__ import annotations

import base64
import random
import sys
import time
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import env_float, env_int, get_active_commodities
from models import build_error, build_item, now_iso
from parsers import parse_commodity_intelligence

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
            source_url=SEARCH_BASE,
            raw_text=None,
            confidence=None,
            error=message,
        )
        items.append(item)
        errors.append(build_error(commodity.product_key, message, SEARCH_BASE))

    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": items,
        "errors": errors,
    }
    
SOURCE_NAME = "bing"
PAYLOAD_SOURCE = "Bing (Playwright)"
SEARCH_BASE = "https://www.bing.com/search"

NAV_TIMEOUT_MS = env_int("NAV_TIMEOUT_MS", 25000)
RESULTS_TIMEOUT_MS = env_int("RESULTS_TIMEOUT_MS", 12000)
PRODUCT_TIMEOUT_MS = env_int("PRODUCT_TIMEOUT_MS", 30000)

DELAY_BETWEEN_PRODUCTS_MIN = env_float("DELAY_BETWEEN_PRODUCTS_MIN", 1.0)
DELAY_BETWEEN_PRODUCTS_MAX = env_float("DELAY_BETWEEN_PRODUCTS_MAX", 2.0)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
]

BLOCK_MARKERS = [
    "one last step",
    "please solve the challenge below to continue",
    "verify you are a human",
    "captcha",
    "access denied",
    "unusual traffic",
]


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def looks_blocked(text: str) -> bool:
    lowered = (text or "").lower()
    return any(marker in lowered for marker in BLOCK_MARKERS)


def safe_wait(page, ms: int) -> None:
    page.wait_for_timeout(ms)


def stabilize(page) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
    except Exception:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=3000)
    except Exception:
        pass
    safe_wait(page, 1500)


def get_body_text(page) -> str:
    stabilize(page)
    return (page.locator("body").inner_text(timeout=3000) or "")[:20000]


def click_search_top(page) -> None:
    """
    Click the Search tab/button at the top if it exists.
    Safe no-op if already on search or not found.
    """
    selectors = [
        'a[href*="/search"]',
        'a:has-text("Search")',
        'button:has-text("Search")',
        '[role="tab"]:has-text("Search")',
    ]

    for selector in selectors:
        try:
            locator = page.locator(selector).first
            if locator.is_visible(timeout=1000):
                locator.click(timeout=2000)
                stabilize(page)
                return
        except Exception:
            continue


def scroll_entire_page(page, rounds: int = 8) -> None:
    last_height = 0
    stable_rounds = 0

    for _ in range(rounds):
        try:
            current_height = page.evaluate("() => document.body.scrollHeight")
            page.mouse.wheel(0, 2500)
            safe_wait(page, 1000)
            new_height = page.evaluate("() => document.body.scrollHeight")

            if new_height == last_height or new_height == current_height:
                stable_rounds += 1
            else:
                stable_rounds = 0

            last_height = new_height

            if stable_rounds >= 2:
                break
        except Exception:
            break


def _decode_bing_redirect_url(href: str) -> str:
    parsed = urlparse(href)
    if "bing.com" not in parsed.netloc:
        return href

    query = parse_qs(parsed.query)
    for key in ("u", "url", "r"):
        if key not in query or not query[key]:
            continue
        candidate = unquote(query[key][0])
        if candidate.startswith("http://") or candidate.startswith("https://"):
            return candidate
        if candidate.startswith("a1"):
            payload = candidate[2:]
            padding = "=" * ((4 - (len(payload) % 4)) % 4)
            try:
                decoded = base64.urlsafe_b64decode(payload + padding).decode("utf-8")
                if decoded.startswith("http://") or decoded.startswith("https://"):
                    return decoded
            except Exception:
                continue

    return href


def _extract_result_text(page) -> str:
    blocks: list[str] = []
    selectors = ["#b_context", "#b_ans", "#b_results li.b_algo"]

    for selector in selectors:
        try:
            locator = page.locator(selector)
            count = min(locator.count(), 8 if selector.endswith("b_algo") else 2)
            for index in range(count):
                block = locator.nth(index)
                text = (block.inner_text(timeout=1200) or "").strip()
                if text:
                    blocks.append(text)
        except Exception:
            continue

    return "\n\n".join(blocks).strip()


def _source_score(commodity, title: str, url: str) -> int:
    haystack = f"{title} {url}".lower()
    score = 0
    if commodity.display_name.lower() in haystack:
        score += 8
    for alias in commodity.aliases:
        if alias.lower() in haystack:
            score += 6
    for token in commodity.display_name.lower().split():
        if token in haystack:
            score += 2
    if any(keyword in haystack for keyword in ("price", "market", "rate", "analysis", "forecast", "commodity")):
        score += 2
    if "bing.com" in haystack:
        score -= 20
    return score


def extract_sources(page, commodity) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    selectors = [
        "#b_results li.b_algo h2 a",
        "#b_context a[href]",
        "#b_ans a[href]",
        "#b_results li.b_algo a[href]",
    ]

    for selector in selectors:
        try:
            locator = page.locator(selector)
            count = min(locator.count(), 20)
            for index in range(count):
                link = locator.nth(index)
                href = (link.get_attribute("href") or "").strip()
                if not href.startswith("http"):
                    continue

                normalized_url = _decode_bing_redirect_url(href)
                parsed = urlparse(normalized_url)
                if not parsed.netloc:
                    continue
                if "bing.com" in parsed.netloc:
                    continue

                title = (link.inner_text(timeout=700) or link.get_attribute("aria-label") or "").strip()
                dedupe_key = (normalized_url, title)
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                sources.append(
                    {
                        "title": title[:180] or parsed.netloc,
                        "url": normalized_url,
                        "host": parsed.netloc,
                    }
                )
        except Exception:
            continue

    sources.sort(key=lambda source: _source_score(commodity, source.get("title", ""), source.get("url", "")), reverse=True)
    return sources[:8]


def search_and_extract(page, commodity) -> tuple[str | None, str, list[dict[str, str]], str]:
    query = commodity.query
    search_url = f"{SEARCH_BASE}?q={quote_plus(query)}"

    # 1) Search for the text
    page.goto(search_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)

    # 2) Wait for content to load
    stabilize(page)

    body_before = get_body_text(page)
    if looks_blocked(body_before):
        return None, body_before, [], page.url or search_url

    # 3) Click Search button/tab on top
    click_search_top(page)

    # 4) Wait for content to load again
    stabilize(page)

    body_mid = get_body_text(page)
    if looks_blocked(body_mid):
        return None, body_mid, [], page.url or search_url

    # 5) Scroll entire search page
    scroll_entire_page(page, rounds=10)

    # 6) Final wait
    stabilize(page)

    # 7) Extract everything visible
    body_text = get_body_text(page)
    result_text = _extract_result_text(page)
    sources = extract_sources(page, commodity)

    if looks_blocked(body_text):
        return None, body_text, sources, page.url or search_url

    extracted_text = result_text if result_text.strip() else body_text
    return (extracted_text if extracted_text.strip() else None), body_text, sources, page.url or search_url


def scrape_product(page, commodity) -> dict:
    started_at = time.monotonic()
    log(f"[BING][headless=False] {commodity.product_key} -> {commodity.query}")

    try:
        if (time.monotonic() - started_at) * 1000 > PRODUCT_TIMEOUT_MS:
            return build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit=commodity.unit,
                status="FAILED",
                reason="TIMEOUT",
                source=SOURCE_NAME,
                source_url=SEARCH_BASE,
                raw_text=None,
                confidence=None,
                error=f"Per-product timeout exceeded ({PRODUCT_TIMEOUT_MS}ms).",
            )

        extracted_text, debug_text, sources, source_url = search_and_extract(page, commodity)

        if extracted_text is None:
            reason = "BLOCKED" if looks_blocked(debug_text) else "NO_DATA"
            error = "Search engine blocked the request." if reason == "BLOCKED" else "No result text detected."
            return build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit=commodity.unit,
                status="FAILED",
                reason=reason,
                source=SOURCE_NAME,
                source_url=source_url,
                raw_text=debug_text,
                confidence=None,
                error=error,
                extras={
                    "shortDescription": (debug_text or "")[:280] or None,
                    "analysisSummary": (debug_text or "")[:600] or None,
                    "analysisBullets": [debug_text[:240]] if debug_text else [],
                    "historicalPoints": [],
                    "forecastPoints": [],
                    "metadata": {"query": commodity.query, "aliases": list(commodity.aliases)},
                    "sources": sources,
                },
            )

        intelligence = parse_commodity_intelligence(commodity, extracted_text, sources)
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
            source_url=intelligence.get("sourceUrl") or source_url,
            raw_text=extracted_text,
            confidence=intelligence.get("confidence"),
            value=value,
            error=error,
            extras=intelligence,
        )

    except PWTimeout as error:
        return build_item(
            product_key=commodity.product_key,
            display_name=commodity.display_name,
            unit=commodity.unit,
            status="FAILED",
            reason="TIMEOUT",
            source=SOURCE_NAME,
            source_url=SEARCH_BASE,
            raw_text=None,
            confidence=None,
            error=str(error),
        )
    except Exception as error:
        return build_item(
            product_key=commodity.product_key,
            display_name=commodity.display_name,
            unit=commodity.unit,
            status="FAILED",
            reason="ERROR",
            source=SOURCE_NAME,
            source_url=SEARCH_BASE,
            raw_text=None,
            confidence=None,
            error=str(error),
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
            channel="msedge",
            headless=False,
            args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            user_agent=random.choice(USER_AGENTS),
        )
        page = context.new_page()
        page.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            """
        )

        try:
            for index, commodity in enumerate(commodities):
                item = scrape_product(page, commodity)
                output["items"].append(item)

                if item.get("status") != "OK":
                    output["errors"].append(
                        build_error(
                            commodity.product_key,
                            item.get("error") or item.get("reason") or "Unknown scraper failure.",
                            item.get("sourceUrl") or SEARCH_BASE,
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
