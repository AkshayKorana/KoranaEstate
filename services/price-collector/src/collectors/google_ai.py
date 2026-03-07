from __future__ import annotations

import os
import sys
import time
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import PRODUCTS, UNIT, env_float, env_int
from models import NormalizedItem, now_iso
from parsers import extract_inr_per_kg

SOURCE_NAME = "google-ai"
PAYLOAD_SOURCE = "Google (Playwright) - AI Mode"
GOOGLE_URL = "https://www.google.com/"
QUERY_TEMPLATE = "{commodity} Latest Price Today In Madikeri And The Latest Price Analysis"
DEFAULT_TIMEOUT_MS = env_int("SCRAPER_TIMEOUT_MS", 12000)
AI_WAIT_MS = env_int("SCRAPER_AI_WAIT_MS", 7000)
SCROLL_PAUSE_SEC = env_float("SCRAPER_SCROLL_PAUSE_SEC", 0.2)
MAX_SCROLL_ROUNDS = env_int("SCRAPER_MAX_SCROLL_ROUNDS", 4)
DELAY_BETWEEN_PRODUCTS_SEC = env_float("SCRAPER_DELAY_BETWEEN_PRODUCTS_SEC", 0.2)
FORCE_HEADLESS = os.getenv("SCRAPER_HEADLESS", "true")


def log(msg: str) -> None:
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def looks_like_captcha(text: str) -> bool:
    t = (text or "").lower()
    return any(
        keyword in t
        for keyword in [
            "unusual traffic",
            "our systems have detected unusual traffic",
            "sorry",
            "captcha",
            "verify you are a human",
            "enter the characters",
            "detected unusual traffic from your computer network",
            "recaptcha",
        ]
    )


def normalize_sources(links: list[tuple[str, str]]) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for title, url in links:
        if not url or not url.startswith("http"):
            continue
        try:
            host = urlparse(url).netloc
        except Exception:
            host = ""
        key = (url, title or "")
        if key in seen:
            continue
        seen.add(key)
        out.append({"title": (title or "").strip()[:180], "url": url, "host": host})
    return out[:30]


def dismiss_google_consent(page) -> None:
    for selector in [
        'button:has-text("I agree")',
        'button:has-text("Accept all")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'button:has-text("Reject all")',
        'div[role="dialog"] button:has-text("I agree")',
    ]:
        try:
            button = page.locator(selector)
            if button.count() > 0 and button.first.is_visible():
                button.first.click(timeout=2000)
                time.sleep(0.5)
                return
        except Exception:
            continue


