from __future__ import annotations

import os
import re
import tempfile
from datetime import datetime, timezone
from typing import Any

from pypdf import PdfReader
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import COFFEE_PRODUCT_KEYS, CommodityConfig, get_active_commodities
from models import build_error, build_item, now_iso
from .bing import CHROMIUM_LAUNCH_ARGS, build_failed_output as build_bing_failed_output, run as run_bing

REPORT_PAGE_URL = "https://coffeeboard.gov.in/Market_Info.aspx"
REPORT_LINK_TEXT = "Click here to view Daily report"
SOURCE_NAME = "coffee-board-india"
PAYLOAD_SOURCE = "Coffee Board India"
COFFEE_BOARD_PAGE_TITLE = "Daily Coffee Market Report"
DATE_PATTERN = re.compile(
    r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
RANGE_PATTERN = re.compile(
    r"(?:₹|Rs\.?\s*)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?:₹|Rs\.?\s*)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)",
    re.IGNORECASE,
)
EXCHANGE_RATE_PATTERN = re.compile(r"Exchange\s+Rate\s+Rs\s*/\s*US\s*\$[:\s]+(\d+(?:\.\d+)?)", re.IGNORECASE)
FUTURES_ROW_PATTERN = re.compile(
    r"([A-Za-z]{3,9}\s*[-–]\s*\d{4})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"
)
PRICE_LABELS: dict[str, tuple[str, ...]] = {
    "arabica_parchment": ("Ar.Pmt", "Ar Pmt", "Arabica Parchment", "Arabica Plantation"),
    "arabica_cherry": ("Ar.Chy", "Ar Chy", "Arabica Cherry"),
    "robusta_parchment": ("Rob.Pmt", "Rob Pmt", "Robusta Parchment"),
    "robusta_cherry": ("Rob.Chy", "Rob Chy", "Robusta Cherry"),
}
TREND_UP_TERMS = ("higher", "rise", "rally", "firm", "increase", "up", "strong")
TREND_DOWN_TERMS = ("lower", "fall", "decline", "down", "weak", "soft")
TREND_STABLE_TERMS = ("steady", "stable", "unchanged", "flat")


def is_coffee_commodity(commodity: CommodityConfig) -> bool:
    return commodity.product_key in COFFEE_PRODUCT_KEYS


def normalize_space(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_report_date(*text_values: str) -> tuple[str | None, str | None]:
    for text in text_values:
        match = DATE_PATTERN.search(text or "")
        if not match:
            continue
        pretty = f"{match.group(1).title()} {int(match.group(2))}, {match.group(3)}"
        parsed = datetime.strptime(pretty, "%B %d, %Y").replace(tzinfo=timezone.utc)
        return pretty, parsed.isoformat()
    return None, None


def extract_section(text: str, start_markers: tuple[str, ...], end_markers: tuple[str, ...], window: int = 2200) -> str:
    lowered = text.lower()
    start_index = -1
    marker_used = ""
    for marker in start_markers:
        idx = lowered.find(marker.lower())
        if idx != -1:
            start_index = idx
            marker_used = marker
            break
    if start_index == -1:
        return ""

    start_index += len(marker_used)
    tail = text[start_index:start_index + window]
    end_positions = [tail.lower().find(marker.lower()) for marker in end_markers if tail.lower().find(marker.lower()) != -1]
    if end_positions:
        tail = tail[:min(end_positions)]
    return normalize_space(tail)


def parse_numeric(value: str) -> float:
    return float(value.replace(",", ""))


def extract_range_after_label(text: str, labels: tuple[str, ...]) -> tuple[float, float, str] | None:
    for label in labels:
        pattern = re.compile(rf"{re.escape(label)}[\s:()/-]{{0,20}}(.{{0,120}}?)", re.IGNORECASE)
        for match in pattern.finditer(text):
            chunk = match.group(1)
            range_match = RANGE_PATTERN.search(chunk)
            if range_match:
                low = parse_numeric(range_match.group(1))
                high = parse_numeric(range_match.group(2))
                return low, high, f"Rs. {range_match.group(1)}–{range_match.group(2)} per 50 kg"
    return None


def extract_domestic_prices(report_text: str) -> dict[str, dict[str, Any]]:
    domestic_section = extract_section(
        report_text,
        ("Raw Coffee Prices in Karnataka", "Raw coffee prices in Karnataka", "Raw Coffee Price in Karnataka"),
        ("Market Analysis", "International", "ICO", "Futures", "Exchange Rate"),
        window=2600,
    )
    prices: dict[str, dict[str, Any]] = {}
    for product_key, labels in PRICE_LABELS.items():
        found = extract_range_after_label(domestic_section or report_text, labels)
        if not found and domestic_section:
            ordered_ranges = list(RANGE_PATTERN.finditer(domestic_section))
            order = ["arabica_parchment", "arabica_cherry", "robusta_parchment", "robusta_cherry"]
            if len(ordered_ranges) >= 4 and product_key in order:
                idx = order.index(product_key)
                range_match = ordered_ranges[idx]
                found = (
                    parse_numeric(range_match.group(1)),
                    parse_numeric(range_match.group(2)),
                    f"Rs. {range_match.group(1)}–{range_match.group(2)} per 50 kg",
                )
        if not found:
            continue
        low_50kg, high_50kg, display = found
        prices[product_key] = {
            "min50kg": low_50kg,
            "max50kg": high_50kg,
            "mid50kg": round((low_50kg + high_50kg) / 2.0, 2),
            "minKg": round(low_50kg / 50.0, 2),
            "maxKg": round(high_50kg / 50.0, 2),
            "midKg": round(((low_50kg + high_50kg) / 2.0) / 50.0, 2),
            "display": display,
        }
    return prices


def extract_futures_rows(report_text: str) -> dict[str, Any]:
    arabica_section = extract_section(
        report_text,
        ("ICE New York Arabica", "Arabica (ICE New York)"),
        ("ICE Europe Robusta", "ICO", "Raw Coffee"),
        window=1500,
    )
    robusta_section = extract_section(
        report_text,
        ("ICE Europe Robusta", "Robusta (ICE Europe)"),
        ("ICO", "Raw Coffee", "Market Analysis"),
        window=1500,
    )

    return {
        "arabica": [
            {"month": normalize_space(match.group(1)), "centsLb": float(match.group(2)), "rsKg": float(match.group(3))}
            for match in FUTURES_ROW_PATTERN.finditer(arabica_section)
        ][:4],
        "robusta": [
            {"month": normalize_space(match.group(1)), "usdTonne": float(match.group(2)), "rsKg": float(match.group(3))}
            for match in FUTURES_ROW_PATTERN.finditer(robusta_section)
        ][:4],
        "exchangeRateRsUsd": float(EXCHANGE_RATE_PATTERN.search(report_text).group(1)) if EXCHANGE_RATE_PATTERN.search(report_text) else None,
        "arabicaSectionText": arabica_section or None,
        "robustaSectionText": robusta_section or None,
    }


def extract_analysis(report_text: str) -> str:
    analysis = extract_section(
        report_text,
        ("Market Analysis",),
        ("Raw Coffee Prices in Karnataka", "Raw coffee prices in Karnataka", "ICO", "Exchange Rate", "Raw Coffee"),
        window=2200,
    )
    return analysis or normalize_space(report_text[:1200])


def derive_trend(analysis_text: str) -> str:
    lowered = analysis_text.lower()
    up = sum(term in lowered for term in TREND_UP_TERMS)
    down = sum(term in lowered for term in TREND_DOWN_TERMS)
    stable = sum(term in lowered for term in TREND_STABLE_TERMS)
    if up > down and up >= stable:
        return "Up"
    if down > up and down >= stable:
        return "Down"
    if stable > 0:
        return "Stable"
    return "Mixed"


def build_analysis_bullets(
    commodity: CommodityConfig,
    domestic_price: dict[str, Any] | None,
    report_date: str | None,
    analysis_text: str,
    futures: dict[str, Any],
) -> list[str]:
    bullets: list[str] = []
    if domestic_price:
        bullets.append(f"Current range: {domestic_price['display']}")
        bullets.append(f"Normalized: Rs. {domestic_price['minKg']:.2f}–{domestic_price['maxKg']:.2f} per kg")
    if report_date:
        bullets.append(f"Report date: {report_date}")
    if futures.get("arabica"):
        first = futures["arabica"][0]
        bullets.append(f"ICE Arabica: {first['month']} at {first['centsLb']} cents/lb")
    elif futures.get("robusta"):
        first = futures["robusta"][0]
        bullets.append(f"ICE Robusta: {first['month']} at {first['usdTonne']} US$/tonne")
    if analysis_text:
        bullets.append(analysis_text[:180])
    return bullets[:4]


def fetch_latest_report() -> dict[str, Any]:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=CHROMIUM_LAUNCH_ARGS)
        page = browser.new_page(locale="en-IN", timezone_id="Asia/Kolkata")
        try:
            page.goto(REPORT_PAGE_URL, wait_until="domcontentloaded", timeout=20000)
            page.get_by_role("button", name=REPORT_LINK_TEXT).wait_for(state="visible", timeout=8000)
            page_text = page.locator("body").inner_text(timeout=4000)
            with page.expect_download(timeout=15000) as download_info:
                page.get_by_role("button", name=REPORT_LINK_TEXT).click()
            download = download_info.value
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                download_path = temp_file.name
            download.save_as(download_path)
        finally:
            browser.close()

    try:
        pdf_text = extract_text_from_pdf(download_path)
    finally:
        try:
            os.unlink(download_path)
        except OSError:
            pass

    report_date_text, report_date_iso = extract_report_date(page_text, pdf_text)
    futures = extract_futures_rows(pdf_text)
    analysis_text = extract_analysis(pdf_text)
    domestic_prices = extract_domestic_prices(pdf_text)

    return {
        "title": COFFEE_BOARD_PAGE_TITLE,
        "reportDate": report_date_text,
        "reportDateIso": report_date_iso,
        "sourceUrl": REPORT_PAGE_URL,
        "suggestedFileName": download.suggested_filename,
        "pageText": page_text,
        "pdfText": pdf_text,
        "analysisText": analysis_text,
        "futures": futures,
        "domesticPrices": domestic_prices,
        "fetchedAt": now_iso(),
    }


def build_coffee_item(commodity: CommodityConfig, report: dict[str, Any]) -> dict[str, Any]:
    domestic_price = report["domesticPrices"].get(commodity.product_key)
    report_date = report.get("reportDate")
    report_title = report.get("title")
    source_url = report.get("sourceUrl") or REPORT_PAGE_URL
    analysis_text = normalize_space(report.get("analysisText"))
    futures = report.get("futures") or {}

    if not domestic_price:
        return build_item(
            product_key=commodity.product_key,
            display_name=commodity.display_name,
            unit="INR/50kg",
            status="FAILED",
            reason="REPORT_VALUE_NOT_FOUND",
            source=PAYLOAD_SOURCE,
            source_url=source_url,
            raw_text=report.get("pdfText"),
            confidence=None,
            error=f"{commodity.display_name} was not found in the latest Coffee Board report.",
            extras={
                "shortDescription": "Coffee Board report was fetched, but this commodity range was not found.",
                "analysisSummary": analysis_text or "Coffee Board report did not expose a readable market note for this commodity.",
                "analysisBullets": build_analysis_bullets(commodity, None, report_date, analysis_text, futures),
                "historicalPoints": [],
                "forecastPoints": [],
                "metadata": {
                    "query": "Coffee Board India daily report",
                    "reportTitle": report_title,
                    "reportDate": report_date,
                    "reportDateIso": report.get("reportDateIso"),
                    "reportFileName": report.get("suggestedFileName"),
                    "reportSourceLabel": PAYLOAD_SOURCE,
                    "marketAnalysis": analysis_text,
                    "futures": futures,
                    "domesticPrices": report.get("domesticPrices"),
                    "valuesAlreadyNormalized": True,
                },
                "sources": [{"title": report_title, "url": source_url, "host": "coffeeboard.gov.in"}],
            },
        )

    trend = derive_trend(analysis_text)
    current_price = domestic_price["midKg"]
    last_week_price = None
    analysis_summary = (
        f"{commodity.display_name} in the latest Coffee Board report is quoted at {domestic_price['display']} "
        f"(about Rs. {domestic_price['midKg']:.2f} per kg). {analysis_text}"
    ).strip()

    return build_item(
        product_key=commodity.product_key,
        display_name=commodity.display_name,
        unit="INR/50kg",
        status="OK",
        reason="MATCHED",
        source=PAYLOAD_SOURCE,
        source_url=source_url,
        raw_text=report.get("pdfText"),
        confidence=0.92,
        value=current_price,
        extras={
            "currentPrice": current_price,
            "todayPrice": current_price,
            "todayPriceMin": domestic_price["minKg"],
            "todayPriceMax": domestic_price["maxKg"],
            "lastWeekPrice": last_week_price,
            "expectedNextPrice": None,
            "shortDescription": f"{commodity.display_name} is currently reported at {domestic_price['display']} in Coffee Board Karnataka market data.",
            "trend": trend,
            "analysisSummary": analysis_summary[:1200],
            "analysisBullets": build_analysis_bullets(commodity, domestic_price, report_date, analysis_text, futures),
            "historicalPoints": [],
            "forecastPoints": [],
            "metadata": {
                "query": "Coffee Board India daily report",
                "reportTitle": report_title,
                "reportDate": report_date,
                "reportDateIso": report.get("reportDateIso"),
                "reportFileName": report.get("suggestedFileName"),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": source_url,
                "originalUnit": "50kg",
                "currentRangeOriginal": domestic_price["display"],
                "currentRangeInrPerKg": f"Rs. {domestic_price['minKg']:.2f}–{domestic_price['maxKg']:.2f} per kg",
                "marketAnalysis": analysis_text,
                "futures": futures,
                "domesticPrices": report.get("domesticPrices"),
                "valuesAlreadyNormalized": True,
                "marketSentiment": trend,
                "forecast_direction": None,
                "forecast_phrase": None,
                "supporting_driver_phrases": [analysis_text] if analysis_text else [],
            },
            "sources": [{"title": report_title, "url": source_url, "host": "coffeeboard.gov.in"}],
        },
    )


def build_failed_output(message: str) -> dict:
    items = []
    errors = []
    for commodity in get_active_commodities():
        if is_coffee_commodity(commodity):
            item = build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit="INR/50kg",
                status="FAILED",
                reason="COFFEE_BOARD_REPORT_FETCH_FAILED",
                source=PAYLOAD_SOURCE,
                source_url=REPORT_PAGE_URL,
                raw_text=None,
                confidence=None,
                error=message,
            )
        else:
            item = build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit=commodity.unit,
                status="FAILED",
                reason="SCRAPER_ERROR",
                source="Bing (Playwright)",
                source_url="https://www.bing.com/search",
                raw_text=None,
                confidence=None,
                error=message,
            )
        items.append(item)
        errors.append(build_error(commodity.product_key, message, item["sourceUrl"]))

    return {"source": PAYLOAD_SOURCE, "fetchedAt": now_iso(), "items": items, "errors": errors}


