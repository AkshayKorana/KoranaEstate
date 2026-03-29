from __future__ import annotations

import base64
import os
import random
import re
import sys
import time
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import CommodityConfig, env_bool, env_float, env_int, get_active_commodities
from models import build_error, build_item, now_iso
from parsers import parse_commodity_intelligence

def build_failed_output(message: str, commodities: list[CommodityConfig] | None = None) -> dict:
    items = []
    errors = []

    for commodity in (commodities or get_active_commodities()):
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

IS_RENDER = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))

SCRAPER_FAST_MODE = env_bool("SCRAPER_FAST_MODE", True)
NAV_TIMEOUT_MS = env_int("NAV_TIMEOUT_MS", 12000 if IS_RENDER else (9000 if SCRAPER_FAST_MODE else 25000))
RESULTS_TIMEOUT_MS = env_int("RESULTS_TIMEOUT_MS", 6000 if IS_RENDER else (5000 if SCRAPER_FAST_MODE else 12000))
PRODUCT_TIMEOUT_MS = env_int("PRODUCT_TIMEOUT_MS", 25000 if IS_RENDER else (12000 if SCRAPER_FAST_MODE else 30000))
SCRAPER_HEADLESS = env_bool("SCRAPER_HEADLESS", True)
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
DELAY_BETWEEN_PRODUCTS_MIN = env_float("DELAY_BETWEEN_PRODUCTS_MIN", 0.0 if IS_RENDER else (0.1 if SCRAPER_FAST_MODE else 1.0))
DELAY_BETWEEN_PRODUCTS_MAX = env_float("DELAY_BETWEEN_PRODUCTS_MAX", 0.1 if IS_RENDER else (0.3 if SCRAPER_FAST_MODE else 2.0))
NETWORK_IDLE_TIMEOUT_MS = 0 if IS_RENDER else (1200 if SCRAPER_FAST_MODE else 3000)
STABILIZE_WAIT_MS = 200 if IS_RENDER else (350 if SCRAPER_FAST_MODE else 1500)
BODY_TEXT_TIMEOUT_MS = 2500 if IS_RENDER else (1500 if SCRAPER_FAST_MODE else 3000)
RESULT_BLOCK_LIMIT = env_int("RESULT_BLOCK_LIMIT", 10 if SCRAPER_FAST_MODE else 14)
SEARCH_SCROLL_ROUNDS = env_int("SEARCH_SCROLL_ROUNDS", 2 if IS_RENDER else (3 if SCRAPER_FAST_MODE else 6))
SCROLL_WAIT_MS = env_int("SCROLL_WAIT_MS", 500 if IS_RENDER else (350 if SCRAPER_FAST_MODE else 1000))
RESULT_CARD_SELECTOR = "#b_results li.b_algo"
RESULT_SNIPPET_SELECTORS = (
    ".b_caption p",
    ".b_lineclamp4",
    ".b_paractl",
    "p",
)
LOCALITY_TERMS = ("madikeri", "kodagu", "coorg")
MARKET_TERMS = ("price", "prices", "rate", "rates", "market", "mandi", "trend", "₹", "kg", "quintal", "50 kg")
DENYLIST_HOST_FRAGMENTS = (
    "github.com",
    "reddit.com",
    "youtube.com",
    "youtu.be",
    "support.google.com",
    "naver.com",
    "4399.com",
    "zhihu.com",
    "chatgpt.com",
    "openai.com",
    "playblackdesert.com",
    "bigfooty.com",
    "lowyat.net",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
    "linkedin.com",
    "discord.com",
    "tiktok.com",
    "quora.com",
    "stackoverflow.com",
    "stackexchange.com",
    "mail.google.com",
    "outlook.live.com",
)
TRUSTED_HOST_FRAGMENTS = (
    "commodityonline",
    "commoditymarketlive",
    "kisandeals",
    "agriwatch",
    "napanta",
    "kirehalli",
    "kodaguexpress",
    "indianspices",
    "agriplus",
    "mandibhav",
    "commoditypriceapi",
    "coffeeboard",
    "coffeeboard",
    "indiacoffee",
    "spicesboard",
    "spicesboardindia",
    "gov.in",
    "nic.in",
    "apmc",
    "mandi",
)
NEGATIVE_TEXT_TERMS = (
    "login",
    "sign in",
    "watch",
    "video",
    "forum",
    "discussion",
    "issue",
    "github",
    "reddit",
    "chatgpt",
    "youtube",
    "support",
    "game",
    "mail",
)
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
    if ms > 0:
        page.wait_for_timeout(ms)


