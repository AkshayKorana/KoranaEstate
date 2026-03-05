"""
Bing Price Scraper (Playwright) - headless-first, auto-fallback to headful if BLOCKED or too many TIMEOUTs.
Prints ONLY JSON to stdout (logs to stderr).
"""

import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional, Tuple, List

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

PRODUCTS = [
    ("arabica_cherry", "Arabica Cherry"),
    ("arabica_parchment", "Arabica Parchment"),
    ("robusta_cherry", "Robusta Cherry"),
    ("robusta_parchment", "Robusta Parchment"),
    ("black_pepper", "Black Pepper"),
    ("arecanut", "Arecanut"),
]

UNIT = "INR/kg"

MAX_BLOCKED_BEFORE_FALLBACK = int(os.getenv("MAX_BLOCKED_BEFORE_FALLBACK", "2"))
MAX_TIMEOUT_BEFORE_FALLBACK = int(os.getenv("MAX_TIMEOUT_BEFORE_FALLBACK", "2"))
MAX_RETRIES_PER_PRODUCT = int(os.getenv("MAX_RETRIES_PER_PRODUCT", "1"))

DELAY_BETWEEN_PRODUCTS_MIN = float(os.getenv("DELAY_BETWEEN_PRODUCTS_MIN", "6"))
DELAY_BETWEEN_PRODUCTS_MAX = float(os.getenv("DELAY_BETWEEN_PRODUCTS_MAX", "14"))
DELAY_BETWEEN_RETRIES_MIN = float(os.getenv("DELAY_BETWEEN_RETRIES_MIN", "15"))
DELAY_BETWEEN_RETRIES_MAX = float(os.getenv("DELAY_BETWEEN_RETRIES_MAX", "35"))

NAV_TIMEOUT_MS = int(os.getenv("NAV_TIMEOUT_MS", "60000"))
RESULTS_TIMEOUT_MS = int(os.getenv("RESULTS_TIMEOUT_MS", "45000"))

SCRAPER_HEADLESS_ENV = os.getenv("SCRAPER_HEADLESS", "").strip().lower()

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def looks_blocked(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    markers = [
        "unusual traffic",
        "verify you are a human",
        "help us verify",
        "captcha",
        "our systems have detected",
        "blocked",
        "access denied",
        "robot",
        "sorry, something went wrong",
        "why did this happen",
    ]
    return any(m in t for m in markers)

def looks_consent_or_interstitial(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    # Bing sometimes returns consent pages / interstitial flows
    markers = [
        "cookie",
        "privacy",
        "consent",
        "before you continue",
        "accept",
        "agree",
        "microsoft privacy",
        "choices",
    ]
    return any(m in t for m in markers)

def build_query(name: str) -> str:
    templates = [
        "{name} price today per kg Madikeri Kodagu",
        "latest {name} rate per kg Kodagu Karnataka",
        "{name} market price INR per kg Karnataka",
        "{name} price today INR/kg Kodagu",
    ]
    return random.choice(templates).format(name=name)

def extract_inr_per_kg(text: str) -> Tuple[Optional[float], Optional[str]]:
    patterns = [
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*(?:kg|KG|kilogram)",
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*per\s*(?:kg|kilogram)",
        r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG",
        r"₹\s*([\d,]+)\s*(?:to|-)\s*₹\s*([\d,]+)\s*per\s*50\s*kg",
        r"Rs\.?\s*([\d,]+)\s*(?:to|-)\s*Rs\.?\s*([\d,]+)\s*per\s*50\s*kg",
        # extra: "Rs 520 / PER KG"
        r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*PER\s*KG",
    ]

    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if not m:
            continue

        if m.lastindex == 2:
            lo = float(m.group(1).replace(",", ""))
            hi = float(m.group(2).replace(",", ""))
            return round(((lo + hi) / 2.0) / 50.0, 2), f"range 50kg ₹{lo}-{hi}"

        val = float(m.group(1).replace(",", ""))
        if val > 1000:
            return round(val / 50.0, 2), f"50kg bag ₹{val}"
        return round(val, 2), f"per kg ₹{val}"

    return None, None

def new_context(browser):
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 720},
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        user_agent=random.choice(USER_AGENTS),
    )
    page = ctx.new_page()
    page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
    return ctx, page

