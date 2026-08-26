"""Realleader MIC groups — load from homolog catalog, scrape sequence."""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "docs" / "homolog" / "realleader-mic-catalog.json"

# Sequência scrape logistics Realleader (Buckler comercial). M3 fora — linha descontinuada Buckler.
REALLEADER_SCRAPE_SEQUENCE: list[str] = [
    "Strength-Glute-Leader",
    "Strength-M7-Pro-Series",
    "Strength-M2-Series",
    "Strength-FM-Series",
    "Strength-FW-Series",
    "Strength-PF-series",
    "Plate-Loaded-Real-Series",
    "Plate-Loaded-LD-Series",
    "Cardio-Treadmills-Elliptical-Bike",
]

LINE_SKU_PATTERN: dict[str, str] = {
    "M7PRO": r"M7PRO-\d{4}",
    "M3": r"M3-\d{4}",
    "M2": r"M2-\d{4}[A-Z]?",
    "FM": r"FM-\d{4}[A-Z]?",
    "FW": r"FW-\d{4}",
    "PF": r"PF-\d{4}",
    "LD": r"LD-\d{4}",
    "RS": r"RS-\d{4}",
    "GL": r"GL-\d{4}",
    "CARDIO": r"(?:RCT|RE|RSB|RS)-[A-Z0-9]+",
}


def slug_to_output_file(slug_hint: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9]+", "_", slug_hint).strip("_")
    return f"{safe}_logistics.json"


def catalog_product_to_scrape_row(p: dict[str, Any]) -> dict[str, str]:
    url = p["productUrl"]
    m = re.search(r"/product/([A-Za-z0-9]+)/", url)
    return {
        "hash": m.group(1) if m else "",
        "name": p.get("sku") or p.get("name") or "",
        "url": url.split("?")[0],
        "catalogSku": p.get("sku", ""),
    }


def group_entry_to_config(entry: dict[str, Any]) -> dict[str, Any]:
    line = entry.get("line", "OTHER")
    mic_total = int(entry.get("micListingTotal") or 0)
    page_size = 48
    max_pages = max(1, math.ceil(mic_total / page_size) + 1) if mic_total else 4

    return {
        "id": entry.get("slugHint", line).lower().replace(" ", "-"),
        "label": entry.get("slugHint", line).replace("-", " "),
        "catalogGroup": entry.get("defaultChip") or entry.get("products", [{}])[0].get("catalogGroup"),
        "line": line,
        "productGroupId": entry.get("productGroupId"),
        "expectedMicListings": mic_total,
        "expectedProducts": entry.get("productCount"),
        "catalogSkuPattern": LINE_SKU_PATTERN.get(line, r"[A-Z]{2,6}-\d{3,4}[A-Z]?"),
        "dedupeByCatalogSku": True,
        "maxPages": max_pages,
        "pageSize": page_size,
        "outputFile": slug_to_output_file(entry.get("slugHint", line)),
        "catalogProducts": [catalog_product_to_scrape_row(p) for p in entry.get("products") or []],
        "groupUrl": entry.get("groupUrl"),
    }


def load_catalog(path: Path = CATALOG_PATH) -> dict[str, Any]:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


def find_group_by_slug(catalog: dict[str, Any], slug_hint: str) -> dict[str, Any] | None:
    for grp in catalog.get("productGroups") or []:
        if grp.get("slugHint") == slug_hint:
            return grp
    return None


def find_group_by_line(catalog: dict[str, Any], line: str) -> dict[str, Any] | None:
    line_up = line.upper()
    for grp in catalog.get("productGroups") or []:
        if grp.get("line") == line_up:
            return grp
    return None
