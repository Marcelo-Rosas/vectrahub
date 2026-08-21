#!/usr/bin/env python3
"""
Scrape logístico MIC — Tianzhan / GM Series (Pin Loaded).

Factory: Shandong Tianzhan Fitness Equipment Co., Ltd.
MIC: https://dezhoutianzhan.en.made-in-china.com

Usage:
  pip install -r scripts/mic-factories/requirements.txt
  playwright install chromium

  python scripts/mic-factories/tianzhan/scrape_gm_series_logistics.py
  python scripts/mic-factories/tianzhan/scrape_gm_series_logistics.py --headed
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FACTORY_DIR = Path(__file__).resolve().parent
SHARED = Path(__file__).resolve().parents[1] / "_shared"

sys.path.insert(0, str(SHARED))

from mic_logistics import load_json, run_group_scrape  # noqa: E402


def repo_path(rel: str) -> Path:
    return ROOT / rel


async def main() -> None:
    parser = argparse.ArgumentParser(description="Tianzhan GM Series MIC logistics scrape")
    parser.add_argument("--headed", action="store_true", help="Run browser visible (debug)")
    parser.add_argument(
        "--group-config",
        default=str(FACTORY_DIR / "groups" / "gm-series.json"),
        help="Path to product group JSON",
    )
    args = parser.parse_args()

    factory = load_json(FACTORY_DIR / "factory.json")
    group = load_json(Path(args.group_config))

    out_rel = factory.get("outputDir", "docs/homolog/mic-factories/tianzhan")
    out_file = group.get("outputFile", "gm-series-logistics.json")
    output_path = repo_path(f"{out_rel}/{out_file}")

    scrape_cfg = {**factory.get("scrape", {}), **{k: group[k] for k in ("maxPages",) if k in group}}
    headless = not args.headed and bool(factory.get("scrape", {}).get("headless", True))

    await run_group_scrape(
        factory=factory,
        group=group,
        scrape_cfg=scrape_cfg,
        output_path=output_path,
        headless=headless,
    )


if __name__ == "__main__":
    asyncio.run(main())
