#!/usr/bin/env python3
"""
Smoke — Tianzhan GM Series (3 produtos, validação qualidade).

  pip install -r scripts/mic-factories/requirements.txt
  playwright install chromium
  python scripts/mic-factories/tianzhan/smoke_gm_series_logistics.py
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

DEFAULT_LIMIT = 3
SMOKE_OUTPUT = "gm-series-logistics-smoke.json"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke Tianzhan GM Series MIC logistics")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    args = parser.parse_args()

    factory = load_json(FACTORY_DIR / "factory.json")
    group = load_json(FACTORY_DIR / "groups" / "gm-series.json")

    out_rel = factory.get("outputDir", "docs/homolog/mic-factories/tianzhan")
    output_path = ROOT / out_rel / SMOKE_OUTPUT

    scrape_cfg = {**factory.get("scrape", {}), **{k: group[k] for k in ("maxPages",) if k in group}}
    headless = not args.headed and bool(factory.get("scrape", {}).get("headless", True))

    await run_group_scrape(
        factory=factory,
        group=group,
        scrape_cfg=scrape_cfg,
        output_path=output_path,
        headless=headless,
        limit=args.limit,
        smoke=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
