from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from config import CommodityConfig

PRICE_PATTERNS = [
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
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:50\s*kg|bag)", re.IGNORECASE),
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*bag", re.IGNORECASE),
    re.compile(r"modal\s+price:\s*(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*(?:qt|quintal|qtl)", re.IGNORECASE),
    re.compile(r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:kg|kilogram)", re.IGNORECASE),
    re.compile(r"INR\s*([\d,]+(?:\.\d{1,2})?)\s*(?:/|per)\s*(?:kg|kilogram)", re.IGNORECASE),
    re.compile(r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG", re.IGNORECASE),
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
    "demand",
    "supply",
    "arrival",
    "crop",
    "outlook",
)

TIME_KEYWORDS = {
    "today": ("today", "latest", "current", "currently", "spot", "madikeri", "kodagu"),
    "last_week": (
        "last week",
        "previous week",
        "week ago",
        "last 7 days",
        "earlier this week",
        "week-on-week",
        "compared with last week",
        "compared to the previous week",
        "past week",
    ),
    "next_week": (
        "next week",
        "next few days",
        "expected",
        "forecast",
        "coming week",
        "next 7 days",
        "outlook",
        "near-term",
        "likely to remain",
        "stable to increase",
        "stable to decrease",
        "modest increase expected",
        "slight downside expected",
    ),
}

NOISE_PATTERNS = (
    re.compile(r"latest price today in madikeri", re.IGNORECASE),
    re.compile(r"show me the latest prices analysis", re.IGNORECASE),
    re.compile(r"skip to content", re.IGNORECASE),
    re.compile(r"read more", re.IGNORECASE),
    re.compile(r"about\s+\d+\s+results?", re.IGNORECASE),
    re.compile(r"\bprivacy\b", re.IGNORECASE),
    re.compile(r"\bterms\b", re.IGNORECASE),
    re.compile(r"all search images videos maps news copilot", re.IGNORECASE),
    re.compile(r"\bview all\b", re.IGNORECASE),
)

HOSTNAME_ONLY_PATTERN = re.compile(r"^(?:https?://)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:/[^\s]*)?$", re.IGNORECASE)
DRIVER_KEYWORDS = ("demand", "supply", "arrival", "crop", "harvest", "rain", "export", "quality", "stock", "weather")
FORECAST_CUE_WORDS = ("forecast", "expected", "outlook", "likely", "may", "could", "next week", "coming week")
WEEK_COMPARISON_CUES = ("last week", "previous week", "week ago", "week-on-week", "past week", "compared with last week", "compared to the previous week")
UP_WORDS = ("rising", "gaining", "upward", "higher", "firm", "improve", "stronger", "increase")
DOWN_WORDS = ("falling", "decline", "downward", "lower", "weaker", "decrease", "drop", "soft")
STABLE_WORDS = ("stable", "steady", "flat", "unchanged")
VOLATILE_WORDS = ("volatile", "fluctuating", "swing", "mixed")

SIGNAL_PATTERNS = [
    (re.compile(r"(slight|modest|sharp|strong)?\s*(?:week-on-week\s+)?increase", re.IGNORECASE), "Up"),
    (re.compile(r"(slight|modest|sharp|strong)?\s*(?:week-on-week\s+)?decline", re.IGNORECASE), "Down"),
    (re.compile(r"(slight|modest|sharp|strong)?\s*(?:week-on-week\s+)?decrease", re.IGNORECASE), "Down"),
    (re.compile(r"(slight|modest|sharp|strong)?\s*upward trend", re.IGNORECASE), "Up"),
    (re.compile(r"(slight|modest|sharp|strong)?\s*downward movement", re.IGNORECASE), "Down"),
    (re.compile(r"higher than last week", re.IGNORECASE), "Up"),
    (re.compile(r"lower than last week", re.IGNORECASE), "Down"),
    (re.compile(r"stable over the past week", re.IGNORECASE), "Stable"),
    (re.compile(r"stable to firm", re.IGNORECASE), "Up"),
    (re.compile(r"stable to increase", re.IGNORECASE), "Up"),
    (re.compile(r"stable to decrease", re.IGNORECASE), "Down"),
    (re.compile(r"modest increase expected", re.IGNORECASE), "Up"),
    (re.compile(r"slight downside expected", re.IGNORECASE), "Down"),
]


