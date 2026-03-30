from __future__ import annotations

import hashlib
import os
import re
import tempfile
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from pypdf import PdfReader
from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

from config import COFFEE_PRODUCT_KEYS, CommodityConfig, get_active_commodities
from models import build_error, build_item, now_iso
from .bing import CHROMIUM_LAUNCH_ARGS, build_failed_output as build_bing_failed_output, log, run as run_bing

REPORT_PAGE_URL = "https://coffeeboard.gov.in/Market_Info.aspx"
REPORT_LINK_TEXT = "Click here to view Daily report"
SOURCE_NAME = "coffee-board-india"
PAYLOAD_SOURCE = "Coffee Board India"
COFFEE_BOARD_PAGE_TITLE = "Daily Coffee Market Report"
PDF_ACQUIRE_TIMEOUT_MS = 30000
DATE_PATTERN = re.compile(
    r"(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+)?"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)
RANGE_PATTERN = re.compile(
    r"(?:₹|Rs\.?\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?:₹|Rs\.?\s*)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)",
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
PRICE_ORDER = ["arabica_parchment", "arabica_cherry", "robusta_parchment", "robusta_cherry"]
KARNATAKA_HEADER_PATTERN = re.compile(
    r"ar\.?\s*pmt.*ar\.?\s*chy.*rob\.?\s*pmt.*rob\.?\s*chy",
    re.IGNORECASE,
)
COFFEE_COPY_BY_PRODUCT_KEY = {
    "arabica_parchment": {
        "shortDescriptionTemplate": "{display_name} is trading at {display_50kg} today ({display_kg}), based on the latest Coffee Board Karnataka report.",
        "analysisSummaryTemplate": "Domestic Arabica prices remain firm within the Karnataka market range, supported by steady demand for premium-grade beans. The current Coffee Board range is {display_50kg}.",
        "analysisBullets": [
            "Firm domestic arabica pricing",
            "Premium-grade demand remains strong",
            "Karnataka range holding steady",
            "Global futures slightly softer",
        ],
    },
    "arabica_cherry": {
        "shortDescriptionTemplate": "{display_name} is trading at {display_50kg} today ({display_kg}), reflecting the latest Coffee Board Karnataka market range.",
        "analysisSummaryTemplate": "Arabica Cherry pricing indicates a moderate domestic market, with stable local demand and slight influence from softer global trends. The current Coffee Board range is {display_50kg}.",
        "analysisBullets": [
            "Moderate domestic price band",
            "Stable Karnataka demand",
            "Quality-driven price spread",
            "Mild global pressure",
        ],
    },
    "robusta_parchment": {
        "shortDescriptionTemplate": "{display_name} is trading at {display_50kg} today ({display_kg}), based on the latest Coffee Board Karnataka report.",
        "analysisSummaryTemplate": "Robusta Parchment continues to trade within a stable and healthy domestic range. The current Coffee Board range is {display_50kg}.",
        "analysisBullets": [
            "Stable domestic robusta pricing",
            "Consistent Karnataka supply-demand",
            "Global pressure remains limited",
            "Short-term outlook steady",
        ],
    },
    "robusta_cherry": {
        "shortDescriptionTemplate": "{display_name} is trading at {display_50kg} today ({display_kg}), reflecting the lower-end robusta segment in the Karnataka market.",
        "analysisSummaryTemplate": "Robusta Cherry remains in a steady domestic trading range, representing entry-level raw coffee pricing. The current Coffee Board range is {display_50kg}.",
        "analysisBullets": [
            "Entry-level robusta pricing",
            "Stable local market conditions",
            "Consistent Karnataka supply",
            "Mild global softness",
        ],
    },
}


def is_coffee_commodity(commodity: CommodityConfig) -> bool:
    return commodity.product_key in COFFEE_PRODUCT_KEYS


def normalize_space(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def build_report_fingerprint(report_date: str | None, file_name: str | None, pdf_text: str) -> str:
    hash_input = "||".join([
        normalize_space(report_date),
        normalize_space(file_name),
        normalize_space(pdf_text),
    ])
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()


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


def extract_section_raw(text: str, start_markers: tuple[str, ...], end_markers: tuple[str, ...], window: int = 2200) -> str:
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
    lowered_tail = tail.lower()
    end_positions = [lowered_tail.find(marker.lower()) for marker in end_markers if lowered_tail.find(marker.lower()) != -1]
    if end_positions:
        tail = tail[:min(end_positions)]
    return tail


def parse_numeric(value: str) -> float:
    return float(value.replace(",", ""))


def format_inr_value(value: float) -> str:
    return f"₹{value:,.0f}"


def format_inr_range(low: float, high: float, unit_suffix: str) -> str:
    return f"{format_inr_value(low)}–{format_inr_value(high)} {unit_suffix}"


def format_inr_precise_range(low: float, high: float, unit_suffix: str) -> str:
    return f"₹{low:,.2f}–₹{high:,.2f} {unit_suffix}"


def is_valid_50kg_coffee_range(low: float, high: float) -> bool:
    return low <= high and low >= 5000 and high >= 5000


def build_price_payload(low_50kg: float, high_50kg: float) -> dict[str, Any]:
    min_kg = round(low_50kg / 50.0, 2)
    max_kg = round(high_50kg / 50.0, 2)
    mid_50kg = round((low_50kg + high_50kg) / 2.0, 2)
    mid_kg = round(mid_50kg / 50.0, 2)
    return {
        "min50kg": low_50kg,
        "max50kg": high_50kg,
        "mid50kg": mid_50kg,
        "minKg": min_kg,
        "maxKg": max_kg,
        "midKg": mid_kg,
        "display": format_inr_range(low_50kg, high_50kg, "per 50 kg"),
        "displayPerKg": format_inr_precise_range(min_kg, max_kg, "per kg"),
    }


def extract_karnataka_structured_prices(report_text: str) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    domestic_section_raw = extract_section_raw(
        report_text,
        (
            "Raw Coffee Price (Karnataka)",
            "Raw Coffee Price (Karnataka) as on",
            "Raw Coffee Prices in Karnataka",
            "Raw coffee prices in Karnataka",
            "Raw Coffee Price in Karnataka",
        ),
        ("Market Analysis", "International", "ICO", "Futures", "Exchange Rate"),
        window=2600,
    )
    if not domestic_section_raw:
        return {}, {product_key: "Karnataka raw coffee section was not found in the Coffee Board PDF." for product_key in PRICE_ORDER}

    lines = [normalize_space(line) for line in domestic_section_raw.splitlines() if normalize_space(line)]
    header_index = -1
    for index in range(len(lines)):
        header_blob = " ".join(lines[index:index + 3])
        if KARNATAKA_HEADER_PATTERN.search(header_blob):
            header_index = index
            break

    if header_index == -1:
        return {}, {product_key: "Karnataka raw coffee header row was not found in the Coffee Board PDF." for product_key in PRICE_ORDER}

    candidate_blob = ""
    for offset in range(1, min(5, len(lines) - header_index)):
        candidate_blob = " ".join(lines[header_index + offset:header_index + offset + 3])
        range_matches = list(RANGE_PATTERN.finditer(candidate_blob))
        if len(range_matches) >= 4:
            parsed_prices: dict[str, dict[str, Any]] = {}
            parse_errors: dict[str, str] = {}
            for product_key, range_match in zip(PRICE_ORDER, range_matches[:4]):
                low_50kg = parse_numeric(range_match.group(1))
                high_50kg = parse_numeric(range_match.group(2))
                if not is_valid_50kg_coffee_range(low_50kg, high_50kg):
                    parse_errors[product_key] = (
                        f"Invalid Coffee Board Karnataka range parsed for {product_key}: "
                        f"{low_50kg:g}-{high_50kg:g} per 50 kg."
                    )
                    continue
                parsed_prices[product_key] = build_price_payload(low_50kg, high_50kg)
            if parsed_prices:
                for product_key in PRICE_ORDER:
                    parse_errors.setdefault(product_key, f"Karnataka raw coffee row did not contain a valid range for {product_key}.")
                return parsed_prices, parse_errors
            break

    return {}, {product_key: "Karnataka raw coffee data row was not found below the Coffee Board header row." for product_key in PRICE_ORDER}


def extract_domestic_prices(report_text: str) -> dict[str, dict[str, Any]]:
    prices, _ = extract_karnataka_structured_prices(report_text)
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
    copy = COFFEE_COPY_BY_PRODUCT_KEY.get(commodity.product_key)
    if copy:
        return list(copy["analysisBullets"])
    return ["Latest Coffee Board market range available."]


def build_short_description(commodity: CommodityConfig, domestic_price: dict[str, Any]) -> str:
    copy = COFFEE_COPY_BY_PRODUCT_KEY.get(commodity.product_key, {})
    template = copy.get("shortDescriptionTemplate") or (
        "{display_name} is trading at {display_50kg} today ({display_kg}), based on the latest Coffee Board Karnataka report."
    )
    return template.format(
        display_name=commodity.display_name,
        display_50kg=domestic_price["display"],
        display_kg=domestic_price["displayPerKg"],
    )


def build_analysis_summary(commodity: CommodityConfig, domestic_price: dict[str, Any]) -> str:
    copy = COFFEE_COPY_BY_PRODUCT_KEY.get(commodity.product_key, {})
    template = copy.get("analysisSummaryTemplate") or (
        "{display_name} is currently quoted in the {display_50kg} range, with a midpoint of {mid_kg}/kg."
    )
    return template.format(
        display_name=commodity.display_name,
        display_50kg=domestic_price["display"],
        display_kg=domestic_price["displayPerKg"],
        mid_kg=format_inr_value(domestic_price["midKg"]),
    )


def looks_like_pdf_url(url: str | None) -> bool:
    if not url:
        return False
    lowered = url.lower()
    return lowered.endswith(".pdf") or ".pdf?" in lowered


def download_pdf_from_url(pdf_url: str, referer: str | None = None) -> tuple[str, str]:
    headers = {"User-Agent": "Mozilla/5.0"}
    if referer:
        headers["Referer"] = referer
    request = Request(pdf_url, headers=headers)
    with urlopen(request, timeout=30) as response:
        content = response.read()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
        temp_file.write(content)
        download_path = temp_file.name

    suggested_filename = os.path.basename(pdf_url.split("?")[0]) or "coffee-board-report.pdf"
    return download_path, suggested_filename


def extract_pdf_url_from_control(report_link, base_url: str) -> str | None:
    try:
        href = (report_link.get_attribute("href") or "").strip()
    except Exception:
        href = ""
    if href:
        return urljoin(base_url, href)

    try:
        onclick = (report_link.get_attribute("onclick") or "").strip()
    except Exception:
        onclick = ""
    if onclick:
        match = re.search(r"""['"]([^'"]+\.pdf[^'"]*)['"]""", onclick, re.IGNORECASE)
        if match:
            return urljoin(base_url, match.group(1))
    return None


def acquire_daily_report_pdf(page) -> tuple[str, str, str]:
    pdf_response_urls: list[str] = []
    download_event = {"value": None}
    opened_page = {"value": None}

    def on_response(response) -> None:
        try:
            content_type = response.headers.get("content-type", "")
            if "application/pdf" in content_type.lower():
                pdf_response_urls.append(response.url)
        except Exception:
            pass

    def on_download(download) -> None:
        download_event["value"] = download

    def on_page(new_page) -> None:
        opened_page["value"] = new_page

    page.context.on("response", on_response)
    page.on("download", on_download)
    page.context.on("page", on_page)
    report_link = page.get_by_text(REPORT_LINK_TEXT, exact=False).first
    report_link.wait_for(state="visible", timeout=PDF_ACQUIRE_TIMEOUT_MS)
    direct_url = extract_pdf_url_from_control(report_link, page.url)

    download_path = ""
    pdf_url = ""
    suggested_filename = "coffee-board-report.pdf"
    strategy = ""

    if direct_url and looks_like_pdf_url(direct_url):
        pdf_url = direct_url
        download_path, suggested_filename = download_pdf_from_url(pdf_url, REPORT_PAGE_URL)
        strategy = "direct_control_url"

    if not download_path:
        try:
            report_link.click(timeout=PDF_ACQUIRE_TIMEOUT_MS)
        except Exception:
            pass

    if not download_path:
        for _ in range(30):
            download = download_event["value"]
            if download is not None:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                    download_path = temp_file.name
                download.save_as(download_path)
                pdf_url = download.url or direct_url or page.url
                suggested_filename = download.suggested_filename or suggested_filename
                strategy = "expect_download"
                break

            new_page = opened_page["value"]
            if new_page is not None:
                try:
                    new_page.wait_for_load_state("domcontentloaded", timeout=2000)
                except Exception:
                    pass
                if looks_like_pdf_url(new_page.url):
                    pdf_url = new_page.url
                    download_path, suggested_filename = download_pdf_from_url(pdf_url, REPORT_PAGE_URL)
                    strategy = "new_tab"
                    break

            if looks_like_pdf_url(page.url):
                pdf_url = page.url
                download_path, suggested_filename = download_pdf_from_url(pdf_url, REPORT_PAGE_URL)
                strategy = "same_tab"
                break

            if pdf_response_urls:
                pdf_url = pdf_response_urls[0]
                download_path, suggested_filename = download_pdf_from_url(pdf_url, REPORT_PAGE_URL)
                strategy = "network_response"
                break

            page.wait_for_timeout(1000)

    if not download_path and direct_url:
        pdf_url = direct_url
        download_path, suggested_filename = download_pdf_from_url(pdf_url, REPORT_PAGE_URL)
        strategy = "manual_download"

    new_page = opened_page["value"]
    if new_page is not None:
        try:
            new_page.close()
        except Exception:
            pass

    try:
        page.context.remove_listener("response", on_response)
    except Exception:
        pass
    try:
        page.remove_listener("download", on_download)
    except Exception:
        pass
    try:
        page.context.remove_listener("page", on_page)
    except Exception:
        pass

    if not download_path:
        raise RuntimeError("Unable to acquire Coffee Board daily report PDF after clicking the visible daily report control.")

    log(
        f"[COFFEE_BOARD] pdf acquisition strategy={strategy} "
        f"pdf_url={pdf_url or 'unknown'} suggested_filename={suggested_filename}"
    )
    return download_path, suggested_filename, (pdf_url or REPORT_PAGE_URL)


def fetch_latest_report() -> dict[str, Any]:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=CHROMIUM_LAUNCH_ARGS)
        page = browser.new_page(locale="en-IN", timezone_id="Asia/Kolkata")
        try:
            log(f"[COFFEE_BOARD] opening market info page {REPORT_PAGE_URL}")
            page.goto(REPORT_PAGE_URL, wait_until="domcontentloaded", timeout=PDF_ACQUIRE_TIMEOUT_MS)
            page.get_by_text(REPORT_LINK_TEXT, exact=False).first.wait_for(state="visible", timeout=PDF_ACQUIRE_TIMEOUT_MS)
            page_text = page.locator("body").inner_text(timeout=4000)
            download_path, suggested_filename, pdf_url = acquire_daily_report_pdf(page)
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
    domestic_prices, domestic_price_errors = extract_karnataka_structured_prices(pdf_text)
    report_fingerprint = build_report_fingerprint(report_date_text, suggested_filename, pdf_text)
    log(
        f"[COFFEE_BOARD] fetched report date={report_date_text or 'unknown'} "
        f"file={suggested_filename} prices_found={sorted(domestic_prices.keys())}"
    )

    return {
        "title": COFFEE_BOARD_PAGE_TITLE,
        "reportDate": report_date_text,
        "reportDateIso": report_date_iso,
        "sourceUrl": pdf_url,
        "suggestedFileName": suggested_filename,
        "reportFingerprint": report_fingerprint,
        "pageText": page_text,
        "pdfText": pdf_text,
        "analysisText": analysis_text,
        "futures": futures,
        "domesticPrices": domestic_prices,
        "domesticPriceErrors": domestic_price_errors,
        "fetchedAt": now_iso(),
    }


def build_coffee_item(commodity: CommodityConfig, report: dict[str, Any]) -> dict[str, Any]:
    domestic_price = report["domesticPrices"].get(commodity.product_key)
    domestic_price_error = (report.get("domesticPriceErrors") or {}).get(commodity.product_key)
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
            error=domestic_price_error or f"{commodity.display_name} was not found in the latest Coffee Board report.",
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
                    "reportFingerprint": report.get("reportFingerprint"),
                    "reportSourceLabel": PAYLOAD_SOURCE,
                    "reportStatus": "LIVE_REPORT",
                    "lastCheckedAt": report.get("fetchedAt"),
                    "latestSuccessfulReportDate": report_date,
                    "carryingForwardPreviousReport": False,
                    "marketAnalysis": analysis_text,
                    "futures": futures,
                    "domesticPrices": report.get("domesticPrices"),
                    "valuesAlreadyNormalized": True,
                },
                "sources": [{"title": report_title, "url": source_url, "host": "coffeeboard.gov.in"}],
            },
        )

    trend = "Stable"
    current_price = domestic_price["midKg"]
    last_week_price = None
    short_description = build_short_description(commodity, domestic_price)
    analysis_summary = build_analysis_summary(commodity, domestic_price)

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
            "shortDescription": short_description,
            "trend": trend,
            "analysisSummary": analysis_summary,
            "analysisBullets": build_analysis_bullets(commodity, domestic_price, report_date, analysis_text, futures),
            "historicalPoints": [],
            "forecastPoints": [],
            "metadata": {
                "query": "Coffee Board India daily report",
                "reportTitle": report_title,
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
                "originalUnit": "50kg",
                "currentRangeOriginal": domestic_price["display"],
                "currentRangeInrPerKg": domestic_price["displayPerKg"],
                "todayPriceMin": domestic_price["min50kg"],
                "todayPriceMax": domestic_price["max50kg"],
                "todayPriceMid": domestic_price["mid50kg"],
                "todayPriceMinPerKg": domestic_price["minKg"],
                "todayPriceMaxPerKg": domestic_price["maxKg"],
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
        "metadata": {
            "coffeeBoard": {
                "reportStatus": "FETCH_FAILED",
                "reportFound": False,
                "newReportDetected": False,
                "usedPreviousSnapshot": False,
                "checkedAt": now_iso(),
                "reportSourceLabel": PAYLOAD_SOURCE,
                "reportSourceUrl": REPORT_PAGE_URL,
            },
        },
    }

    try:
        report = fetch_latest_report()
    except Exception as error:
        message = str(error)
        log(f"[COFFEE_BOARD] decision=FETCH_FAILED error={message}")
        payload["metadata"]["coffeeBoard"] = {
            "reportStatus": "FETCH_FAILED",
            "reportFound": False,
            "newReportDetected": False,
            "usedPreviousSnapshot": False,
            "checkedAt": now_iso(),
            "reportSourceLabel": PAYLOAD_SOURCE,
            "reportSourceUrl": REPORT_PAGE_URL,
            "reason": message,
        }
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
        payload["metadata"]["coffeeBoard"] = {
            "reportStatus": "LIVE_REPORT",
            "reportFound": True,
            "newReportDetected": True,
            "usedPreviousSnapshot": False,
            "checkedAt": report["fetchedAt"],
            "reportDate": report.get("reportDate"),
            "reportDateIso": report.get("reportDateIso"),
            "reportFileName": report.get("suggestedFileName"),
            "reportFingerprint": report.get("reportFingerprint"),
            "reportSourceLabel": PAYLOAD_SOURCE,
            "reportSourceUrl": report.get("sourceUrl") or REPORT_PAGE_URL,
        }
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