def stabilize(page) -> None:
    try:
        page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
    except Exception:
        pass
    if NETWORK_IDLE_TIMEOUT_MS > 0:
        try:
            page.wait_for_load_state("networkidle", timeout=NETWORK_IDLE_TIMEOUT_MS)
        except Exception:
            pass
    safe_wait(page, STABILIZE_WAIT_MS)


def get_body_text(page) -> str:
    try:
        return (page.locator("body").inner_text(timeout=BODY_TEXT_TIMEOUT_MS) or "")[:20000]
    except Exception:
        return ""


def build_query(commodity: CommodityConfig) -> str:
    return commodity.query


def open_search_results(page, query: str) -> str:
    search_url = f"{SEARCH_BASE}?q={quote_plus(query)}&setlang=en-IN"
    page.goto(search_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    stabilize(page)
    return search_url


def wait_for_result_blocks(page) -> bool:
    locator = page.locator(RESULT_CARD_SELECTOR).first
    try:
        locator.wait_for(state="visible", timeout=RESULTS_TIMEOUT_MS)
        return True
    except Exception:
        try:
            return page.locator(RESULT_CARD_SELECTOR).count() > 0
        except Exception:
            return False


def scroll_entire_page(page, rounds: int = 3) -> None:
    for _ in range(rounds):
        try:
            page.mouse.wheel(0, 1800)
            safe_wait(page, SCROLL_WAIT_MS)
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


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _result_score(commodity: CommodityConfig, title: str, snippet: str, url: str) -> int:
    haystack = f"{title} {snippet} {url}".lower()
    score = 0
    if commodity.display_name.lower() in haystack:
        score += 8
    for alias in commodity.aliases:
        if alias.lower() in haystack:
            score += 6
    for token in commodity.display_name.lower().split():
        if token in haystack:
            score += 2
    if "madikeri" in haystack or "kodagu" in haystack:
        score += 5
    if any(keyword in haystack for keyword in ("price", "latest", "today", "rate", "trend", "last week", "analysis")):
        score += 3
    host = urlparse(url).netloc.lower()
    if any(fragment in host for fragment in TRUSTED_HOST_FRAGMENTS):
        score += 20
    if any(term in haystack for term in NEGATIVE_TEXT_TERMS):
        score -= 25
    if "bing.com" in haystack:
        score -= 20
    return score


def _commodity_terms(commodity: CommodityConfig) -> tuple[str, ...]:
    terms = {
        commodity.display_name.lower(),
        *[alias.lower() for alias in commodity.aliases],
    }
    for token in commodity.display_name.lower().split():
        if len(token) > 2:
            terms.add(token)
    return tuple(sorted(term for term in terms if term))


def _is_denied_host(host: str) -> bool:
    lowered = host.lower()
    return any(fragment in lowered for fragment in DENYLIST_HOST_FRAGMENTS)


def _passes_relevance_gate(commodity: CommodityConfig, title: str, snippet: str, url: str) -> bool:
    haystack = f"{title} {snippet} {url}".lower()
    commodity_match = any(term in haystack for term in _commodity_terms(commodity))
    locality_match = any(term in haystack for term in LOCALITY_TERMS)
    market_match = any(term in haystack for term in MARKET_TERMS)
    return commodity_match and locality_match and market_match


def extract_result_blocks(page, commodity: CommodityConfig) -> tuple[list[dict[str, str]], int]:
    accepted_results: list[dict[str, str]] = []
    locator = page.locator(RESULT_CARD_SELECTOR)
    count = min(locator.count(), RESULT_BLOCK_LIMIT)
    total_found = count

    for index in range(count):
        try:
            card = locator.nth(index)
            link = card.locator("h2 a").first
            href = _clean_text(link.get_attribute("href") or "")
            if not href.startswith("http"):
                continue

            resolved_url = _decode_bing_redirect_url(href)
            parsed = urlparse(resolved_url)
            if not parsed.netloc or "bing.com" in parsed.netloc:
                continue
            if _is_denied_host(parsed.netloc):
                continue

            title = _clean_text(link.inner_text(timeout=700) or link.get_attribute("aria-label") or "")
            snippet = ""
            for selector in RESULT_SNIPPET_SELECTORS:
                snippet = _clean_text(card.locator(selector).first.inner_text(timeout=700) or "")
                if snippet:
                    break

            if not title and not snippet:
                continue
            if not _passes_relevance_gate(commodity, title, snippet, resolved_url):
                continue

            score = _result_score(commodity, title, snippet, resolved_url)

            accepted_results.append(
                {
                    "title": title[:240] or parsed.netloc,
                    "snippet": snippet[:800],
                    "url": resolved_url,
                    "host": parsed.netloc,
                    "score": score,
                }
            )
        except Exception:
            continue

    accepted_results.sort(
        key=lambda result: _result_score(
            commodity,
            result.get("title", ""),
            result.get("snippet", ""),
            result.get("url", ""),
        ),
        reverse=True,
    )
    return accepted_results, total_found


def _result_signature(result: dict[str, str]) -> str:
    title = _clean_text(result.get("title", "")).lower()
    snippet = _clean_text(result.get("snippet", "")).lower()
    url = _clean_text(result.get("url", "")).lower()
    return f"{url}|{title}|{snippet}"


def scroll_and_collect_results(page, commodity: CommodityConfig) -> list[dict[str, str]]:
    collected: list[dict[str, str]] = []
    seen: set[str] = set()
    stagnant_rounds = 0
    total_found = 0

    for round_index in range(SEARCH_SCROLL_ROUNDS + 1):
        current_results, found_this_round = extract_result_blocks(page, commodity)
        total_found = max(total_found, found_this_round)
        added = 0
        for result in current_results:
            signature = _result_signature(result)
            if signature in seen:
                continue
            seen.add(signature)
            collected.append(result)
            added += 1

        if round_index >= SEARCH_SCROLL_ROUNDS:
            break

        if added == 0:
            stagnant_rounds += 1
            if stagnant_rounds >= 2:
                break
        else:
            stagnant_rounds = 0

        scroll_entire_page(page, 1)
        safe_wait(page, SCROLL_WAIT_MS)

    collected.sort(key=lambda result: int(result.get("score", 0)), reverse=True)
    return collected, total_found


def merge_results_for_parser(results: list[dict[str, str]]) -> str:
    blocks: list[str] = []
    for result in results:
        lines = [
            f"Title: {result['title']}",
            f"Snippet: {result['snippet']}" if result.get("snippet") else "Snippet:",
            f"URL: {result['url']}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def search_and_extract(page, commodity) -> tuple[str | None, str, list[dict[str, str]], str]:
    query = build_query(commodity)
    search_url = open_search_results(page, query)
    body_text = get_body_text(page)
    if looks_blocked(body_text):
        return None, body_text, [], page.url or search_url

    if not wait_for_result_blocks(page):
        debug_text = get_body_text(page)
        return None, debug_text, [], page.url or search_url

    results, total_found = scroll_and_collect_results(page, commodity)
    top_hosts = [result["host"] for result in results[:3]]
    log(
        f"[BING][{commodity.product_key}] total_result_cards={total_found} "
        f"accepted_results={len(results)} top_hosts={top_hosts}"
    )
    if not results:
        debug_text = get_body_text(page)
        log(f"[BING][{commodity.product_key}] parser_skipped_no_relevant_results=true")
        return None, debug_text, [], page.url or search_url

    merged_text = merge_results_for_parser(results)
    if looks_blocked(merged_text or body_text):
        return None, merged_text or body_text, results, page.url or search_url

    return (merged_text if merged_text.strip() else None), merged_text or body_text, results, page.url or search_url


def scrape_product(page, commodity) -> dict:
    started_at = time.monotonic()
    log(
        f"[BING][headless={SCRAPER_HEADLESS}][fast={SCRAPER_FAST_MODE}][render={IS_RENDER}] "
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
            if looks_blocked(debug_text):
                reason = "BLOCKED"
                error = "Search engine blocked the request."
            elif not sources:
                reason = "NO_RELEVANT_RESULTS"
                error = "No relevant Bing organic result blocks passed filtering."
            else:
                reason = "NO_DATA"
                error = "No result text detected."
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
                    "metadata": {"query": build_query(commodity), "aliases": list(commodity.aliases)},
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


def run(commodities: list[CommodityConfig] | None = None) -> dict:
    output = {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": [],
        "errors": [],
    }

    commodities = commodities or get_active_commodities()

    with sync_playwright() as playwright:
        browser_name = "firefox" if SCRAPER_BROWSER == "firefox" else "chromium"
        launch_options: dict[str, object] = {
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

        log(f"[BING] browser={browser_name} headless={SCRAPER_HEADLESS} fast={SCRAPER_FAST_MODE} render={IS_RENDER}")

        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            user_agent=user_agent,
            java_script_enabled=True,
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
                except Exception as exc:
                    log(f"[BING] unexpected error for {commodity.product_key}: {exc}")
                    item = build_item(
                        product_key=commodity.product_key,
                        display_name=commodity.display_name,
                        unit=commodity.unit,
                        status="FAILED",
                        reason="ERROR",
                        source=SOURCE_NAME,
                        source_url=SEARCH_BASE,
                        raw_text=None,
                        confidence=None,
                        error=str(exc),
                    )
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
                    delay = random.uniform(DELAY_BETWEEN_PRODUCTS_MIN, DELAY_BETWEEN_PRODUCTS_MAX)
                    if delay > 0:
                        time.sleep(delay)

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