@dataclass(frozen=True)
class MarketFacts:
    current: dict[str, Any] | None
    last_week: dict[str, Any] | None
    next_week: dict[str, Any] | None
    trend: str | None
    trend_phrase: str | None
    week_on_week_direction: str | None
    forecast_direction: str | None
    current_source_range_text: str | None
    last_week_source_range_text: str | None
    next_week_source_range_text: str | None
    forecast_phrase: str | None
    drivers: list[str]
    supporting_driver_phrases: list[str]
    evidence_sentences: list[str]


def _direction_to_label(direction: str | None, *, forecast: bool = False) -> str | None:
    mapping = {
        "Up": "Modest increase expected" if forecast else "Higher than last week",
        "Down": "Softening expected" if forecast else "Lower than last week",
        "Stable": "Stable outlook" if forecast else "Stable vs last week",
        "Volatile": "Volatile outlook" if forecast else "Volatile vs last week",
    }
    return mapping.get(direction or "")


def _derive_market_sentiment(trend: str | None, forecast_direction: str | None, week_on_week_direction: str | None, text: str) -> str:
    lowered = text.lower()
    if any(keyword in lowered for keyword in VOLATILE_WORDS):
        return "Volatile"
    if trend == "Stable" and forecast_direction in (None, "Stable"):
        return "Stable"
    if trend == "Up" and forecast_direction in ("Up", None) and week_on_week_direction in ("Up", None):
        return "Bullish"
    if trend == "Down" and forecast_direction in ("Down", None) and week_on_week_direction in ("Down", None):
        return "Bearish"
    if trend == "Stable":
        return "Stable"
    if trend and forecast_direction and trend != forecast_direction:
        return "Volatile"
    if forecast_direction == "Up":
        return "Bullish"
    if forecast_direction == "Down":
        return "Bearish"
    return "Volatile" if week_on_week_direction == "Volatile" else "Stable"


def _clean_number(raw: str) -> float:
    return float(raw.replace(",", ""))