def try_accept_banners(page) -> None:
    # best-effort cookie/consent clicks
    candidates = [
        'button:has-text("Accept")',
        'button:has-text("I agree")',
        'button:has-text("Agree")',
        'button:has-text("OK")',
    ]
    for sel in candidates:
        try:
            btn = page.locator(sel).first
            if btn.count() > 0:
                btn.click(timeout=1200)
                time.sleep(0.5)
                break
        except Exception:
            continue

def fetch_bing_text(page, query: str) -> Tuple[Optional[str], str]:
    """
    Returns (snippets_text_or_none, debug_text)
    """
    url = "https://www.bing.com/search?q=" + re.sub(r"\s+", "+", query.strip())
    page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
    try_accept_banners(page)

    # IMPORTANT:
    # do NOT require visibility — only require that results are attached OR page shows gating
    page.wait_for_load_state("networkidle", timeout=RESULTS_TIMEOUT_MS)

    html = page.content()
    quick_text = (page.locator("body").inner_text(timeout=3000) or "")[:4000]
    debug = (quick_text + "\n\n---HTML_HEAD---\n" + html[:1200])[:5200]

    # detect block/consent fast
    if looks_blocked(debug):
        return None, debug
    if looks_consent_or_interstitial(debug):
        # Try again after clicking banners once more
        try_accept_banners(page)
        time.sleep(1.0)

    # Wait for at least one result block to be ATTACHED (not visible)
    try:
        page.wait_for_selector("#b_results li.b_algo", state="attached", timeout=RESULTS_TIMEOUT_MS)
    except Exception:
        # If no li.b_algo, still return debug; caller will label as TIMEOUT/NO_DATA
        return None, debug

    # Extract several result blocks text
    blocks: List[str] = []
    for i in range(5):
        try:
            t = page.locator("#b_results li.b_algo").nth(i).inner_text(timeout=2500)
            if t:
                blocks.append(t)
        except Exception:
            continue

    # answer/context box (sometimes has price)
    for sel in ["#b_context", "#b_ans"]:
        try:
            t = page.locator(sel).inner_text(timeout=1500)
            if t:
                blocks.append(t)
        except Exception:
            pass

    snippets = "\n\n".join(blocks).strip()
    return (snippets if snippets else None), debug

