"""
Google AI Mode Scraper (Playwright Chromium)

- Headless FIRST (for daily cron).
- If AI Mode fails / blocked / timeout -> retry with headless=False automatically.
- Prints JSON ONLY to stdout (safe for jq).
- Writes logs ONLY to stderr.

Output contract:
{
  "source": "Google (Playwright) - AI Mode",
  "fetchedAt": "ISO8601",
  "mode": {"attempts":[{"headless":true,"ok":true|false,"error": "..."}]},
  "items": [
    {
      "productKey": "...",
      "commodity": "...",
      "query": "...",
      "status": "OK"|"FAILED",
      "reason": "AI_MODE"|"NO_AI_MODE"|"BLOCKED"|"CAPTCHA"|"TIMEOUT"|"ERROR",
      "aiModeClicked": true|false,
      "rawText": "...." | null,
      "sources": [{"title":"...","url":"...","host":"..."}],
      "capturedAt": "ISO8601",
      "error": "..." | null
    }
  ]
}
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout


# -----------------------------
# CONFIG
# -----------------------------
PRODUCTS = [
    ("arabica_cherry", "Arabica Cherry"),
    ("arabica_parchment", "Arabica Parchment"),
    ("robusta_cherry", "Robusta Cherry"),
    ("robusta_parchment", "Robusta Parchment"),
    ("black_pepper", "Black pepper"),
    ("arecanut", "Arecanut"),
]

QUERY_TEMPLATE = '{commodity} Latest Price Today In Madikeri And The Latest Price Analysis'

GOOGLE_URL = "https://www.google.com/"
DEFAULT_TIMEOUT_MS = int(os.getenv("SCRAPER_TIMEOUT_MS", "60000"))
AI_WAIT_MS = int(os.getenv("SCRAPER_AI_WAIT_MS", "45000"))
SCROLL_PAUSE_SEC = float(os.getenv("SCRAPER_SCROLL_PAUSE_SEC", "1.0"))
MAX_SCROLL_ROUNDS = int(os.getenv("SCRAPER_MAX_SCROLL_ROUNDS", "18"))

# If you want to force always headless or always headed:
#   SCRAPER_HEADLESS=true/false
# Default: true (daily cron)
FORCE_HEADLESS = os.getenv("SCRAPER_HEADLESS")
if FORCE_HEADLESS is None:
    FORCE_HEADLESS = "true"


def log(msg: str):
    # logs ONLY to stderr so stdout remains pure JSON for jq
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def iso_now():
    return datetime.now(timezone.utc).isoformat()


def looks_like_captcha(text: str) -> bool:
    t = (text or "").lower()
    return any(
        kw in t
        for kw in [
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


def normalize_sources(links):
    out = []
    seen = set()
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


def dismiss_google_consent(page):
    # Best-effort: handle EU/consent banners
    candidates = [
        'button:has-text("I agree")',
        'button:has-text("Accept all")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'button:has-text("Reject all")',  # if you want reject, but accept is more stable
        'div[role="dialog"] button:has-text("I agree")',
    ]
    for sel in candidates:
        try:
            btn = page.locator(sel)
            if btn.count() > 0 and btn.first.is_visible():
                btn.first.click(timeout=2000)
                time.sleep(0.5)
                return
        except Exception:
            pass


def google_search(page, query: str):
    page.goto(GOOGLE_URL, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
    dismiss_google_consent(page)

    # Google search box selectors
    box_selectors = [
        'textarea[name="q"]',
        'input[name="q"]',
        'form[role="search"] textarea',
        'form[role="search"] input[type="text"]',
    ]

    box = None
    for sel in box_selectors:
        try:
            page.wait_for_selector(sel, timeout=8000)
            box = page.locator(sel).first
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

    # Results page indicators
    page.wait_for_load_state("domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
    # Try to wait for results region
    try:
        page.wait_for_selector("#search", timeout=20000)
    except Exception:
        # sometimes different layout; still proceed
        pass

    # quick captcha detection
    t = page.inner_text("body")[:3000]
    if looks_like_captcha(t):
        raise RuntimeError("CAPTCHA/blocked page detected on Google search")


def click_ai_mode(page):
    """
    Best-effort click for "AI Mode".
    Google UI differs by region/rollout; we try multiple heuristics:
      - button/link text contains "AI Mode"
      - aria-label contains "AI Mode"
      - data attributes if present
    Returns True if clicked.
    """
    selectors = [
        'a:has-text("AI Mode")',
        'button:has-text("AI Mode")',
        '[aria-label*="AI Mode" i]',
        '[role="tab"]:has-text("AI Mode")',
        'a[role="button"]:has-text("AI Mode")',
    ]

    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(timeout=3000)
                return True
        except Exception:
            continue

    # Sometimes it appears as just "AI" or "AI overview" style label
    fallback_selectors = [
        'a:has-text("AI")',
        'button:has-text("AI")',
        'a:has-text("AI overview")',
        'button:has-text("AI overview")',
    ]
    for sel in fallback_selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(timeout=2500)
                return True
        except Exception:
            continue

    return False


def wait_ai_content(page):
    """
    Wait until AI content appears.
    Because AI Mode DOM is not stable, we use a robust strategy:
      - wait for network idle-ish
      - wait until body text grows / contains meaningful content
    """
    start = time.time()
    last_len = 0
    stable_rounds = 0

    while (time.time() - start) * 1000 < AI_WAIT_MS:
        page.wait_for_timeout(800)
        text = page.inner_text("body")
        if looks_like_captcha(text):
            raise RuntimeError("CAPTCHA/blocked page detected after AI click")
        l = len(text)
        if l > 4000 and abs(l - last_len) < 200:
            stable_rounds += 1
        else:
            stable_rounds = 0
        last_len = l
        if stable_rounds >= 2:
            return
    raise PWTimeout("AI content did not stabilize in time")


def scroll_to_end(page):
    """
    Scroll until height stops increasing.
    """
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


def extract_sources(page):
    """
    Extract top links as sources (title + href).
    We keep it generic and safe:
      - collect visible anchors with http(s) links
      - dedupe
    """
    anchors = page.locator("a[href^='http']")
    links = []
    try:
        count = min(anchors.count(), 80)
        for i in range(count):
            a = anchors.nth(i)
            try:
                href = a.get_attribute("href") or ""
                title = (a.inner_text() or "").strip()
                # ignore huge nav titles
                if len(title) > 250:
                    title = title[:250]
                if href and href.startswith("http"):
                    links.append((title, href))
            except Exception:
                continue
    except Exception:
        pass
    return normalize_sources(links)


def scrape_one(page, product_key: str, commodity: str):
    query = QUERY_TEMPLATE.format(commodity=commodity)
    captured_at = iso_now()

    item = {
        "productKey": product_key,
        "commodity": commodity,
        "query": query,
        "status": "FAILED",
        "reason": "ERROR",
        "aiModeClicked": False,
        "rawText": None,
        "sources": [],
        "capturedAt": captured_at,
        "error": None,
    }

    try:
        google_search(page, query)

        # click AI Mode
        clicked = click_ai_mode(page)
        item["aiModeClicked"] = clicked

        if not clicked:
            # fallback: return normal results text (still useful)
            text = page.inner_text("body")
            if looks_like_captcha(text):
                item["reason"] = "CAPTCHA"
                item["error"] = "Captcha/blocked on Google results page"
                return item

            item["reason"] = "NO_AI_MODE"
            item["status"] = "FAILED"
            item["rawText"] = text[:25000]  # cap to keep DB sane
            item["sources"] = extract_sources(page)
            item["error"] = "AI Mode button not found"
            return item

        # wait for AI content
        wait_ai_content(page)

        # scroll for full content
        scroll_to_end(page)

        # extract text + sources
        text = page.inner_text("body")
        if looks_like_captcha(text):
            item["reason"] = "CAPTCHA"
            item["error"] = "Captcha/blocked after entering AI Mode"
            return item

        item["status"] = "OK"
        item["reason"] = "AI_MODE"
        item["rawText"] = text[:50000]  # larger cap because AI can be long
        item["sources"] = extract_sources(page)
        item["error"] = None
        return item

    except PWTimeout as e:
        item["status"] = "FAILED"
        item["reason"] = "TIMEOUT"
        item["error"] = str(e)
        return item
    except Exception as e:
        msg = str(e) or "Unknown error"
        item["status"] = "FAILED"
        if "captcha" in msg.lower() or "blocked" in msg.lower() or "unusual traffic" in msg.lower():
            item["reason"] = "BLOCKED"
        else:
            item["reason"] = "ERROR"
        item["error"] = msg
        return item


def run_attempt(headless: bool):
    """
    One browser attempt.
    Returns (ok, items, errorMessage)
    ok = True means: at least 1 item got OK in AI mode
    """
    attempt_items = []
    err = None

    with sync_playwright() as p:
        browser = p.chromium.launch(
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

        # light stealth
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")

        try:
            for pk, name in PRODUCTS:
                log(f"[GOOGLE][headless={headless}] {pk} -> {name}")
                item = scrape_one(page, pk, name)
                attempt_items.append(item)

                # small delay between searches
                time.sleep(2.0)

        except Exception as e:
            err = str(e) or "Unknown attempt error"
        finally:
            try:
                context.close()
            except Exception:
                pass
            try:
                browser.close()
            except Exception:
                pass

    ok = any(it.get("status") == "OK" and it.get("reason") == "AI_MODE" for it in attempt_items)
    return ok, attempt_items, err


def main():
    fetched_at = iso_now()

    # Decide attempt order:
    # - If forced, do only one mode
    # - Otherwise: headless first, then headed fallback if headless fails
    force = (FORCE_HEADLESS or "").strip().lower()
    attempts_plan = []
    if force in ("true", "1", "yes"):
        attempts_plan = [True]
    elif force in ("false", "0", "no"):
        attempts_plan = [False]
    else:
        attempts_plan = [True, False]

    attempts_meta = []
    final_items = None

    for headless in attempts_plan:
        ok, items, err = run_attempt(headless=headless)
        attempts_meta.append({"headless": headless, "ok": ok, "error": err})

        # If this attempt produced useful AI results, stop.
        # Otherwise fallback to next mode.
        if ok:
            final_items = items
            break

        # Even if not ok, keep the items from headless attempt.
        # If there's no second attempt, we’ll return these.
        if final_items is None:
            final_items = items

    out = {
        "source": "Google (Playwright) - AI Mode",
        "fetchedAt": fetched_at,
        "mode": {"attempts": attempts_meta},
        "items": final_items or [],
    }

    # IMPORTANT: JSON only to stdout
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.flush()


if __name__ == "__main__":
    main()