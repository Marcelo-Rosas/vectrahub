#!/usr/bin/env python3
"""Scrape Realleader MIC logistics — full sequence (M7PRO → Cardio)."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "mic-factories" / "_shared"))
sys.path.insert(0, str(Path(__file__).parent))

from mic_logistics import load_json, run_group_scrape_http, write_json  # noqa: E402
from realleader_catalog import (  # noqa: E402
    REALLEADER_SCRAPE_SEQUENCE,
    find_group_by_slug,
    group_entry_to_config,
    load_catalog,
)

FACTORY = Path(__file__).parent / "factory.json"
OUT_DIR = ROOT / "docs" / "homolog" / "mic-factories" / "realleader"
SUMMARY_PATH = OUT_DIR / "realleader-logistics-batch-summary.json"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="3 SKUs per group")
    parser.add_argument("--from-slug", dest="from_slug", help="resume from slugHint")
    parser.add_argument(
        "--skip-gl",
        action="store_true",
        help="omit Strength-Glute-Leader (already scraped)",
    )
    args = parser.parse_args()

    catalog = load_catalog()
    factory = load_json(FACTORY)
    scrape_cfg = factory.get("scrape", {})

    sequence = REALLEADER_SCRAPE_SEQUENCE
    if args.skip_gl:
        sequence = [s for s in sequence if s != "Strength-Glute-Leader"]
    if args.from_slug:
        try:
            start = sequence.index(args.from_slug)
            sequence = sequence[start:]
        except ValueError:
            raise SystemExit(f"unknown slug: {args.from_slug}")

    summary: list[dict] = []
    t0 = time.time()

    for slug in sequence:
        entry = find_group_by_slug(catalog, slug)
        if not entry:
            print(f"SKIP missing catalog group: {slug}")
            continue

        group = group_entry_to_config(entry)
        out_name = group["outputFile"]
        if args.smoke:
            out_name = out_name.replace(".json", "-smoke.json")

        print("\n" + "#" * 60)
        print(f"BATCH: {slug} ({group['expectedProducts']} SKUs)")
        print("#" * 60)

        try:
            export = run_group_scrape_http(
                factory=factory,
                group=group,
                scrape_cfg=scrape_cfg,
                output_path=OUT_DIR / out_name,
                limit=3 if args.smoke else None,
                smoke=args.smoke,
            )
            summary.append(
                {
                    "slugHint": slug,
                    "line": group.get("line"),
                    "outputFile": out_name,
                    "expectedProducts": group.get("expectedProducts"),
                    "scrapedProducts": export.get("scrapedProducts"),
                    "validationOk": (export.get("validation") or {}).get("ok"),
                    "failures": len(export.get("failures") or []),
                }
            )
        except SystemExit as exc:
            summary.append({"slugHint": slug, "error": str(exc), "validationOk": False})
            if args.smoke:
                raise

    batch = {
        "sequence": REALLEADER_SCRAPE_SEQUENCE,
        "completed": [s["slugHint"] for s in summary if s.get("validationOk")],
        "elapsedSec": round(time.time() - t0, 1),
        "groups": summary,
    }
    write_json(SUMMARY_PATH, batch)
    print(f"\nBATCH SUMMARY -> {SUMMARY_PATH}")
    ok = sum(1 for s in summary if s.get("validationOk"))
    print(f"PASS {ok}/{len(summary)}")


if __name__ == "__main__":
    main()
