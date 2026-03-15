from __future__ import annotations

import os
from dataclasses import dataclass, field

COFFEE_PRODUCT_KEYS = {
    "arabica_parchment",
    "arabica_cherry",
    "robusta_parchment",
    "robusta_cherry",
}
SPICE_NUT_PRODUCT_KEYS = {"black_pepper", "arecanut"}


def build_market_query(product_key: str, commodity_name: str) -> str:
    if product_key in COFFEE_PRODUCT_KEYS:
        return f"{commodity_name} price Madikeri Kodagu today trend outlook"
    if product_key in SPICE_NUT_PRODUCT_KEYS:
        return f"{commodity_name} market price Madikeri Kodagu today trend forecast"
    return f"{commodity_name} price Madikeri Kodagu today market trend"


def build_market_query_variants(product_key: str, commodity_name: str, aliases: tuple[str, ...]) -> tuple[str, ...]:
    queries: list[str] = [build_market_query(product_key, commodity_name)]

    if product_key in COFFEE_PRODUCT_KEYS:
        queries.extend(
            [
                f"{commodity_name} price Kodagu",
                f"{commodity_name} market Kodagu",
            ]
        )
    elif product_key == "black_pepper":
        queries.extend(
            [
                "Black Pepper price Kodagu",
                "Pepper price Kodagu",
            ]
        )
    elif product_key == "arecanut":
        queries.extend(
            [
                "Arecanut price Kodagu",
                "Supari price Kodagu",
            ]
        )

    for alias in aliases:
        queries.append(f"{alias} price Kodagu")

    deduped: list[str] = []
    seen: set[str] = set()
    for query in queries:
        normalized = query.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(normalized)

    return tuple(deduped)


@dataclass(frozen=True)
class CommodityConfig:
    product_key: str
    display_name: str
    enabled: bool = True
    unit: str = "INR/kg"
    aliases: tuple[str, ...] = field(default_factory=tuple)
    search_text_override: str | None = None

    @property
    def query(self) -> str:
        return self.search_text_override or build_market_query(self.product_key, self.display_name)

    @property
    def queries(self) -> tuple[str, ...]:
        if self.search_text_override:
            return (self.search_text_override,)
        return build_market_query_variants(self.product_key, self.display_name, self.aliases)


COMMODITIES = [
    CommodityConfig("arabica_parchment", "Arabica Parchment", aliases=("coffee parchment",)),
    CommodityConfig("arabica_cherry", "Arabica Cherry", aliases=("coffee cherry",)),
    CommodityConfig("robusta_parchment", "Robusta Parchment", aliases=("robusta coffee parchment",)),
    CommodityConfig("robusta_cherry", "Robusta Cherry", aliases=("robusta coffee cherry",)),
    CommodityConfig("black_pepper", "Black Pepper", aliases=("pepper", "black pepper price")),
    CommodityConfig("arecanut", "Arecanut", aliases=("supari", "betel nut")),
]


def get_active_commodities() -> list[CommodityConfig]:
    return [commodity for commodity in COMMODITIES if commodity.enabled]


def env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in ("false", "0", "no")
