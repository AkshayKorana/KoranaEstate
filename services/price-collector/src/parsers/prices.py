from __future__ import annotations

import re
from typing import Any

from config import CommodityConfig

PRICE_PATTERNS = [
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:kg|kilogram)", re.IGNORECASE),
    re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG", re.IGNORECASE),
    re.compile(
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:to|-)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:kg|50\s*kg)",
        re.IGNORECASE,
    ),
]

PRICE_WORDS = (
    "price",
    "prices",
    "rate",
    "rates",
    "market",
    "trading",
    "forecast",
    "trend",
    "analysis",
)


def _clean_number(raw: str) -> float:
    return float(raw.replace(",", ""))


def _normalize_bag_range(low: float, high: float, text: str) -> tuple[float, float]:
    if "50" in text:
        return round(low / 50.0, 2), round(high / 50.0, 2)
    return round(low, 2), round(high, 2)


def _extract_price_from_text(text: str) -> dict[str, float | None] | None:
    for pattern in PRICE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        if match.lastindex == 2:
            low = _clean_number(match.group(1))
            high = _clean_number(match.group(2))
            low, high = _normalize_bag_range(low, high, match.group(0))
            return {"value": round((low + high) / 2.0, 2), "min": low, "max": high}

        value = _clean_number(match.group(1))
        if value > 1000 and "50" in match.group(0):
            value = round(value / 50.0, 2)
        return {"value": round(value, 2), "min": round(value, 2), "max": round(value, 2)}

    return None


def _split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    return [segment.strip() for segment in re.split(r"(?<=[.!?])\s+|\n+", normalized) if segment.strip()]


def _pick_sentence(sentences: list[str], *keywords: str) -> str | None:
    lowered = [sentence.lower() for sentence in sentences]
    for keyword in keywords:
        for index, sentence in enumerate(lowered):
            if keyword in sentence:
                return sentences[index]
    return None


def _pick_price(sentences: list[str], keywords: tuple[str, ...]) -> dict[str, float | None] | None:
    for keyword in keywords:
        for sentence in sentences:
            if keyword in sentence.lower():
                price = _extract_price_from_text(sentence)
                if price:
                    return price
    return None


def _derive_trend(today_price: float | None, last_week_price: float | None, text: str) -> str | None:
    if today_price is not None and last_week_price is not None and last_week_price > 0:
        pct = ((today_price - last_week_price) / last_week_price) * 100
        if pct > 1.5:
            return "Up"
        if pct < -1.5:
            return "Down"
        return "Stable"

    lowered = text.lower()
    if any(keyword in lowered for keyword in ("rising", "gaining", "upward", "higher")):
        return "Up"
    if any(keyword in lowered for keyword in ("falling", "decline", "downward", "lower")):
        return "Down"
    if "stable" in lowered or "steady" in lowered:
        return "Stable"
    return None


def _build_points(today_price: float | None, last_week_price: float | None, next_price: float | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    historical = []
    if last_week_price is not None:
      historical.append({"label": "Last Week", "value": last_week_price})
    if today_price is not None:
      historical.append({"label": "Today", "value": today_price})

    forecast = []
    if next_price is not None:
      forecast.append({"label": "Next Week", "value": next_price})
    elif today_price is not None:
      forecast.append({"label": "Next Week", "value": today_price})

    return historical, forecast


def parse_commodity_intelligence(
    commodity: CommodityConfig,
    raw_text: str,
    sources: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    sentences = _split_sentences(raw_text)
    today = _pick_price(sentences, ("today", "latest", "current", "madikeri", "kodagu"))
    last_week = _pick_price(sentences, ("last week", "previous week", "week ago"))
    next_week = _pick_price(sentences, ("next week", "next few days", "expected", "forecast", "coming week"))

    fallback_price = _extract_price_from_text(raw_text)
    today_price = today["value"] if today else fallback_price["value"] if fallback_price else None
    last_week_price = last_week["value"] if last_week else None
    expected_next_price = next_week["value"] if next_week else None

    trend = _derive_trend(today_price, last_week_price, raw_text)
    description = _pick_sentence(sentences, commodity.display_name.lower(), commodity.product_key.replace("_", " "))
    summary_sentences = [
        sentence
        for sentence in sentences
        if any(word in sentence.lower() for word in PRICE_WORDS)
    ]
    analysis_summary = " ".join(summary_sentences[:2])[:600] if summary_sentences else description
    bullets = summary_sentences[:4] if summary_sentences else sentences[:3]
    historical_points, forecast_points = _build_points(today_price, last_week_price, expected_next_price)

    source_url = sources[0]["url"] if sources else ""
    confidence = 0.25
    confidence += 0.25 if today_price is not None else 0
    confidence += 0.15 if last_week_price is not None else 0
    confidence += 0.15 if expected_next_price is not None else 0
    confidence += 0.1 if bool(summary_sentences) else 0
    confidence = round(min(confidence, 0.9), 2) if confidence > 0 else None

    metadata = {
        "query": commodity.query,
        "aliases": list(commodity.aliases),
        "sourceCount": len(sources or []),
        "hasStructuredPrice": today_price is not None,
    }

    return {
        "currentPrice": today_price,
        "todayPrice": today_price,
        "todayPriceMin": today["min"] if today else fallback_price["min"] if fallback_price else None,
        "todayPriceMax": today["max"] if today else fallback_price["max"] if fallback_price else None,
        "lastWeekPrice": last_week_price,
        "lastWeekPriceMin": last_week["min"] if last_week else None,
        "lastWeekPriceMax": last_week["max"] if last_week else None,
        "expectedNextPrice": expected_next_price,
        "expectedNextPriceMin": next_week["min"] if next_week else None,
        "expectedNextPriceMax": next_week["max"] if next_week else None,
        "shortDescription": description,
        "trend": trend,
        "analysisSummary": analysis_summary,
        "analysisBullets": bullets,
        "historicalPoints": historical_points,
        "forecastPoints": forecast_points,
        "metadata": metadata,
        "sources": sources or [],
        "sourceUrl": source_url,
        "confidence": confidence,
    }
