from __future__ import annotations

import re
from typing import Optional


def extract_inr_per_kg(text: str) -> tuple[Optional[float], Optional[str]]:
    patterns = [
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*/\s*(?:kg|KG|kilogram)",
        r"(?:₹|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*per\s*(?:kg|kilogram)",
        r"([\d,]+(?:\.\d{1,2})?)\s*INR\s*/\s*KG",
        r"₹\s*([\d,]+)\s*(?:to|-)\s*₹\s*([\d,]+)\s*per\s*50\s*kg",
        r"Rs\.?\s*([\d,]+)\s*(?:to|-)\s*Rs\.?\s*([\d,]+)\s*per\s*50\s*kg",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue

        if match.lastindex == 2:
            low = float(match.group(1).replace(",", ""))
            high = float(match.group(2).replace(",", ""))
            return round(((low + high) / 2.0) / 50.0, 2), f"range 50kg ₹{low}-{high}"

        value = float(match.group(1).replace(",", ""))
        if value > 1000:
            return round(value / 50.0, 2), f"50kg bag ₹{value}"
        return round(value, 2), f"per kg ₹{value}"

    return None, None
