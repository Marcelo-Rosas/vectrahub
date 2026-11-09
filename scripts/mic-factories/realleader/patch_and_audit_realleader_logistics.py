#!/usr/bin/env python3
"""
Patch incremental + kit audit — Realleader logistics JSON (sem re-scrape batch).

- GW=0: patch de buckler fixture / stack-specs / fetch pontual 1 URL
- Pin load: audita kit (caixas A/B/C + pilhas P–Z) vs MIC scrape (1 caixa)
- Não sobrescreve GW suspeito (stack confundido com bruto) — só flag
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts" / "mic-factories" / "_shared"))

from mic_logistics import extract_detail_from_html, fetch_product_html, load_json, write_json  # noqa: E402

OUT_DIR = ROOT / "docs" / "homolog" / "mic-factories" / "realleader"
FIXTURE = ROOT / "src" / "lib" / "__tests__" / "fixtures" / "buckler-caixas-por-medida.json"
STACK_SPECS = ROOT / "docs" / "homolog" / "buckler-stack-specs.json"
CATALOG = ROOT / "docs" / "homolog" / "realleader-mic-catalog.json"

PIN_LOAD_FILES = [
    "Strength_M7_Pro_Series_logistics.json",
    "Strength_M3_Series_logistics.json",
    "Strength_M2_Series_logistics.json",
    "Strength_Glute_Leader_logistics.json",
]

ALL_LOGISTICS_GLOBS = "*_logistics.json"

STACK_BOX_RE = re.compile(r"^[P-Z]$")
CATALOG_GHOST_SKUS = {"M2-1011", "M2-101A"}


def parse_kg(val: Any) -> float:
    if val is None:
        return 0.0
    s = str(val).strip().replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def load_fixture_by_sku() -> dict[str, list[dict[str, Any]]]:
    rows = load_json(FIXTURE)
    by_sku: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        sku = str(row.get("Item", "")).strip().upper()
        if sku:
            by_sku.setdefault(sku, []).append(row)
    return by_sku


def load_stack_specs() -> dict[str, dict[str, Any]]:
    data = load_json(STACK_SPECS)
    return {s["sku"].upper(): s for s in data.get("specs") or []}


def analyze_fixture_kit(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not rows:
        return None
    types = sorted({str(r.get("Tipo Caixa", "")).strip() for r in rows})
    machine = [t for t in types if t and not STACK_BOX_RE.match(t)]
    stack = [t for t in types if STACK_BOX_RE.match(t or "")]
    kit_gw = parse_kg(rows[0].get("Peso Bruto Total (kg)"))
    total_boxes = int(rows[0].get("Qtd. Caixas Total") or len(types) or 1)
    dims_sample = {
        t: {
            "l": rows[[i for i, r in enumerate(rows) if r.get("Tipo Caixa") == t][0]].get("COMPRIMENTO"),
            "w": rows[[i for i, r in enumerate(rows) if r.get("Tipo Caixa") == t][0]].get("LARGURA"),
            "h": rows[[i for i, r in enumerate(rows) if r.get("Tipo Caixa") == t][0]].get("ALTURA"),
        }
        for t in machine[:3]
    }
    return {
        "kitGrossKg": kit_gw,
        "totalBoxTypes": len(types),
        "machineBoxTypes": machine,
        "stackBoxTypes": stack,
        "totalBoxesField": total_boxes,
        "machineDimsSample": dims_sample,
    }


def gw_fallback(sku: str, fixture: dict[str, list], stacks: dict[str, dict]) -> tuple[float, str] | None:
    sku = sku.upper()
    if sku in stacks and stacks[sku].get("kitGrossKg"):
        return float(stacks[sku]["kitGrossKg"]), "buckler-stack-specs.kitGrossKg"
    kit = analyze_fixture_kit(fixture.get(sku, []))
    if kit and kit["kitGrossKg"] > 0:
        return kit["kitGrossKg"], "buckler-fixture.kitGrossKg"
    return None


def fetch_gw_from_url(url: str) -> float:
    status, html = fetch_product_html(url)
    if status != 200:
        return 0.0
    detail = extract_detail_from_html(html)
    return parse_kg(detail.get("gross_weight"))


def audit_row(
    row: dict[str, Any],
    *,
    fixture_kit: dict[str, Any] | None,
    stack_spec: dict[str, Any] | None,
    is_pin_load: bool,
) -> list[str]:
    issues: list[str] = []
    sku = str(row.get("Item", "")).upper()
    if sku in CATALOG_GHOST_SKUS:
        issues.append("catalog_ghost_sku")
        return issues

    mic_gw = parse_kg(row.get("Peso Bruto Total (kg)"))
    mic_boxes = int(row.get("Qtd. Caixas Total") or 1)

    if fixture_kit and is_pin_load:
        if mic_boxes == 1 and fixture_kit["totalBoxTypes"] > 1:
            issues.append(
                f"kit_shape: MIC 1 caixa vs fixture {fixture_kit['totalBoxTypes']} tipos "
                f"(maq {fixture_kit['machineBoxTypes']}, pilha {fixture_kit['stackBoxTypes']})"
            )
        if stack_spec and fixture_kit["stackBoxTypes"] and len(fixture_kit["stackBoxTypes"]) == 0:
            issues.append("fixture_missing_stack_boxes_but_stack_spec_exists")

    if stack_spec and mic_gw > 0:
        oem = float(stack_spec.get("stackKgOem") or 0)
        if oem > 0 and mic_gw >= oem * 3:
            issues.append(
                f"likely_stack_as_gw: MIC {mic_gw}kg vs stackOem {oem}kg "
                f"(fixture kit {stack_spec.get('kitGrossKg')}kg)"
            )

    if fixture_kit and mic_gw > 0:
        fgw = fixture_kit["kitGrossKg"]
        if fgw > 0 and abs(mic_gw - fgw) / fgw > 0.25 and not any("likely_stack" in i for i in issues):
            issues.append(f"gw_delta_fixture: MIC {mic_gw}kg vs fixture kit {fgw}kg")

    if mic_gw == 0:
        issues.append("gw_missing_mic")

    return issues


def process_file(
    path: Path,
    *,
    fixture: dict[str, list],
    stacks: dict[str, dict],
    is_pin_load: bool,
    patch_gw: bool,
    fetch_gw: bool,
) -> dict[str, Any]:
    export = load_json(path)
    rows = export.get("rows") or []
    patches: list[dict[str, Any]] = []
    kit_audits: list[dict[str, Any]] = []

    for row in rows:
        sku = str(row.get("Item", "")).upper()
        fixture_rows = fixture.get(sku, [])
        fixture_kit = analyze_fixture_kit(fixture_rows)
        stack_spec = stacks.get(sku)

        issues = audit_row(row, fixture_kit=fixture_kit, stack_spec=stack_spec, is_pin_load=is_pin_load)
        kit_audits.append(
            {
                "sku": sku,
                "issues": issues,
                "mic": {
                    "boxes": int(row.get("Qtd. Caixas Total") or 1),
                    "gw": parse_kg(row.get("Peso Bruto Total (kg)")),
                    "dims": f"{row.get('COMPRIMENTO')}x{row.get('LARGURA')}x{row.get('ALTURA')}",
                },
                "fixtureKit": fixture_kit,
                "stackSpec": {
                    "plates": stack_spec.get("plates"),
                    "stackKgOem": stack_spec.get("stackKgOem"),
                    "kitGrossKg": stack_spec.get("kitGrossKg"),
                }
                if stack_spec
                else None,
            }
        )

        if not patch_gw or "gw_missing_mic" not in issues:
            continue
        if sku in CATALOG_GHOST_SKUS:
            continue

        fb = gw_fallback(sku, fixture, stacks)
        source = fb[1] if fb else None
        new_gw = fb[0] if fb else 0.0

        if new_gw <= 0 and fetch_gw and row.get("URL_Origem"):
            new_gw = fetch_gw_from_url(str(row["URL_Origem"]))
            if new_gw > 0:
                source = "mic_single_url_fetch"

        if new_gw <= 0:
            continue

        row.setdefault("_micOriginal", {})
        if "Peso Bruto Total (kg)" not in row["_micOriginal"]:
            row["_micOriginal"]["Peso Bruto Total (kg)"] = row.get("Peso Bruto Total (kg)")

        row["Peso Bruto Total (kg)"] = round(new_gw, 2)
        cartons = max(int(row.get("Qtd. Caixas Total") or 1), 1)
        row["Peso Médio por Caixa (kg)"] = round(new_gw / cartons, 2)
        row["Peso Estimado do Grupo (kg)"] = round(new_gw, 2)
        row["_patched"] = {"gwSource": source, "at": datetime.now(timezone.utc).isoformat()}

        patches.append({"sku": sku, "gw": new_gw, "source": source})
        # refresh audit after patch
        kit_audits[-1]["issues"] = [i for i in issues if i != "gw_missing_mic"]
        kit_audits[-1]["mic"]["gw"] = new_gw

    export["kitAudit"] = kit_audits
    export["patches"] = export.get("patches", []) + patches
    export["kitAuditAt"] = datetime.now(timezone.utc).isoformat()

    # revalidate counts only
    from mic_logistics import validate_logistics_export  # noqa: E402

    export["validation"] = validate_logistics_export(export, smoke=False)
    write_json(path, export)

    return {
        "file": path.name,
        "pinLoad": is_pin_load,
        "rows": len(rows),
        "patches": len(patches),
        "kitIssues": sum(1 for a in kit_audits if len(a["issues"]) > 0),
        "validationOk": export["validation"]["ok"],
        "patchSkus": [p["sku"] for p in patches],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--patch-gw", action="store_true", help="aplica GW fallback só onde MIC=0")
    parser.add_argument(
        "--fetch-gw-gaps",
        action="store_true",
        help="HTTP 1 URL se fixture/stack não resolver GW=0",
    )
    parser.add_argument("--file", help="só um JSON (basename)")
    args = parser.parse_args()

    fixture = load_fixture_by_sku()
    stacks = load_stack_specs()

    paths = sorted(OUT_DIR.glob(ALL_LOGISTICS_GLOBS))
    if args.file:
        paths = [OUT_DIR / args.file]

    reports: list[dict[str, Any]] = []
    for path in paths:
        if not path.exists():
            continue
        is_pin = path.name in PIN_LOAD_FILES
        rep = process_file(
            path,
            fixture=fixture,
            stacks=stacks,
            is_pin_load=is_pin,
            patch_gw=args.patch_gw,
            fetch_gw=args.fetch_gw_gaps,
        )
        reports.append(rep)
        print(
            f"{path.name}: patches={rep['patches']} kitIssues={rep['kitIssues']} "
            f"valid={'PASS' if rep['validationOk'] else 'FAIL'}"
        )

    summary_path = OUT_DIR / "realleader-logistics-kit-audit-summary.json"
    write_json(
        summary_path,
        {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "patchGw": args.patch_gw,
            "fetchGwGaps": args.fetch_gw_gaps,
            "files": reports,
        },
    )
    print(f"-> {summary_path}")


if __name__ == "__main__":
    main()
