#!/usr/bin/env python3
"""Audit Strength-Glute Leader — MIC 86 listings vs 8 canonical GL SKUs."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "mic-factories" / "_shared"))

from mic_logistics import (  # noqa: E402
    analyze_listing_duplicates,
    collect_product_links_http,
    load_json,
    write_json,
)

FACTORY = Path(__file__).parent / "factory.json"
GROUP = Path(__file__).parent / "groups" / "strength-glute-leader.json"
CATALOG = ROOT / "docs" / "homolog" / "realleader-mic-catalog.json"
OUT = ROOT / "docs" / "homolog" / "mic-factories" / "realleader" / "strength-glute-leader-listing-audit.json"

BUCKLER_GL = {"GL-1001", "GL-1002", "GL-1003", "GL-1004", "GL-1005", "GL-1006", "GL-1007", "GL-1009"}


def catalog_gl_skus(catalog: dict) -> list[str]:
    for grp in catalog.get("productGroups") or []:
        if grp.get("line") == "GL" or "Glute" in str(grp.get("slugHint", "")):
            return sorted({p["sku"] for p in grp.get("products") or []})
    return []


def main() -> None:
    factory = load_json(FACTORY)
    group = load_json(GROUP)
    catalog = load_json(CATALOG) if CATALOG.exists() else {}
    base = factory["baseUrl"].rstrip("/")
    sku_pat = group.get("catalogSkuPattern", r"GL-\d{4}")

    print("=== productList API (canonical group filter) ===")
    api_list = collect_product_links_http(
        base_url=base,
        product_group_id=group["productGroupId"],
        max_pages=int(group.get("maxPages", 4)),
        page_size=int(group.get("pageSize", 48)),
    )
    api_audit = analyze_listing_duplicates(api_list, sku_pattern=sku_pat)

    print("\n=== user product-list HTML URL ===")
    user_list = collect_product_links_http(
        base_url=base,
        list_url_template=group.get("listUrlTemplate"),
        max_pages=2,
    )
    user_audit = analyze_listing_duplicates(user_list, sku_pattern=sku_pat)

    catalog_skus = catalog_gl_skus(catalog)

    report = {
        "factory": factory["legalName"],
        "group": group["label"],
        "productListApi": api_audit,
        "userProductListUrl": user_audit,
        "realleaderMicCatalogGlSkus": catalog_skus,
        "bucklerCanonicalGlSkus": sorted(BUCKLER_GL),
        "verdict": {
            "micClaimedTotal": group.get("expectedMicListings"),
            "liveProductListUniqueHash": api_audit["uniqueMicHash"],
            "liveProductListUniqueGlSku": api_audit["uniqueCatalogSku"],
            "duplicateNature": (
                "86 MIC pages are unique hashes (not repeated links); "
                "each GL-xxxx SKU has ~10 SEO listing variants on MIC"
            ),
            "seoPagesPerSku": api_audit.get("skuHashCounts"),
            "recommendScrape": "productList API + dedupeByCatalogSku → 8 rows",
        },
    }

    write_json(OUT, report)

    print("\n" + "=" * 60)
    print(f"productList: {api_audit['uniqueMicHash']} MIC pages -> {api_audit['uniqueCatalogSku']} GL SKUs")
    for sku, n in sorted((api_audit.get("skuHashCounts") or {}).items()):
        print(f"  {sku}: {n} pages")
    print(f"catalog JSON: {len(catalog_skus)} SKUs")
    print(f"Buckler SSOT: {len(BUCKLER_GL)} SKUs")
    print(f"-> {OUT}")
    print("=" * 60)


if __name__ == "__main__":
    main()
