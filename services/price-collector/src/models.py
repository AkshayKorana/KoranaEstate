from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class NormalizedItem:
    product_key: str
    value: Optional[float]
    unit: str
    status: str
    reason: Optional[str]
    source: str
    source_url: str
    raw_text: Optional[str]
    confidence: Optional[float]
    captured_at: str = field(default_factory=now_iso)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "productKey": self.product_key,
            "value": self.value,
            "unit": self.unit,
            "status": self.status,
            "reason": self.reason,
            "source": self.source,
            "sourceUrl": self.source_url,
            "rawText": self.raw_text,
            "confidence": self.confidence,
            "capturedAt": self.captured_at,
            "error": self.error,
            # Legacy compatibility for the current backend ingest adapter.
            "meta": {
                "query": self.raw_text[:240] if self.raw_text else None,
                "confidence": self.confidence,
                "reason": self.reason,
                "sourceUrl": self.source_url,
            },
        }


@dataclass
class CollectorError:
    product_key: str
    error: str
    source_url: str

    def to_dict(self) -> dict:
        return {
            "productKey": self.product_key,
            "error": self.error,
            "sourceUrl": self.source_url,
        }