def run() -> dict:
    commodities = get_active_commodities()
    coffee_commodities = [commodity for commodity in commodities if is_coffee_commodity(commodity)]
    non_coffee_commodities = [commodity for commodity in commodities if not is_coffee_commodity(commodity)]

    payload = {
        "source": PAYLOAD_SOURCE if not non_coffee_commodities else "Coffee Board India + Bing (Playwright)",
        "fetchedAt": now_iso(),
        "items": [],
        "errors": [],
    }

    try:
        report = fetch_latest_report()
    except Exception as error:
        message = str(error)
        for commodity in coffee_commodities:
            item = build_item(
                product_key=commodity.product_key,
                display_name=commodity.display_name,
                unit="INR/50kg",
                status="FAILED",
                reason="COFFEE_BOARD_REPORT_FETCH_FAILED",
                source=PAYLOAD_SOURCE,
                source_url=REPORT_PAGE_URL,
                raw_text=None,
                confidence=None,
                error=message,
            )
            payload["items"].append(item)
            payload["errors"].append(build_error(commodity.product_key, message, item["sourceUrl"]))
    else:
        payload["fetchedAt"] = report.get("reportDateIso") or report["fetchedAt"]
        coffee_items = [build_coffee_item(commodity, report) for commodity in coffee_commodities]
        coffee_errors = [
            build_error(item["productKey"], item.get("error") or item.get("reason") or "Unknown error", item["sourceUrl"])
            for item in coffee_items
            if item.get("status") != "OK"
        ]
        payload["items"].extend(coffee_items)
        payload["errors"].extend(coffee_errors)

    if non_coffee_commodities:
        try:
            bing_payload = run_bing(non_coffee_commodities)
        except Exception as error:
            bing_payload = build_bing_failed_output(str(error), non_coffee_commodities)
        payload["items"].extend(bing_payload.get("items", []))
        payload["errors"].extend(bing_payload.get("errors", []))

    return payload
