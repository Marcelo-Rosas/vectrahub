#!/usr/bin/env python3
"""
Template — scrape logístico MIC por grupo de produto.

1. Copie _template/ -> scripts/mic-factories/<factory-id>/
2. Preencha factory.json + groups/<group-id>.json
3. Copie este arquivo para scrape_<group>_logistics.py e ajuste GROUP_CONFIG default
4. Registre em scripts/mic-factories/factories.json

Usage:
  python scripts/mic-factories/<factory-id>/scrape_<group>_logistics.py
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

DEFAULT_GROUP_CONFIG = FACTORY_DIR / "groups" / "__GROUP_ID__.json"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--group-config", default=str(DEFAULT_GROUP_CONFIG))
    args = parser.parse_args()

    factory = load_json(FACTORY_DIR / "factory.json")
    group = load_json(Path(args.group_config))

    out_rel = factory.get("outputDir", f"docs/homolog/mic-factories/{factory['id']}")
    out_file = group.get("outputFile", f"{group['id']}-logistics.json")
    output_path = ROOT / out_rel / out_file

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
