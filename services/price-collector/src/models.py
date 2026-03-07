from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_item(
    *,
    product_key: str,
    display_name: str,
    unit: str,
    status: str,
    reason: str,
    source: str,
    source_url: str,
    raw_text: str | None,
    confidence: float | None,
    value: float | None = None,
    error: str | None = None,
    captured_at: str | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    item = {
        "productKey": product_key,
        "displayName": display_name,
        "value": value,
        "unit": unit,
        "status": status,
        "reason": reason,
        "source": source,
        "sourceUrl": source_url,
        "rawText": raw_text[:8000] if raw_text else None,
        "confidence": confidence,
        "capturedAt": captured_at or now_iso(),
        "error": error,
        "meta": {
            "query": raw_text[:240] if raw_text else None,
            "confidence": confidence,
            "reason": reason,
            "sourceUrl": source_url,
        },
    }
    if extras:
        item.update(extras)
    return item


def build_error(product_key: str, error: str, source_url: str) -> dict[str, str]:
    return {
        "productKey": product_key,
        "error": error,
        "sourceUrl": source_url,
    }
