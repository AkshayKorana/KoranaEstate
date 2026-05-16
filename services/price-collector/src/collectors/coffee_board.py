from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import time
from datetime import datetime, timezone
from typing import Any

from pypdf import PdfReader
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from config import COFFEE_PRODUCT_KEYS, CommodityConfig, get_active_commodities
from models import build_error, build_item, now_iso

REPORT_PAGE_URL = "https://coffeeboard.gov.in/Market_Info.aspx"
PAYLOAD_SOURCE = "Coffee Board India"
REPORT_TITLE = "Daily Coffee Market Report"
PDF_SELECTORS = [
    "input[name='pdf_click']",
    "input#pdf_click",
    "input[value*='Daily report']",
]
PAGE_LOAD_TIMEOUT_MS = 60_000
DOWNLOAD_TIMEOUT_MS = 60_000
DIRECT_DOWNLOAD_TIMEOUT_S = 30  # urllib timeout in seconds
MAX_RETRIES = 0  # NestJS handles retries — no internal retry loop

DATE_PATTERN = re.compile(
    r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
PAGE_REPORT_DATE_PATTERN = re.compile(
    r"([A-Za-z]+\s+[A-Za-z]+\s+\d{2},\s+\d{4})",
    re.IGNORECASE,
)
SECTION_PATTERN = re.compile(
    r"(Raw\s+Coffee\s+Price(?:s)?(?:\s+in)?\s+\(?(?:Karnataka)?\)?(?:\s+as\s+on)?[\s\S]{0,2600}?)"
    r"(?=Market\s+Analysis|ICE|ICO|Exchange\s+Rate|Indian\s+Market|$)",
    re.IGNORECASE,
)
NUMBER_PATTERN = re.compile(r"(?:₹|rs\.?|inr)?\s*(\d{2,6}(?:,\d{3})*(?:\.\d+)?)", re.IGNORECASE)
KG_VALUE_PATTERN = re.compile(
    r"(?:₹|rs\.?|inr)?\s*(\d{2,4}(?:,\d{3})*(?:\.\d+)?)\s*(?:/|per)?\s*kg\b",
    re.IGNORECASE,
)
RANGE_PATTERN = re.compile(
    r"(?:₹|rs\.?|inr)?\s*(\d{3,6}(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?:₹|rs\.?|inr)?\s*(\d{3,6}(?:,\d{3})*(?:\.\d+)?)",
    re.IGNORECASE,
)
RAW_COFFEE_TABLE_PATTERN = re.compile(
    r"Raw\s+Coffee\s+Price.*?Ar\.?\s*Pmt\s+Ar\.?\s*Ch[yv]\s+Rob\.?\s*Pmt\s+Rob\.?\s*Ch[yv]\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)",
    re.IGNORECASE | re.DOTALL,
)
# Directly matches the 'Price as on DD.MM.YYYY in Rs/50' table.
# Tolerates OCR variants: Chv↔Chy, optional spaces/dots.
PRICE_TABLE_BY_DATE_PATTERN = re.compile(
    r"(?:Price\s+as\s+on|in\s+Rs\s*/\s*50).*?"
    r"Ar\.?\s*Pmt\s+Ar\.?\s*Ch[yv]\s+Rob\.?\s*Pmt\s+Rob\.?\s*Ch[yv]\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)\s+"
    r"(\d{3,6}(?:,\d{3})?)\s*(?:-|–|—|to)\s*(\d{3,6}(?:,\d{3})?)",
    re.IGNORECASE | re.DOTALL,
)

PRODUCT_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "arabica_cherry": (
        re.compile(r"arabica\s*cherry", re.IGNORECASE),
        re.compile(r"ar\s*\.?\s*ch[yv]", re.IGNORECASE),  # tolerate OCR Chv/Chy
    ),
    "arabica_parchment": (
        re.compile(r"arabica\s*parchment", re.IGNORECASE),
        re.compile(r"arabica\s*plantation", re.IGNORECASE),
        re.compile(r"ar\s*\.?\s*pmt", re.IGNORECASE),
    ),
    "robusta_cherry": (
        re.compile(r"robusta\s*cherry", re.IGNORECASE),
        re.compile(r"rob\s*\.?\s*chy", re.IGNORECASE),
    ),
    "robusta_parchment": (
        re.compile(r"robusta\s*parchment", re.IGNORECASE),
        re.compile(r"rob\s*\.?\s*pmt", re.IGNORECASE),
    ),
}

