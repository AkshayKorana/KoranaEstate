from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ProductDefinition:
    product_key: str
    display_name: str


PRODUCTS = [
    ProductDefinition("arabica_cherry", "Arabica Cherry"),
    ProductDefinition("arabica_parchment", "Arabica Parchment"),
    ProductDefinition("robusta_cherry", "Robusta Cherry"),
    ProductDefinition("robusta_parchment", "Robusta Parchment"),
    ProductDefinition("arabica_greenbean", "Arabica Green Bean"),
    ProductDefinition("robusta_greenbean", "Robusta Green Bean"),
]

UNIT = "INR/kg"


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in ("false", "0", "no")
