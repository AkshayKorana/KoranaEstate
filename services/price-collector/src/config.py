from __future__ import annotations

import os
from dataclasses import dataclass, field

QUERY_TEMPLATE = (
    "{commodity_name} latest price today in Madikeri, Kodagu and show me the latest "
    "prices analysis from last week to today to next week"
)


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
        return self.search_text_override or QUERY_TEMPLATE.format(commodity_name=self.display_name)


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
