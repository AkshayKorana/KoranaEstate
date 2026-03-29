from __future__ import annotations

import base64
import os
import random
import sys
import time
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import env_bool, env_float, env_int, get_active_commodities
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

SCRAPER_FAST_MODE = env_bool("SCRAPER_FAST_MODE", True)
NAV_TIMEOUT_MS = env_int("NAV_TIMEOUT_MS", 9000 if SCRAPER_FAST_MODE else 25000)
RESULTS_TIMEOUT_MS = env_int("RESULTS_TIMEOUT_MS", 5000 if SCRAPER_FAST_MODE else 12000)
PRODUCT_TIMEOUT_MS = env_int("PRODUCT_TIMEOUT_MS", 9000 if SCRAPER_FAST_MODE else 30000)
SCRAPER_HEADLESS = env_bool("SCRAPER_HEADLESS", True)
IS_RENDER = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))
SCRAPER_BROWSER = (os.getenv("SCRAPER_BROWSER") or ("chromium" if IS_RENDER else "firefox")).strip().lower()
SCRAPER_BROWSER_CHANNEL = os.getenv("SCRAPER_BROWSER_CHANNEL")
CHROMIUM_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-zygote",
    "--single-process",
]
FIREFOX_USER_AGENTS = [
    "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:136.0) Gecko/20100101 Firefox/136.0",
]

DELAY_BETWEEN_PRODUCTS_MIN = env_float("DELAY_BETWEEN_PRODUCTS_MIN", 0.1 if SCRAPER_FAST_MODE else 1.0)
DELAY_BETWEEN_PRODUCTS_MAX = env_float("DELAY_BETWEEN_PRODUCTS_MAX", 0.3 if SCRAPER_FAST_MODE else 2.0)
NETWORK_IDLE_TIMEOUT_MS = 1200 if SCRAPER_FAST_MODE else 3000
STABILIZE_WAIT_MS = 350 if SCRAPER_FAST_MODE else 1500
BODY_TEXT_TIMEOUT_MS = 1500 if SCRAPER_FAST_MODE else 3000
RESULT_BLOCK_LIMIT = 4 if SCRAPER_FAST_MODE else 8
CONTEXT_BLOCK_LIMIT = 1 if SCRAPER_FAST_MODE else 2
SOURCE_SCAN_LIMIT = 8 if SCRAPER_FAST_MODE else 20
SOURCE_RETURN_LIMIT = 5 if SCRAPER_FAST_MODE else 8
SEARCH_SCROLL_ROUNDS = 3 if SCRAPER_FAST_MODE else 10
SCROLL_WAIT_MS = 350 if SCRAPER_FAST_MODE else 1000
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
        page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
    except Exception:
        pass
    safe_wait(page, STABILIZE_WAIT_MS)


def get_body_text(page) -> str:
    stabilize(page)
    return (page.locator("body").inner_text(timeout=BODY_TEXT_TIMEOUT_MS) or "")[:20000]


def submit_search(page, query: str) -> None:
    page.goto("https://www.bing.com", wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    stabilize(page)

    search_box_selectors = [
        'textarea[name="q"]',
        'input[name="q"]',
        '#sb_form_q',
    ]

    for selector in search_box_selectors:
        try:
            locator = page.locator(selector).first
            if locator.is_visible(timeout=1000):
                locator.fill(query, timeout=2000)
                break
        except Exception:
            continue

    selectors = [
        '#search_icon',
        '#sb_form_go',
        'button:has-text("Search")',
        'input[type="submit"]',
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

    try:
        page.locator('textarea[name="q"], input[name="q"], #sb_form_q').first.press("Enter", timeout=2000)
        stabilize(page)
    except Exception:
        pass


def scroll_entire_page(page, rounds: int = 8) -> None:
    last_height = 0
    stable_rounds = 0

    for _ in range(rounds):
        try:
            current_height = page.evaluate("() => document.body.scrollHeight")
            page.mouse.wheel(0, 2500)
            safe_wait(page, SCROLL_WAIT_MS)
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


def capture_full_search_page_text(page) -> str:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
    except Exception:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
    except Exception:
        pass
    safe_wait(page, STABILIZE_WAIT_MS)
    scroll_entire_page(page, rounds=SEARCH_SCROLL_ROUNDS)
    safe_wait(page, STABILIZE_WAIT_MS)
    return (page.locator("body").inner_text(timeout=BODY_TEXT_TIMEOUT_MS) or "")[:20000]

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
            count = min(locator.count(), SOURCE_SCAN_LIMIT)
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
    return sources[:SOURCE_RETURN_LIMIT]

def search_and_extract(page, commodity) -> tuple[str | None, str, list[dict[str, str]], str]:
    query = commodity.query
    search_url = SEARCH_BASE

    # 1) Open search page
    # 2) Wait for search UI
    # 3) Click Search / submit query
    submit_search(page, query)

    body_before = get_body_text(page)
    if looks_blocked(body_before):
        return None, body_before, [], page.url or search_url

    # 4) Wait for results
    body_mid = get_body_text(page)
    if looks_blocked(body_mid):
        return None, body_mid, [], page.url or search_url

    # 5) Scroll entire search page
    # 6) Final wait
    # 7) Extract everything visible from the search page only
    body_text = capture_full_search_page_text(page)
    sources = extract_sources(page, commodity)

    if looks_blocked(body_text):
        return None, body_text, sources, page.url or search_url

    return (body_text if body_text.strip() else None), body_text, sources, page.url or search_url


def scrape_product(page, commodity) -> dict:
    started_at = time.monotonic()
    log(
        f"[BING][headless={SCRAPER_HEADLESS}][fast={SCRAPER_FAST_MODE}] "
        f"{commodity.product_key} -> {commodity.query}"
    )

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
                    "shortDescription": "No reliable structured market summary available.",
                    "analysisSummary": "No reliable structured market summary available.",
                    "analysisBullets": [],
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
        browser_name = "firefox" if SCRAPER_BROWSER == "firefox" else "chromium"
        launch_options = {
            "headless": SCRAPER_HEADLESS,
        }
        if browser_name == "chromium":
            launch_options["args"] = CHROMIUM_LAUNCH_ARGS
            if SCRAPER_BROWSER_CHANNEL:
                launch_options["channel"] = SCRAPER_BROWSER_CHANNEL
            browser = playwright.chromium.launch(**launch_options)
            user_agent = random.choice(USER_AGENTS)
        else:
            browser = playwright.firefox.launch(**launch_options)
            user_agent = random.choice(FIREFOX_USER_AGENTS)

        log(f"[BING] browser={browser_name} headless={SCRAPER_HEADLESS} fast={SCRAPER_FAST_MODE}")
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            user_agent=user_agent,
        )
        context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            """
        )
        try:
            for index, commodity in enumerate(commodities):
                page = context.new_page()
                try:
                    item = scrape_product(page, commodity)
                finally:
                    try:
                        page.close()
                    except Exception:
                        pass
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
            try:
                browser.close()
            except Exception:
                pass

    return output