def _format_matched_price(match_text: str) -> str:
    cleaned = re.sub(r"\s+", " ", match_text).strip(" .,:;-")
    cleaned = re.sub(r"\bbetween\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bpriced\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+(and|to)\s+", "–", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"₹\s+", "₹", cleaned)
    cleaned = re.sub(r"Rs\.?\s*", "₹", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*/\s*", " / ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


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


def _extract_price_from_text(text: str) -> dict[str, Any] | None:
    for pattern in PRICE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        display = _format_matched_price(match.group(0))
        if match.lastindex == 2:
            low = _clean_number(match.group(1))
            high = _clean_number(match.group(2))
            low, high = _normalize_bag_range(low, high, match.group(0))
            return {
                "value": round((low + high) / 2.0, 2),
                "min": low,
                "max": high,
                "display": display,
                "matchedText": match.group(0),
            }

        value = _clean_number(match.group(1))
        value = _normalize_unit_value(value, match.group(0))
        return {
            "value": round(value, 2),
            "min": round(value, 2),
            "max": round(value, 2),
            "display": display,
            "matchedText": match.group(0),
        }

    return None


def _split_sentences(text: str) -> list[str]:
    if not text:
        return []

    chunks: list[str] = []
    for raw_line in re.split(r"\n+", text):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        line = line.replace("Rs.", "Rs").replace("rs.", "rs")
        parts = [segment.strip() for segment in re.split(r"(?<=[.!?])\s+", line) if segment.strip()]
        chunks.extend(parts or [line])
    return chunks


def _commodity_terms(commodity: CommodityConfig) -> list[str]:
    terms = {
        commodity.display_name.lower(),
        commodity.product_key.replace("_", " ").lower(),
        *[alias.lower() for alias in commodity.aliases],
    }
    terms.update({token for token in commodity.display_name.lower().split() if len(token) > 2})
    return [term for term in terms if term]


def _sentence_specificity(sentence: str, commodity: CommodityConfig) -> int:
    lowered = sentence.lower()
    specificity = 0
    if commodity.display_name.lower() in lowered:
        specificity += 4
    if commodity.product_key.replace("_", " ").lower() in lowered:
        specificity += 4
    for alias in commodity.aliases:
        if alias.lower() in lowered:
            specificity += 3
    for token in commodity.display_name.lower().split():
        if len(token) > 2 and token in lowered:
            specificity += 1
    return specificity


def _looks_generic_coffee_sentence(sentence: str, commodity: CommodityConfig) -> bool:
    lowered = sentence.lower()
    if "coffee" not in lowered:
        return False
    return _sentence_specificity(sentence, commodity) == 0


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


def _canonicalize_line(text: str) -> str:
    canonical = text.lower()
    canonical = re.sub(r"https?://\S+", "", canonical)
    canonical = re.sub(r"[^a-z0-9₹ ]+", " ", canonical)
    canonical = re.sub(r"\s+", " ", canonical).strip()
    return canonical


def _looks_like_noise(line: str) -> bool:
    lowered = line.lower()
    if any(pattern.search(line) for pattern in NOISE_PATTERNS):
        return True
    if lowered.startswith(("all search", "images ", "videos ", "maps ", "news ", "copilot ")):
        return True
    if re.match(r"^https?://", lowered):
        return True
    if HOSTNAME_ONLY_PATTERN.fullmatch(line):
        return True
    if re.fullmatch(r"[A-Z0-9\s|:.\-]{18,}", line):
        return True
    return False


def _is_useful_line(line: str, commodity: CommodityConfig) -> bool:
    if not line or _looks_like_noise(line):
        return False
    if len(line) < 20 and not _extract_price_from_text(line):
        return False
    if _looks_generic_coffee_sentence(line, commodity):
        return False
    return True


def clean_market_text_lines(raw_text: str, commodity: CommodityConfig) -> list[str]:
    seen_exact: set[str] = set()
    seen_near: list[str] = []
    cleaned_lines: list[str] = []

    for sentence in _split_sentences(raw_text):
        line = re.sub(r"\s+", " ", sentence).strip(" \t-")
        if not _is_useful_line(line, commodity):
            continue

        exact_key = line.lower()
        near_key = _canonicalize_line(line)
        if not near_key:
            continue
        if exact_key in seen_exact:
            continue
        if any(near_key == existing or near_key in existing or existing in near_key for existing in seen_near):
            continue

        seen_exact.add(exact_key)
        seen_near.append(near_key)
        cleaned_lines.append(line)

    return cleaned_lines


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


def _pick_price(
    sentences: list[str],
    commodity: CommodityConfig,
    keywords: tuple[str, ...],
    *,
    require_keyword: bool = False,
) -> dict[str, Any] | None:
    relevant = _relevant_sentences(sentences, commodity) or sentences
    commodity_terms = _commodity_terms(commodity)
    candidates: list[tuple[int, dict[str, Any]]] = []
    keyword_candidates: list[tuple[int, dict[str, Any]]] = []

    for sentence in relevant:
        price = _extract_price_from_text(sentence)
        if not price:
            continue

        lowered = sentence.lower()
        score = _sentence_score(sentence, commodity_terms)
        if any(keyword in lowered for keyword in keywords):
            score += 4
        candidate = dict(price)
        candidate["sentence"] = sentence
        candidate["score"] = score
        candidate["specificity"] = _sentence_specificity(sentence, commodity)
        candidates.append((score, candidate))
        if any(keyword in lowered for keyword in keywords):
            keyword_candidates.append((score, candidate))

    target_candidates = keyword_candidates if keyword_candidates else ([] if require_keyword else candidates)
    if not target_candidates:
        return None

    target_candidates.sort(key=lambda item: (item[0], item[1]["specificity"]), reverse=True)
    return target_candidates[0][1]


def _derive_trend(today_price: float | None, last_week_price: float | None, text: str) -> str | None:
    if today_price is not None and last_week_price is not None and last_week_price > 0:
        pct = ((today_price - last_week_price) / last_week_price) * 100
        if pct > 1.5:
            return "Up"
        if pct < -1.5:
            return "Down"
        return "Stable"

    lowered = text.lower()
    if any(keyword in lowered for keyword in UP_WORDS):
        return "Up"
    if any(keyword in lowered for keyword in DOWN_WORDS):
        return "Down"
    if any(keyword in lowered for keyword in STABLE_WORDS):
        return "Stable"
    if any(keyword in lowered for keyword in VOLATILE_WORDS):
        return "Volatile"
    return None


def _trend_phrase_from_label(trend: str | None, today_price: float | None, last_week_price: float | None, text: str) -> str | None:
    if today_price is not None and last_week_price is not None and last_week_price > 0:
        pct = ((today_price - last_week_price) / last_week_price) * 100
        if pct > 4:
            return "strong week-on-week increase"
        if pct > 1.5:
            return "slight week-on-week increase"
        if pct < -4:
            return "sharp week-on-week decline"
        if pct < -1.5:
            return "slight week-on-week decline"
        return "broadly stable week-on-week"

    lowered = text.lower()
    if trend == "Up":
        if "firm" in lowered or "stronger" in lowered:
            return "firm to slightly stronger"
        return "higher"
    if trend == "Down":
        if "weak" in lowered or "softer" in lowered:
            return "soft to weaker"
        return "lower"
    if trend == "Stable":
        return "stable"
    if trend == "Volatile":
        return "volatile"
    return None


def _extract_signal_phrase(sentence: str) -> tuple[str | None, str | None]:
    lowered = sentence.lower()
    for pattern, direction in SIGNAL_PATTERNS:
        match = pattern.search(sentence)
        if match:
            phrase = re.sub(r"\s+", " ", match.group(0)).strip(" .,:;-")
            return direction, phrase
    if any(keyword in lowered for keyword in VOLATILE_WORDS):
        return "Volatile", "volatile"
    if any(keyword in lowered for keyword in UP_WORDS):
        return "Up", "firm to higher"
    if any(keyword in lowered for keyword in DOWN_WORDS):
        return "Down", "soft to lower"
    if any(keyword in lowered for keyword in STABLE_WORDS):
        return "Stable", "stable"
    return None, None


def _normalize_market_phrase(phrase: str | None) -> str | None:
    if not phrase:
        return None
    normalized = re.sub(r"\s+", " ", phrase).strip(" .,:;-").lower()
    replacements = {
        "slight week-on-week increase": "slight increase",
        "strong week-on-week increase": "strong increase",
        "slight week-on-week decline": "slight decrease",
        "sharp week-on-week decline": "sharp decrease",
        "broadly stable week-on-week": "stable",
        "higher": "slight increase",
        "lower": "slight decrease",
        "firm to slightly stronger": "stable to firm",
        "soft to weaker": "slight decrease",
        "firm to higher": "stable to firm",
        "soft to lower": "slight decrease",
    }
    return replacements.get(normalized, normalized)


def _normalize_driver_sentence(sentence: str) -> str:
    cleaned = re.sub(r"\s+", " ", sentence).strip(" .")
    cleaned = re.sub(r"^traders said\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^market sources said\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^reports? suggest(?:s)?\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^commentary suggests?\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned[:1].lower() + cleaned[1:] if cleaned else cleaned
    return cleaned


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


def _format_inr(value: float) -> str:
    if value.is_integer():
        return f"₹{value:,.0f}"
    return f"₹{value:,.2f}"


def _format_normalized_price_range(price: dict[str, Any] | None) -> str | None:
    if not price:
        return None
    low = price.get("min")
    high = price.get("max")
    if low is None:
        return None
    if high is not None and abs(high - low) > 0.01:
        return f"{_format_inr(low)}–{_format_inr(high)}/kg"
    return f"{_format_inr(low)}/kg"


def _build_price_clause(commodity: CommodityConfig, price: dict[str, Any]) -> str:
    display = price.get("display")
    normalized = _format_normalized_price_range(price)
    if display and normalized and normalized not in display:
        return f"{commodity.display_name} is currently trading at {display} (about {normalized})"
    if display:
        return f"{commodity.display_name} is currently trading at {display}"
    if normalized:
        return f"{commodity.display_name} is currently trading around {normalized}"
    return f"{commodity.display_name} has a current price signal"


def _build_outlook_phrase(facts: MarketFacts) -> str:
    if facts.next_week:
        display = facts.next_week.get("display") or _format_normalized_price_range(facts.next_week)
        if display:
            return f"Near-term indications suggest {display} next week."
        return "Near-term indications remain cautiously stable."
    if facts.forecast_phrase:
        forecast_text = _normalize_market_phrase(facts.forecast_phrase) or facts.forecast_phrase
        return f"Next week outlook remains {forecast_text}."
    return "No reliable next-week outlook is available from current market sources."


def _build_trend_sentence(facts: MarketFacts) -> str:
    if facts.last_week and facts.trend_phrase:
        trend_text = _normalize_market_phrase(facts.trend_phrase) or facts.trend_phrase
        return f"Prices show a {trend_text}."
    if facts.last_week_source_range_text:
        trend_text = _normalize_market_phrase(facts.last_week_source_range_text) or facts.last_week_source_range_text
        return f"Week-on-week signals indicate a {trend_text}."
    return "Week-on-week direction remains limited in current market sources."


def _pick_driver_sentences(sentences: list[str], commodity: CommodityConfig) -> list[str]:
    relevant = _relevant_sentences(sentences, commodity) or sentences
    primary_drivers: list[str] = []
    fallback_drivers: list[str] = []
    seen: set[str] = set()
    for sentence in relevant:
        lowered = sentence.lower()
        if not any(keyword in lowered for keyword in DRIVER_KEYWORDS):
            continue
        key = _canonicalize_line(sentence)
        if key in seen:
            continue
        seen.add(key)
        target = fallback_drivers if any(cue in lowered for cue in FORECAST_CUE_WORDS) else primary_drivers
        target.append(sentence)
        if len(primary_drivers) >= 2:
            break
    return (primary_drivers + fallback_drivers)[:2]


def _extract_directional_fact(
    sentences: list[str],
    cue_words: tuple[str, ...],
) -> dict[str, str] | None:
    for sentence in sentences:
        lowered = sentence.lower()
        if not any(cue in lowered for cue in cue_words):
            continue
        direction, phrase = _extract_signal_phrase(sentence)
        if direction and phrase:
            return {"direction": direction, "phrase": phrase, "sentence": sentence}
    return None


def extract_market_facts(cleaned_lines: list[str], commodity: CommodityConfig) -> MarketFacts:
    relevant_sentences = _relevant_sentences(cleaned_lines, commodity) or cleaned_lines
    today = _pick_price(cleaned_lines, commodity, TIME_KEYWORDS["today"])
    last_week = _pick_price(cleaned_lines, commodity, TIME_KEYWORDS["last_week"], require_keyword=True)
    next_week = _pick_price(cleaned_lines, commodity, TIME_KEYWORDS["next_week"], require_keyword=True)
    last_week_signal = _extract_directional_fact(relevant_sentences, WEEK_COMPARISON_CUES)
    next_week_signal = _extract_directional_fact(relevant_sentences, TIME_KEYWORDS["next_week"])

    fallback_price = _extract_price_from_text(" ".join(relevant_sentences)) if relevant_sentences else None
    if today is None:
        today = fallback_price
        if today is not None:
            today = {**today, "sentence": relevant_sentences[0], "specificity": _sentence_specificity(relevant_sentences[0], commodity)}

    today_price = today["value"] if today else None
    last_week_price = last_week["value"] if last_week else None
    trend = _derive_trend(today_price, last_week_price, " ".join(relevant_sentences))
    if trend is None and last_week_signal:
        trend = last_week_signal["direction"]
    trend_phrase = _trend_phrase_from_label(trend, today_price, last_week_price, " ".join(relevant_sentences))
    if trend_phrase is None and last_week_signal:
        trend_phrase = last_week_signal["phrase"]
    trend_phrase = _normalize_market_phrase(trend_phrase)
    drivers = _pick_driver_sentences(cleaned_lines, commodity)
    current_source_range_text = today.get("display") if today else None
    last_week_source_range_text = last_week.get("display") if last_week else _normalize_market_phrase(last_week_signal["phrase"]) if last_week_signal else None
    next_week_source_range_text = next_week.get("display") if next_week else _normalize_market_phrase(next_week_signal["phrase"]) if next_week_signal else None
    forecast_direction = next_week_signal["direction"] if next_week_signal else None
    forecast_phrase = _normalize_market_phrase(next_week_signal["phrase"]) if next_week_signal else None
    week_on_week_direction = trend

    evidence_sentences: list[str] = []
    for item in (today, last_week, next_week):
        sentence = item.get("sentence") if item else None
        if sentence and sentence not in evidence_sentences:
            evidence_sentences.append(sentence)
    if last_week_signal and last_week_signal["sentence"] not in evidence_sentences:
        evidence_sentences.append(last_week_signal["sentence"])
    if next_week_signal and next_week_signal["sentence"] not in evidence_sentences:
        evidence_sentences.append(next_week_signal["sentence"])
    for sentence in drivers:
        if sentence not in evidence_sentences:
            evidence_sentences.append(sentence)

    return MarketFacts(
        current=today,
        last_week=last_week,
        next_week=next_week,
        trend=trend,
        trend_phrase=trend_phrase,
        week_on_week_direction=week_on_week_direction,
        forecast_direction=forecast_direction,
        current_source_range_text=current_source_range_text,
        last_week_source_range_text=last_week_source_range_text,
        next_week_source_range_text=next_week_source_range_text,
        forecast_phrase=forecast_phrase,
        drivers=drivers,
        supporting_driver_phrases=drivers,
        evidence_sentences=evidence_sentences[:4],
    )


def build_contextual_summary(commodity: CommodityConfig, facts: MarketFacts) -> str:
    if not facts.current:
        return "No reliable structured market summary available."

    first_sentence = _build_price_clause(commodity, facts.current)
    second_sentence = _build_trend_sentence(facts)
    if facts.next_week:
        second_sentence = f"{second_sentence[:-1]}; {_build_outlook_phrase(facts)[0].lower()}{_build_outlook_phrase(facts)[1:]}"
    return f"{first_sentence}. {second_sentence}"


def build_analysis_summary(commodity: CommodityConfig, facts: MarketFacts) -> str:
    if not facts.current:
        return "No reliable structured market summary available."

    sentences = [f"Current market references place {commodity.display_name} at {_build_price_clause(commodity, facts.current).split(' at ', 1)[1]}."]

    if facts.last_week and facts.trend_phrase:
        sentences.append(f"Compared with last week, the market points to a {facts.trend_phrase}.")
    else:
        sentences.append("Week-on-week comparison is limited in the current source set.")

    if facts.drivers:
        driver_text = _normalize_driver_sentence(facts.drivers[0])
        if facts.next_week:
            sentences.append(f"Market commentary suggests that {driver_text}, while {_build_outlook_phrase(facts)[0].lower()}{_build_outlook_phrase(facts)[1:]}")
        else:
            sentences.append(f"Supporting commentary indicates that {driver_text}. No reliable next-week outlook is available from current market sources.")
    else:
        sentences.append(_build_outlook_phrase(facts))

    return " ".join(sentences[:3])


def build_highlights(commodity: CommodityConfig, facts: MarketFacts) -> list[str]:
    highlights: list[str] = []

    if facts.current:
        display = facts.current.get("display") or _format_normalized_price_range(facts.current)
        if display:
            highlights.append(f"Current price: {display}")
        normalized = _format_normalized_price_range(facts.current)
        if normalized and normalized not in (display or ""):
            highlights.append(f"Normalized price: {normalized}")

    if facts.last_week and facts.trend_phrase:
        highlights.append(f"Week-on-week: {facts.trend_phrase}")
    elif facts.last_week_source_range_text:
        highlights.append(f"Week-on-week: {facts.last_week_source_range_text}")

    if facts.next_week:
        display = facts.next_week.get("display") or _format_normalized_price_range(facts.next_week)
        if display:
            highlights.append(f"Next week: {display}")
    elif facts.forecast_phrase:
        highlights.append(f"Outlook: {facts.forecast_phrase}")
    else:
        highlights.append("Outlook: No reliable signal")

    if facts.drivers:
        highlights.append(f"Driver: {_normalize_driver_sentence(facts.drivers[0])}")

    deduped: list[str] = []
    seen: set[str] = set()
    for item in highlights:
        cleaned = re.sub(r"\s+", " ", item).strip()
        key = _canonicalize_line(cleaned)
        if not cleaned or key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)

    return deduped[:4]


def parse_commodity_intelligence(
    commodity: CommodityConfig,
    raw_text: str,
    sources: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    cleaned_lines = clean_market_text_lines(raw_text, commodity)
    facts = extract_market_facts(cleaned_lines, commodity)

    today_price = facts.current["value"] if facts.current else None
    last_week_price = facts.last_week["value"] if facts.last_week else None
    expected_next_price = facts.next_week["value"] if facts.next_week else None
    market_sentiment = _derive_market_sentiment(
        facts.trend,
        facts.forecast_direction,
        facts.week_on_week_direction,
        " ".join(facts.evidence_sentences),
    )
    historical_points, forecast_points = _build_points(today_price, last_week_price, expected_next_price)

    today_sentence = facts.current.get("sentence") if facts.current else None
    generic_today_price = _looks_generic_coffee_sentence(today_sentence or "", commodity)

    source_url = sources[0]["url"] if sources else ""
    confidence = 0.25
    confidence += 0.25 if today_price is not None else 0
    confidence += 0.15 if last_week_price is not None else 0
    confidence += 0.15 if expected_next_price is not None else 0
    confidence += 0.1 if bool(facts.evidence_sentences) else 0
    confidence += 0.05 if bool(source_url) else 0
    confidence -= 0.15 if generic_today_price else 0
    confidence = round(min(confidence, 0.9), 2) if confidence > 0 else None

    metadata = {
        "query": commodity.query,
        "aliases": list(commodity.aliases),
        "sourceCount": len(sources or []),
        "hasStructuredPrice": today_price is not None,
        "relevantSentenceCount": len(cleaned_lines),
        "todayPriceSentence": today_sentence,
        "todayPriceSpecificity": facts.current.get("specificity") if facts.current else 0,
        "genericCoffeeFallback": generic_today_price,
        "currentUnitSourceText": facts.current_source_range_text,
        "lastWeekSourceText": facts.last_week_source_range_text,
        "nextWeekSourceText": facts.next_week_source_range_text,
        "current_source_range_text": facts.current_source_range_text,
        "last_week_source_range_text": facts.last_week_source_range_text,
        "next_week_source_range_text": facts.next_week_source_range_text,
        "trendPhrase": facts.trend_phrase,
        "week_on_week_direction": facts.week_on_week_direction,
        "forecast_direction": facts.forecast_direction,
        "forecast_phrase": facts.forecast_phrase,
        "last_week_display_signal": _direction_to_label(facts.week_on_week_direction, forecast=False),
        "next_week_display_signal": _direction_to_label(facts.forecast_direction, forecast=True),
        "marketSentiment": market_sentiment,
        "marketDrivers": facts.drivers,
        "supporting_driver_phrases": facts.supporting_driver_phrases,
        "supportingEvidence": facts.evidence_sentences,
    }

    return {
        "currentPrice": today_price,
        "todayPrice": today_price,
        "todayPriceMin": facts.current["min"] if facts.current else None,
        "todayPriceMax": facts.current["max"] if facts.current else None,
        "lastWeekPrice": last_week_price,
        "lastWeekPriceMin": facts.last_week["min"] if facts.last_week else None,
        "lastWeekPriceMax": facts.last_week["max"] if facts.last_week else None,
        "expectedNextPrice": expected_next_price,
        "expectedNextPriceMin": facts.next_week["min"] if facts.next_week else None,
        "expectedNextPriceMax": facts.next_week["max"] if facts.next_week else None,
        "shortDescription": build_contextual_summary(commodity, facts),
        "trend": facts.trend,
        "analysisSummary": build_analysis_summary(commodity, facts),
        "analysisBullets": build_highlights(commodity, facts),
        "historicalPoints": historical_points,
        "forecastPoints": forecast_points,
        "metadata": metadata,
        "sources": sources or [],
        "sourceUrl": source_url,
        "confidence": confidence,
    }
