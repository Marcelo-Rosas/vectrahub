#!/usr/bin/env python3
"""Scrape Strength-Glute Leader logistics — HTTP fetch, dedupe GL-xxxx."""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "mic-factories" / "_shared"))

from mic_logistics import load_json, run_group_scrape, run_group_scrape_http  # noqa: E402

FACTORY = Path(__file__).parent / "factory.json"
GROUP = Path(__file__).parent / "groups" / "strength-glute-leader.json"
OUT_DIR = ROOT / "docs" / "homolog" / "mic-factories" / "realleader"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="scrape first 3 + strict validation")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    factory = load_json(FACTORY)
    group = load_json(GROUP)
    scrape_cfg = factory.get("scrape", {})

    limit = args.limit
    if args.smoke and limit is None:
        limit = 3

    out_name = group.get("outputFile", "Strength_Glute_Leader_logistics.json")
    if args.smoke:
        out_name = out_name.replace(".json", "-smoke.json")

    output_path = OUT_DIR / out_name
    fetch_mode = group.get("fetchMode") or factory.get("fetchMode", "playwright")

    if fetch_mode == "http":
        run_group_scrape_http(
            factory=factory,
            group=group,
            scrape_cfg=scrape_cfg,
            output_path=output_path,
            limit=limit,
            smoke=args.smoke,
        )
    else:
        asyncio.run(
            run_group_scrape(
                factory=factory,
                group=group,
                scrape_cfg=scrape_cfg,
                output_path=output_path,
                headless=True,
                limit=limit,
                smoke=args.smoke,
            )
        )


if __name__ == "__main__":
    main()
