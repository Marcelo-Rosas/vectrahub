#!/usr/bin/env python3
"""Scrape one Realleader MIC group — config from realleader-mic-catalog.json."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "mic-factories" / "_shared"))
sys.path.insert(0, str(Path(__file__).parent))

from mic_logistics import load_json, run_group_scrape_http  # noqa: E402
from realleader_catalog import (  # noqa: E402
    REALLEADER_SCRAPE_SEQUENCE,
    find_group_by_line,
    find_group_by_slug,
    group_entry_to_config,
    load_catalog,
)

FACTORY = Path(__file__).parent / "factory.json"
OUT_DIR = ROOT / "docs" / "homolog" / "mic-factories" / "realleader"


def resolve_group_entry(catalog: dict, *, slug: str | None, line: str | None) -> dict:
    if slug:
        entry = find_group_by_slug(catalog, slug)
        if not entry:
            raise SystemExit(f"group not found: slug={slug}")
        return entry
    if line:
        entry = find_group_by_line(catalog, line)
        if not entry:
            raise SystemExit(f"group not found: line={line}")
        return entry
    raise SystemExit("pass --slug or --line")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slug", help=f"slugHint e.g. {REALLEADER_SCRAPE_SEQUENCE[0]}")
    parser.add_argument("--line", help="OEM line e.g. M7PRO")
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    catalog = load_catalog()
    entry = resolve_group_entry(catalog, slug=args.slug, line=args.line)
    group = group_entry_to_config(entry)
    factory = load_json(FACTORY)
    scrape_cfg = factory.get("scrape", {})

    limit = args.limit
    if args.smoke and limit is None:
        limit = 3

    out_name = group["outputFile"]
    if args.smoke:
        out_name = out_name.replace(".json", "-smoke.json")

    print(f"group: {group['label']} | {group['expectedProducts']} SKUs | {out_name}")

    run_group_scrape_http(
        factory=factory,
        group=group,
        scrape_cfg=scrape_cfg,
        output_path=OUT_DIR / out_name,
        limit=limit,
        smoke=args.smoke,
    )


if __name__ == "__main__":
    main()