def scrape_pass(headless: bool, products_subset):
    items = []
    blocked_count = 0
    timeout_count = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        ctx, page = new_context(browser)

        for product_key, name in products_subset:
            query = build_query(name)
            log(f"[{ 'HEADLESS' if headless else 'HEADFUL' }] {product_key} -> {query}")

            success = False
            for attempt in range(MAX_RETRIES_PER_PRODUCT + 1):
                try:
                    time.sleep(random.uniform(1.0, 2.0))
                    snippets, debug = fetch_bing_text(page, query)

                    if snippets is None and looks_blocked(debug):
                        blocked_count += 1
                        log(f"BLOCKED for {product_key} (attempt {attempt+1})")
                        # reset context
                        try:
                            ctx.close()
                        except Exception:
                            pass
                        ctx, page = new_context(browser)

                        if attempt < MAX_RETRIES_PER_PRODUCT:
                            sleep_s = random.uniform(DELAY_BETWEEN_RETRIES_MIN, DELAY_BETWEEN_RETRIES_MAX)
                            log(f"Retrying after {sleep_s:.1f}s...")
                            time.sleep(sleep_s)
                            continue

                        items.append({
                            "productKey": product_key,
                            "value": None,
                            "unit": UNIT,
                            "rawText": None,
                            "confidence": None,
                            "status": "FAILED",
                            "reason": "BLOCKED",
                            "error": "Bing blocked/verification page detected",
                        })
                        success = True
                        break

                    if snippets is None:
                        timeout_count += 1
                        items.append({
                            "productKey": product_key,
                            "value": None,
                            "unit": UNIT,
                            "rawText": debug[:1500] if debug else None,
                            "confidence": None,
                            "status": "FAILED",
                            "reason": "TIMEOUT",
                            "error": f"No results detected within timeout ({RESULTS_TIMEOUT_MS}ms)",
                        })
                        success = True
                        break

                    value, note = extract_inr_per_kg(snippets)
                    if value is None:
                        items.append({
                            "productKey": product_key,
                            "value": None,
                            "unit": UNIT,
                            "rawText": snippets[:1500],
                            "confidence": None,
                            "status": "FAILED",
                            "reason": "NO_DATA",
                            "error": "No INR/kg pattern matched",
                        })
                    else:
                        items.append({
                            "productKey": product_key,
                            "value": value,
                            "unit": UNIT,
                            "rawText": (note + " | " + snippets[:1400])[:1500],
                            "confidence": 0.6,
                            "status": "OK",
                        })

                    success = True
                    break

                except PWTimeout as e:
                    timeout_count += 1
                    items.append({
                        "productKey": product_key,
                        "value": None,
                        "unit": UNIT,
                        "rawText": None,
                        "confidence": None,
                        "status": "FAILED",
                        "reason": "TIMEOUT",
                        "error": str(e),
                    })
                    success = True
                    break

                except Exception as e:
                    items.append({
                        "productKey": product_key,
                        "value": None,
                        "unit": UNIT,
                        "rawText": None,
                        "confidence": None,
                        "status": "FAILED",
                        "reason": "ERROR",
                        "error": str(e),
                    })
                    success = True
                    break

            if not success:
                items.append({
                    "productKey": product_key,
                    "value": None,
                    "unit": UNIT,
                    "rawText": None,
                    "confidence": None,
                    "status": "FAILED",
                    "reason": "ERROR",
                    "error": "Unknown failure",
                })

            sleep_between = random.uniform(DELAY_BETWEEN_PRODUCTS_MIN, DELAY_BETWEEN_PRODUCTS_MAX)
            log(f"Sleeping {sleep_between:.1f}s...")
            time.sleep(sleep_between)

        try:
            ctx.close()
        except Exception:
            pass
        browser.close()

    return items, blocked_count, timeout_count

def run():
    fetched_at = now_iso()
    out = {"source": "Bing (Playwright)", "fetchedAt": fetched_at, "items": []}

    if SCRAPER_HEADLESS_ENV in ("true", "1", "yes"):
        initial_headless = True
    elif SCRAPER_HEADLESS_ENV in ("false", "0", "no"):
        initial_headless = False
    else:
        initial_headless = True

    items1, blocked1, timeout1 = scrape_pass(initial_headless, PRODUCTS)
    out["items"].extend(items1)

    need_fallback = False
    if initial_headless and blocked1 >= MAX_BLOCKED_BEFORE_FALLBACK:
        need_fallback = True
    if initial_headless and timeout1 >= MAX_TIMEOUT_BEFORE_FALLBACK:
        need_fallback = True

    if need_fallback:
        remaining = []
        for i in out["items"]:
            if i.get("status") == "FAILED" and i.get("reason") in ("BLOCKED", "TIMEOUT"):
                pk = i["productKey"]
                name = next((n for (k, n) in PRODUCTS if k == pk), None)
                if name:
                    remaining.append((pk, name))

        if remaining:
            log(f"Fallback to HEADFUL for {len(remaining)} items...")
            out["items"] = [i for i in out["items"] if not (i.get("status") == "FAILED" and i.get("reason") in ("BLOCKED", "TIMEOUT"))]
            items2, _b2, _t2 = scrape_pass(False, remaining)
            out["items"].extend(items2)

    order = {k: idx for idx, (k, _n) in enumerate(PRODUCTS)}
    out["items"].sort(key=lambda x: order.get(x.get("productKey", ""), 999))

    print(json.dumps(out, ensure_ascii=False))

if __name__ == "__main__":
    run()