PRODUCT_DISPLAY_NAMES = {
    commodity.product_key: commodity.display_name
    for commodity in get_active_commodities()
}


def log(message: str) -> None:
    print(message, file=sys.stderr)


def is_coffee_commodity(commodity: CommodityConfig) -> bool:
    return commodity.product_key in COFFEE_PRODUCT_KEYS


def normalize_space(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_pdf_text(text: str | None) -> str:
    return normalize_space(text).lower()


def parse_number(raw_value: str) -> float:
    return float(raw_value.replace(",", ""))


def extract_report_date(*texts: str) -> tuple[str | None, str | None]:
    for text in texts:
        match = DATE_PATTERN.search(text or "")
        if not match:
            continue
        pretty = f"{match.group(1).title()} {int(match.group(2))}, {match.group(3)}"
        parsed = datetime.strptime(pretty, "%B %d, %Y").replace(tzinfo=timezone.utc)
        return pretty, parsed.isoformat()
    return None, None


def extract_page_report_date(page_text: str) -> tuple[str, str]:
    match = PAGE_REPORT_DATE_PATTERN.search(page_text)
    if not match:
        raise RuntimeError("Failed to extract report date")

    report_date_str = normalize_space(match.group(1))
    parsed = datetime.strptime(report_date_str, "%A %B %d, %Y").replace(tzinfo=timezone.utc)
    return report_date_str, parsed.isoformat()


def build_report_fingerprint(report_date: str | None, file_name: str | None, pdf_text: str) -> str:
    digest_source = "||".join([normalize_space(report_date), normalize_space(file_name), normalize_space(pdf_text)])
    return hashlib.sha256(digest_source.encode("utf-8")).hexdigest()


def extract_pdf_text(file_path: str) -> str:
    reader = PdfReader(file_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_nearest_value(text: str, product_key: str) -> tuple[float | None, str | None, str | None]:
    patterns = PRODUCT_PATTERNS[product_key]
    best_match: tuple[int, float, str | None] | None = None

    for pattern in patterns:
        for label_match in pattern.finditer(text):
            window_start = max(0, label_match.start() - 40)
            window_end = min(len(text), label_match.end() + 220)
            window_text = text[window_start:window_end]
            relative_label_index = label_match.start() - window_start

            for candidate in KG_VALUE_PATTERN.finditer(window_text):
                value = round(parse_number(candidate.group(1)), 2)
                if value <= 0:
                    continue
                distance = min(abs(candidate.start() - relative_label_index), abs(candidate.end() - relative_label_index))
                if best_match is None or distance < best_match[0]:
                    best_match = (distance, value, f"₹{value:,.2f} per kg")

            for candidate in RANGE_PATTERN.finditer(window_text):
                low = parse_number(candidate.group(1))
                high = parse_number(candidate.group(2))
                if low <= 0 or high <= 0 or high < low:
                    continue
                midpoint = round(((low + high) / 2.0) / 50.0, 2) if max(low, high) > 1000 else round((low + high) / 2.0, 2)
                distance = min(abs(candidate.start() - relative_label_index), abs(candidate.end() - relative_label_index))
                display = f"₹{low:,.0f}–₹{high:,.0f} per 50 kg" if max(low, high) > 1000 else f"₹{low:,.2f}–₹{high:,.2f} per kg"
                if best_match is None or distance < best_match[0]:
                    best_match = (distance, midpoint, display)

            if best_match is None:
                numeric_candidates: list[tuple[int, float, str | None]] = []
                for candidate in NUMBER_PATTERN.finditer(window_text):
                    value = parse_number(candidate.group(1))
                    if value <= 0:
                        continue
                    normalized_value = round(value / 50.0, 2) if value > 1000 else round(value, 2)
                    distance = min(abs(candidate.start() - relative_label_index), abs(candidate.end() - relative_label_index))
                    display = f"₹{value:,.0f} per 50 kg" if value > 1000 else f"₹{normalized_value:,.2f} per kg"
                    numeric_candidates.append((distance, normalized_value, display))
                if numeric_candidates:
                    numeric_candidates.sort(key=lambda item: item[0])
                    best_match = numeric_candidates[0]

    if best_match is None:
        return None, None, f"No nearby numeric INR/kg value found for {product_key}."

    return best_match[1], best_match[2], None


def extract_section(text: str) -> str:
    match = SECTION_PATTERN.search(text)
    return match.group(1) if match else text


def extract_raw_coffee_table_prices(pdf_text: str) -> dict[str, tuple[float, str]]:
    # Try the most specific pattern first (Price as on DD.MM.YYYY in Rs/50),
    # then fall back to the generic Raw Coffee Price header pattern.
    match = PRICE_TABLE_BY_DATE_PATTERN.search(pdf_text) or RAW_COFFEE_TABLE_PATTERN.search(pdf_text)
    if not match:
        return {}

    product_keys = [
        "arabica_parchment",
        "arabica_cherry",
        "robusta_parchment",
        "robusta_cherry",
    ]
    values = [parse_number(match.group(index)) for index in range(1, 9)]
    parsed: dict[str, tuple[float, str]] = {}

    for offset, product_key in enumerate(product_keys):
        low = values[offset * 2]
        high = values[offset * 2 + 1]
        midpoint = round(((low + high) / 2.0) / 50.0, 2)
        parsed[product_key] = (
            midpoint,
            f"₹{low:,.0f}–₹{high:,.0f} per 50 kg",
            low,
            high,
        )

    return parsed


def parse_products_from_pdf_text(pdf_text: str) -> dict[str, Any]:
    try:
        if not pdf_text or len(pdf_text.strip()) < 100:
            raise RuntimeError("PDF content too small or corrupted")
        normalized_pdf_text = normalize_pdf_text(pdf_text)
        section_text = normalize_pdf_text(extract_section(pdf_text))
        table_prices = extract_raw_coffee_table_prices(pdf_text)
        products: list[dict[str, Any]] = []
        failures: dict[str, str] = {}

        for product_key in (
            "arabica_cherry",
            "arabica_parchment",
            "robusta_cherry",
            "robusta_parchment",
        ):
            failure_reason = None
            table_match = table_prices.get(product_key)
            price_min50kg: float | None = None
            price_max50kg: float | None = None
            if table_match:
                value, range_display, price_min50kg, price_max50kg = table_match
            else:
                value, range_display, failure_reason = extract_nearest_value(section_text, product_key)
                if value is None:
                    value, range_display, failure_reason = extract_nearest_value(normalized_pdf_text, product_key)

            if value is None and failure_reason:
                failures[product_key] = failure_reason
                log(f"[COFFEE_BOARD] parse failure product={product_key} reason={failure_reason}")

            products.append(
                {
                    "productKey": product_key,
                    "displayName": PRODUCT_DISPLAY_NAMES.get(product_key, product_key),
                    "value": value,
                    "status": "SUCCESS" if value is not None else "FAILED",
                    "rangeDisplay": range_display,
                    "priceMin50kg": price_min50kg,
                    "priceMax50kg": price_max50kg,
                }
            )

        log("PDF parsed")
        log(f"Prices extracted: {json.dumps([{ 'productKey': item['productKey'], 'value': item['value'] } for item in products])}")

        return {
            "products": products,
            "source": PAYLOAD_SOURCE,
            "success": all(item["value"] is not None for item in products),
            "rawText": pdf_text,
            "error": None,
            "failures": failures,
        }
    except Exception as error:  # noqa: BLE001
        log(f"[COFFEE_BOARD] PDF parsing failed: {error}")
        return {
            "products": [
                {
                    "productKey": product_key,
                    "displayName": PRODUCT_DISPLAY_NAMES.get(product_key, product_key),
                    "value": None,
                    "status": "FAILED",
                    "rangeDisplay": None,
                }
                for product_key in (
                    "arabica_cherry",
                    "arabica_parchment",
                    "robusta_cherry",
                    "robusta_parchment",
                )
            ],
            "source": PAYLOAD_SOURCE,
            "success": False,
            "rawText": None,
            "error": str(error),
            "failures": {
                product_key: str(error)
                for product_key in (
                    "arabica_cherry",
                    "arabica_parchment",
                    "robusta_cherry",
                    "robusta_parchment",
                )
            },
        }


def download_report_pdf() -> dict[str, Any]:
    """
    Download Coffee Board report PDF.
    Strategy:
    1. Extract PDF URL directly from page HTML (most reliable)
    2. Fall back to clicking button if URL extraction fails
    """
    import urllib.request
    import urllib.error
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        temp_path = ""
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                context = browser.new_context(accept_downloads=True, locale="en-IN", timezone_id="Asia/Kolkata")
                page = context.new_page()
                try:
                    log("[COFFEE_BOARD] Opening Coffee Board page")
                    page.goto(REPORT_PAGE_URL, wait_until="domcontentloaded", timeout=PAGE_LOAD_TIMEOUT_MS)
                    page_text = page.locator("body").inner_text(timeout=5_000)
                    if REPORT_TITLE.lower() not in page_text.lower():
                        raise RuntimeError("Failed to detect Daily Coffee Market Report")
                    report_date_str, report_date_iso = extract_page_report_date(page_text)

                    # STRATEGY 1: Extract PDF URL directly from page HTML
                    log("[COFFEE_BOARD] Attempting direct PDF URL extraction")
                    page_html = page.content()
                    pdf_url = None
                    
                    # Look for common PDF link patterns
                    pdf_patterns = [
                        r'href=["\']([^"\']*\.pdf[^"\']*)["\']',
                        r'src=["\']([^"\']*\.pdf[^"\']*)["\']',
                        r'url\s*[:\(]\s*["\']?([^"\')\s]+\.pdf[^"\')\s]*)',
                    ]
                    
                    for pattern in pdf_patterns:
                        matches = re.findall(pattern, page_html, re.IGNORECASE)
                        if matches:
                            pdf_url = matches[0]
                            break
                    
                    # Normalize PDF URL
                    if pdf_url:
                        if not pdf_url.startswith("http"):
                            pdf_url = "https://coffeeboard.gov.in" + (pdf_url if pdf_url.startswith("/") else "/" + pdf_url)
                        log(f"[COFFEE_BOARD] Extracted PDF URL: {pdf_url}")
                        
                        # Download PDF directly
                        try:
                            log("[COFFEE_BOARD] Downloading PDF from extracted URL")
                            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                                temp_path = temp_file.name
                            with urllib.request.urlopen(pdf_url, timeout=DIRECT_DOWNLOAD_TIMEOUT_S) as response:
                                with open(temp_path, "wb") as f:
                                    f.write(response.read())
                            log("[COFFEE_BOARD] PDF downloaded successfully via direct URL")
                            
                            return {
                                "downloadPath": temp_path,
                                "pageText": page_text,
                                "reportDate": report_date_str,
                                "reportDateIso": report_date_iso,
                                "pdfUrl": pdf_url,
                                "suggestedFileName": "coffee-board-report.pdf",
                                "fetchedAt": now_iso(),
                            }
                        except (urllib.error.URLError, urllib.error.HTTPError) as e:
                            log(f"[COFFEE_BOARD] Direct URL download failed: {e}. Falling back to button click.")
                            if temp_path and os.path.exists(temp_path):
                                try:
                                    os.unlink(temp_path)
                                except OSError:
                                    pass
                            temp_path = ""

                    # STRATEGY 2: Fall back to clicking the button
                    log("[COFFEE_BOARD] Using fallback: clicking download button")
                    download = None
                    for selector in PDF_SELECTORS:
                        try:
                            page.wait_for_selector(selector, timeout=5_000)
                            with page.expect_download(timeout=DOWNLOAD_TIMEOUT_MS) as download_info:
                                page.click(selector, timeout=PAGE_LOAD_TIMEOUT_MS)
                            download = download_info.value
                            break
                        except Exception as error:  # noqa: BLE001
                            log(f"[COFFEE_BOARD] Selector failed: {selector}, reason: {error}")
                            continue

                    if not download:
                        log("[COFFEE_BOARD] CRITICAL: Coffee Board PDF button not found")
                        raise RuntimeError("PDF download trigger failed")

                    pdf_path = download.path()
                    if not pdf_path:
                        raise RuntimeError("Playwright download did not provide a PDF path.")
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                        temp_path = temp_file.name
                    shutil.copyfile(pdf_path, temp_path)
                    log("[COFFEE_BOARD] PDF downloaded via button click")

                    pdf_url = download.url or REPORT_PAGE_URL
                    suggested_filename = download.suggested_filename or "coffee-board-report.pdf"

                    return {
                        "downloadPath": temp_path,
                        "pageText": page_text,
                        "reportDate": report_date_str,
                        "reportDateIso": report_date_iso,
                        "pdfUrl": pdf_url,
                        "suggestedFileName": suggested_filename,
                        "fetchedAt": now_iso(),
                    }
                finally:
                    context.close()
                    browser.close()
        except (PlaywrightTimeoutError, Exception) as error:  # noqa: BLE001
            last_error = error
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass
            if attempt < MAX_RETRIES:
                backoff_seconds = (attempt + 1) * 2
                log(f"[COFFEE_BOARD] Retry attempt {attempt + 1}/{MAX_RETRIES + 1}, reason: {error}")
                time.sleep(backoff_seconds)

    raise RuntimeError(str(last_error) if last_error else "Unable to download Coffee Board PDF.")


def fetch_latest_report() -> dict[str, Any]:
    download_result = download_report_pdf()
    download_path = download_result["downloadPath"]

    try:
        pdf_text = extract_pdf_text(download_path)
        parsed = parse_products_from_pdf_text(pdf_text)
    finally:
        try:
            os.unlink(download_path)
        except OSError:
            pass

    report_date_text = download_result.get("reportDate")
    report_date_iso = download_result.get("reportDateIso")
    if not report_date_text or not report_date_iso:
        report_date_text, report_date_iso = extract_report_date(download_result.get("pageText"), parsed.get("rawText") or "")
    if not report_date_iso:
        raise RuntimeError("Missing report date from Coffee Board page")

    return {
        "title": REPORT_TITLE,
        "reportDate": report_date_text,
        "reportDateIso": report_date_iso,
        "sourceUrl": download_result.get("pdfUrl") or REPORT_PAGE_URL,
        "suggestedFileName": download_result.get("suggestedFileName"),
        "reportFingerprint": build_report_fingerprint(
            report_date_text,
            download_result.get("suggestedFileName"),
            parsed.get("rawText") or "",
        ),
        "fetchedAt": download_result.get("fetchedAt") or now_iso(),
        "parsed": parsed,
        "pdfText": parsed.get("rawText"),
        "error": parsed.get("error"),
    }


def build_success_item(commodity: CommodityConfig, product: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    value = product.get("value")
    source_url = report.get("sourceUrl") or REPORT_PAGE_URL
    report_date = report.get("reportDate")
    range_display = product.get("rangeDisplay")
    price_min50kg = product.get("priceMin50kg")
    price_max50kg = product.get("priceMax50kg")

    return build_item(
        product_key=commodity.product_key,
        display_name=commodity.display_name,
        unit="INR/kg",
        status="OK",
        reason="MATCHED",
        source=PAYLOAD_SOURCE,
        source_url=source_url,
        raw_text=report.get("pdfText"),
        confidence=0.95,
        value=value,
        extras={
            "currentPrice": value,
            "todayPrice": value,
            # Top-level range fields consumed by the GitHub Actions ingest script
            "priceMin50kg": price_min50kg,
            "priceMax50kg": price_max50kg,
            "rangeDisplay": range_display,
            "shortDescription": f"{commodity.display_name} is trading at {value:.2f} INR/kg from the latest Coffee Board India PDF.",
            "trend": "Stable",
            "analysisSummary": "Direct value parsed from the latest Coffee Board India market report PDF.",
            "analysisBullets": ["Coffee Board India PDF downloaded", "Deterministic PDF parsing", "No external search dependency"],
            "historicalPoints": [],
            "forecastPoints": [],
            "metadata": {
                "query": "Coffee Board India PDF",
                "reportTitle": report.get("title"),
                "reportDate": report_date,
                "reportDateIso": report.get("reportDateIso"),
                "reportFileName": report.get("suggestedFileName"),
                "reportFingerprint": report.get("reportFingerprint"),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": source_url,
                "reportStatus": "LIVE_REPORT",
                "lastCheckedAt": report.get("fetchedAt"),
                "latestSuccessfulReportDate": report_date,
                "carryingForwardPreviousReport": False,
                "valuesAlreadyNormalized": True,
                "currentRangeOriginal": range_display,
                "currentRangeInrPerKg": f"₹{value:,.2f} per kg" if value is not None else None,
            },
            "sources": [{"title": report.get("title") or REPORT_TITLE, "url": source_url, "host": "coffeeboard.gov.in"}],
        },
    )


def build_failure_item(commodity: CommodityConfig, message: str, report: dict[str, Any] | None = None, reason: str = "COFFEE_BOARD_REPORT_FETCH_FAILED") -> dict[str, Any]:
    source_url = (report or {}).get("sourceUrl") or REPORT_PAGE_URL
    raw_text = (report or {}).get("pdfText")
    report_date = (report or {}).get("reportDate")

    return build_item(
        product_key=commodity.product_key,
        display_name=commodity.display_name,
        unit="INR/kg",
        status="FAILED",
        reason=reason,
        source=PAYLOAD_SOURCE,
        source_url=source_url,
        raw_text=raw_text,
        confidence=None,
        error=message,
        extras={
            "currentPrice": None,
            "todayPrice": None,
            "shortDescription": "Coffee Board report could not be parsed for this commodity.",
            "analysisSummary": "The scraper kept the pipeline alive and returned a structured failure instead of crashing.",
            "analysisBullets": ["Coffee Board India only", "Structured failure response", "No external search fallback"],
            "historicalPoints": [],
            "forecastPoints": [],
            "metadata": {
                "query": "Coffee Board India PDF",
                "reportTitle": (report or {}).get("title") or REPORT_TITLE,
                "reportDate": report_date,
                "reportDateIso": (report or {}).get("reportDateIso"),
                "reportFileName": (report or {}).get("suggestedFileName"),
                "reportFingerprint": (report or {}).get("reportFingerprint"),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": source_url,
                "reportStatus": "FETCH_FAILED" if reason == "COFFEE_BOARD_REPORT_FETCH_FAILED" else "LIVE_REPORT",
                "lastCheckedAt": (report or {}).get("fetchedAt") or now_iso(),
                "latestSuccessfulReportDate": report_date,
                "carryingForwardPreviousReport": False,
                "valuesAlreadyNormalized": True,
            },
            "sources": [{"title": (report or {}).get("title") or REPORT_TITLE, "url": source_url, "host": "coffeeboard.gov.in"}],
        },
    )


def build_failed_output(message: str) -> dict[str, Any]:
    items = []
    errors = []

    for commodity in get_active_commodities():
        item = build_failure_item(commodity, message)
        items.append(item)
        errors.append(build_error(commodity.product_key, message, item["sourceUrl"]))

    return {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": now_iso(),
        "items": items,
        "errors": errors,
        "metadata": {
            "coffeeBoard": {
                "reportStatus": "FETCH_FAILED",
                "reportFound": False,
                "newReportDetected": False,
                "usedPreviousSnapshot": False,
                "checkedAt": now_iso(),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": REPORT_PAGE_URL,
                "reason": message,
            },
        },
    }


def run() -> dict[str, Any]:
    commodities = get_active_commodities()
    coffee_commodities = [commodity for commodity in commodities if is_coffee_commodity(commodity)]
    non_coffee_commodities = [commodity for commodity in commodities if not is_coffee_commodity(commodity)]

    try:
        report = fetch_latest_report()
    except Exception as error:  # noqa: BLE001
        log(f"[COFFEE_BOARD] fetch failed: {error}")
        return build_failed_output(str(error))

    parsed = report.get("parsed") or {}
    parsed_products = {
        item["productKey"]: item
        for item in parsed.get("products", [])
        if item.get("productKey")
    }
    product_failures = parsed.get("failures") or {}

    payload: dict[str, Any] = {
        "source": PAYLOAD_SOURCE,
        "fetchedAt": report.get("reportDateIso") or report.get("fetchedAt") or now_iso(),
        "items": [],
        "errors": [],
        "metadata": {
            "coffeeBoard": {
                "reportStatus": "LIVE_REPORT" if parsed.get("success") else "FETCH_FAILED",
                "reportFound": True,
                "newReportDetected": True,
                "usedPreviousSnapshot": False,
                "checkedAt": report.get("fetchedAt") or now_iso(),
                "reportDate": report.get("reportDate"),
                "reportDateIso": report.get("reportDateIso"),
                "reportFileName": report.get("suggestedFileName"),
                "reportFingerprint": report.get("reportFingerprint"),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": report.get("sourceUrl") or REPORT_PAGE_URL,
                "success": parsed.get("success") is True,
                "products": [
                    {"productKey": item.get("productKey"), "value": item.get("value")}
                    for item in parsed.get("products", [])
                ],
            },
        },
    }

    parse_error = parsed.get("error")
    for commodity in coffee_commodities:
        product = parsed_products.get(commodity.product_key)
        value = product.get("value") if product else None
        if value is None:
            message = product_failures.get(commodity.product_key) or parse_error or f"{commodity.display_name} was not found in the Coffee Board PDF."
            item = build_failure_item(commodity, message, report, reason="REPORT_VALUE_NOT_FOUND")
            payload["errors"].append(build_error(commodity.product_key, message, item["sourceUrl"]))
        else:
            item = build_success_item(commodity, product, report)
        payload["items"].append(item)

    for commodity in non_coffee_commodities:
        message = "Coffee pipeline is restricted to Coffee Board India only."
        item = build_failure_item(commodity, message, report, reason="UNSUPPORTED_SOURCE")
        payload["items"].append(item)
        payload["errors"].append(build_error(commodity.product_key, message, item["sourceUrl"]))

    return payload