def google_search(page, query: str) -> None:
    page.goto(GOOGLE_URL, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
    dismiss_google_consent(page)

    box = None
    for selector in [
        'textarea[name="q"]',
        'input[name="q"]',
        'form[role="search"] textarea',
        'form[role="search"] input[type="text"]',
    ]:
        try:
            page.wait_for_selector(selector, timeout=3000)
            box = page.locator(selector).first
            if box:
                break
        except Exception:
            continue

    if not box:
        raise RuntimeError("Could not find Google search box")

    box.click()
    box.fill("")
    box.type(query, delay=45)
    box.press("Enter")
    page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
    try:
        page.wait_for_selector("#search", timeout=5000)
    except Exception:
        pass

    text = page.inner_text("body")[:3000]
    if looks_like_captcha(text):
        raise RuntimeError("CAPTCHA/blocked page detected on Google search")


def click_ai_mode(page) -> bool:
    selectors = [
        'a:has-text("AI Mode")',
        'button:has-text("AI Mode")',
        '[aria-label*="AI Mode" i]',
        '[role="tab"]:has-text("AI Mode")',
        'a[role="button"]:has-text("AI Mode")',
    ]
    for selector in selectors:
        try:
            loc = page.locator(selector)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(timeout=3000)
                return True
        except Exception:
            continue

    for selector in [
        'a:has-text("AI")',
        'button:has-text("AI")',
        'a:has-text("AI overview")',
        'button:has-text("AI overview")',
    ]:
        try:
            loc = page.locator(selector)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(timeout=2500)
                return True
        except Exception:
            continue

    return False


def wait_ai_content(page) -> None:
    start = time.time()
    last_len = 0
    stable_rounds = 0

    while (time.time() - start) * 1000 < AI_WAIT_MS:
        page.wait_for_timeout(400)
        text = page.inner_text("body")
        if looks_like_captcha(text):
            raise RuntimeError("CAPTCHA/blocked page detected after AI click")
        length = len(text)
        if length > 4000 and abs(length - last_len) < 200:
            stable_rounds += 1
        else:
            stable_rounds = 0
        last_len = length
        if stable_rounds >= 2:
            return

    raise PWTimeout("AI content did not stabilize in time")


def scroll_to_end(page) -> None:
    same_height_rounds = 0
    prev_height = 0

    for _ in range(MAX_SCROLL_ROUNDS):
        height = page.evaluate("() => document.body.scrollHeight")
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(SCROLL_PAUSE_SEC)

        new_height = page.evaluate("() => document.body.scrollHeight")
        if new_height <= height or new_height == prev_height:
            same_height_rounds += 1
        else:
            same_height_rounds = 0

        prev_height = new_height
        if same_height_rounds >= 3:
            break


def extract_sources(page) -> list[dict]:
    anchors = page.locator("a[href^='http']")
    links: list[tuple[str, str]] = []

    try:
        count = min(anchors.count(), 80)
        for index in range(count):
            anchor = anchors.nth(index)
            try:
                href = anchor.get_attribute("href") or ""
                title = (anchor.inner_text() or "").strip()[:250]
                if href and href.startswith("http"):
                    links.append((title, href))
            except Exception:
                continue
    except Exception:
        pass

    return normalize_sources(links)


def failed_item(
    product_key: str,
    reason: str,
    error: str,
    raw_text: str | None = None,
    source_url: str = GOOGLE_URL,
) -> dict:
    return NormalizedItem(
        product_key=product_key,
        value=None,
        unit=UNIT,
        status="FAILED",
        reason=reason,
        source=SOURCE_NAME,
        source_url=source_url,
        raw_text=raw_text[:1500] if raw_text else None,
        confidence=None,
        error=error,
    ).to_dict()


def scrape_one(page, product_key: str, commodity: str) -> dict:
    query = QUERY_TEMPLATE.format(commodity=commodity)
    try:
        google_search(page, query)
        clicked = click_ai_mode(page)
        if not clicked:
            text = page.inner_text("body")
            if looks_like_captcha(text):
                return failed_item(product_key, "CAPTCHA", "Captcha/blocked on Google results page", text)
            return failed_item(product_key, "NO_AI_MODE", "AI Mode button not found", text)

        wait_ai_content(page)
        scroll_to_end(page)
        text = page.inner_text("body")
        if looks_like_captcha(text):
            return failed_item(product_key, "CAPTCHA", "Captcha/blocked after entering AI Mode", text)

        sources = extract_sources(page)
        value, note = extract_inr_per_kg(text)
        source_url = sources[0]["url"] if sources else GOOGLE_URL
        if value is None:
            item = failed_item(product_key, "NO_DATA", "No INR/kg pattern matched in AI output", text, source_url)
        else:
            item = NormalizedItem(
                product_key=product_key,
                value=value,
                unit=UNIT,
                status="OK",
                reason="AI_MODE",
                source=SOURCE_NAME,
                source_url=source_url,
                raw_text=f"{note} | {text[:1450]}",
                confidence=0.42,
                error=None,
            ).to_dict()

        item["meta"]["query"] = query
        item["meta"]["aiModeClicked"] = True
        item["meta"]["sources"] = sources
        return item
    except PWTimeout as error:
        return failed_item(product_key, "TIMEOUT", str(error))
    except Exception as error:
        msg = str(error) or "Unknown error"
        reason = "BLOCKED" if any(term in msg.lower() for term in ["captcha", "blocked", "unusual traffic"]) else "ERROR"
        return failed_item(product_key, reason, msg)


def run_attempt(headless: bool) -> tuple[bool, list[dict], str | None]:
    attempt_items: list[dict] = []
    err = None

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1366, "height": 768},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")

        try:
            for product in PRODUCTS:
                log(f"[GOOGLE][headless={headless}] {product.product_key} -> {product.display_name}")
                attempt_items.append(scrape_one(page, product.product_key, product.display_name))
                time.sleep(DELAY_BETWEEN_PRODUCTS_SEC)
        except Exception as error:
            err = str(error) or "Unknown attempt error"
        finally:
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass

    ok = any(item.get("status") == "OK" for item in attempt_items)
    return ok, attempt_items, err


def build_failed_output(message: str) -> dict:
    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": [failed_item(product.product_key, "SCRAPER_ERROR", message) for product in PRODUCTS],
        "errors": [
            {
                "productKey": product.product_key,
                "error": message,
                "sourceUrl": GOOGLE_URL,
            }
            for product in PRODUCTS
        ],
    }


def run() -> dict:
    fetched_at = now_iso()
    force = FORCE_HEADLESS.strip().lower()
    attempts_plan = [True] if force in ("true", "1", "yes") else [False] if force in ("false", "0", "no") else [True]

    attempts_meta: list[dict] = []
    final_items: list[dict] | None = None

    for headless in attempts_plan:
        ok, items, error = run_attempt(headless=headless)
        attempts_meta.append({"headless": headless, "ok": ok, "error": error})
        if ok:
            final_items = items
            break
        if final_items is None:
            final_items = items

    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": fetched_at,
        "mode": {"attempts": attempts_meta},
        "items": final_items or [],
        "errors": [
            {
                "productKey": item["productKey"],
                "error": item.get("error") or item.get("reason") or "Unknown scraper failure.",
                "sourceUrl": item.get("sourceUrl") or GOOGLE_URL,
            }
            for item in (final_items or [])
            if item.get("status") != "OK"
        ],
    }
