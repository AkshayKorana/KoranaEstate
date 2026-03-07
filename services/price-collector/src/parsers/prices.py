from __future__ import annotations

import re
from typing import Any

from config import CommodityConfig

PRICE_PATTERNS = [
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:kg|kilogram)", re.IGNORECASE),
    re.compile(r"INR\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:kg|kilogram)", re.IGNORECASE),
    re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG", re.IGNORECASE),
    re.compile(
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:to|-)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:kg|50\s*kg)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:between|priced\s+between)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:and|to|-)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:kg|50\s*kg|bag)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:to|-)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:quintal|qt|qtl|bag)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:between|priced\s+between)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:and|to|-)\s*(?:₹|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:quintal|qt|qtl|bag)",
        re.IGNORECASE,
    ),
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:quintal|qt|qtl)", re.IGNORECASE),
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*bag", re.IGNORECASE),
    re.compile(r"modal\s+price:\s*(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*(?:qt|quintal|qtl)", re.IGNORECASE),
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

TIME_KEYWORDS = {
    "today": ("today", "latest", "current", "currently", "spot", "madikeri", "kodagu"),
    "last_week": ("last week", "previous week", "week ago", "last 7 days", "earlier this week"),
    "next_week": ("next week", "next few days", "expected", "forecast", "coming week", "next 7 days"),
}


def _clean_number(raw: str) -> float:
    return float(raw.replace(",", ""))


def _normalize_bag_range(low: float, high: float, text: str) -> tuple[float, float]:
    lowered = text.lower()
    if "50" in lowered or "bag" in lowered:
        return round(low / 50.0, 2), round(high / 50.0, 2)
    if any(unit in lowered for unit in ("quintal", "/qt", " qt", "/qtl", " qtl")):
        return round(low / 100.0, 2), round(high / 100.0, 2)
    return round(low, 2), round(high, 2)


def _normalize_unit_value(value: float, text: str) -> float:
    lowered = text.lower()
    if any(unit in lowered for unit in ("quintal", "/qt", " qt", "/qtl", " qtl")):
        return round(value / 100.0, 2)
    if "bag" in lowered or "50 kg" in lowered:
        return round(value / 50.0, 2)
    return round(value, 2)


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
        value = _normalize_unit_value(value, match.group(0))
        return {"value": round(value, 2), "min": round(value, 2), "max": round(value, 2)}

    return None


def _split_sentences(text: str) -> list[str]:
    if not text:
        return []

    chunks: list[str] = []
    for raw_line in re.split(r"\n+", text):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        parts = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", line) if segment.strip()]
        if parts:
            chunks.extend(parts)
        else:
            chunks.append(line)
    return chunks


def _commodity_terms(commodity: CommodityConfig) -> list[str]:
    terms = {
        commodity.display_name.lower(),
        commodity.product_key.replace("_", " ").lower(),
        *[alias.lower() for alias in commodity.aliases],
    }
    terms.update({token for token in commodity.display_name.lower().split() if len(token) > 2})
    return [term for term in terms if term]


def _sentence_score(sentence: str, commodity_terms: list[str]) -> int:
    lowered = sentence.lower()
    score = 0
    matched_terms = 0
    for term in commodity_terms:
        if term in lowered:
            matched_terms += 1
            score += 6 if " " in term else 2
    for word in PRICE_WORDS:
        if word in lowered:
            score += 1
    if any(currency in sentence for currency in ("₹", "Rs", "INR")):
        score += 2
    if "coffee" in lowered and matched_terms == 0:
        score -= 2
    return score


def _relevant_sentences(sentences: list[str], commodity: CommodityConfig) -> list[str]:
    commodity_terms = _commodity_terms(commodity)
    scored = [(index, sentence, _sentence_score(sentence, commodity_terms)) for index, sentence in enumerate(sentences)]
    anchors = [index for index, _sentence, score in scored if score > 0]

    if not anchors:
        return []

    selected_indexes: set[int] = set()
    for index in anchors:
        selected_indexes.update({max(0, index - 1), index, min(len(sentences) - 1, index + 1)})

    selected = [(index, sentences[index], _sentence_score(sentences[index], commodity_terms)) for index in sorted(selected_indexes)]
    selected.sort(key=lambda item: (-item[2], item[0]))
    return [sentence for _index, sentence, _score in selected]


def _pick_sentence(sentences: list[str], commodity: CommodityConfig, *keywords: str) -> str | None:
    relevant = _relevant_sentences(sentences, commodity) or sentences
    lowered = [sentence.lower() for sentence in relevant]
    for keyword in keywords:
        for index, sentence in enumerate(lowered):
            if keyword in sentence:
                return relevant[index]
    return relevant[0] if relevant else None


def _pick_price(sentences: list[str], commodity: CommodityConfig, keywords: tuple[str, ...]) -> dict[str, float | None] | None:
    relevant = _relevant_sentences(sentences, commodity)
    if not relevant:
        return None

    commodity_terms = _commodity_terms(commodity)
    candidates: list[tuple[int, dict[str, float | None]]] = []

    for keyword in keywords:
        for sentence in relevant:
            if keyword in sentence.lower():
                price = _extract_price_from_text(sentence)
                if price:
                    score = _sentence_score(sentence, commodity_terms) + 3
                    candidates.append((score, price))

    for sentence in relevant:
        price = _extract_price_from_text(sentence)
        if price:
            score = _sentence_score(sentence, commodity_terms)
            candidates.append((score, price))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


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
    relevant_sentences = _relevant_sentences(sentences, commodity)
    today = _pick_price(sentences, commodity, TIME_KEYWORDS["today"])
    last_week = _pick_price(sentences, commodity, TIME_KEYWORDS["last_week"])
    next_week = _pick_price(sentences, commodity, TIME_KEYWORDS["next_week"])

    fallback_price = _extract_price_from_text(" ".join(relevant_sentences)) if relevant_sentences else None
    today_price = today["value"] if today else fallback_price["value"] if fallback_price else None
    last_week_price = last_week["value"] if last_week else None
    expected_next_price = next_week["value"] if next_week else None

    trend = _derive_trend(today_price, last_week_price, " ".join(relevant_sentences) or raw_text)
    description = _pick_sentence(sentences, commodity, commodity.display_name.lower(), commodity.product_key.replace("_", " "))
    summary_sentences = [
        sentence
        for sentence in (relevant_sentences or sentences)
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
    confidence += 0.05 if bool(source_url) else 0
    confidence = round(min(confidence, 0.9), 2) if confidence > 0 else None

    metadata = {
        "query": commodity.query,
        "aliases": list(commodity.aliases),
        "sourceCount": len(sources or []),
        "hasStructuredPrice": today_price is not None,
        "relevantSentenceCount": len(relevant_sentences),
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
