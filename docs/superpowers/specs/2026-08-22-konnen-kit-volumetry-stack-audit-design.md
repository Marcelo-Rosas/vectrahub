# Konnen kit volumetry + weight-stack audit — design

**Date:** 2026-08-22  
**Status:** approved (Approach 2)  
**Tenant:** Konnen Fitness (`feira` / fixtures)  
**Mirror:** Buckler `kit-stack-battery-audit` (report + script only)

## Goal

Audit the **full Konnen shipping-box catalog** for volumetry consistency and weight-stack pairing, classify SKUs into Buckler-like **functional groups (docs only)**, and cross-check the OOR Impulse sample as a gap checklist. Do **not** change `/feira` chips or reimport DB in this pass.

## Locked decisions

| Topic | Choice |
|-------|--------|
| SKU universe | **B** — full `konnen-catalog-merged` (+ line fixtures); OOR = checklist only |
| UI chips | **A** — keep IMPULSE / XMASTER / ROCKIT; 6 groups = audit docs only |
| Weight stack model | **C** — FEWS/IT95WS/IF93WS SKU map **and** composed kit (equip + default stack) |
| Deliverable | **B** — reusable audit script + md/json report; **no** fixture/DB fixes yet |
| Assembly dims | **Ignore** — OOR assembled mm + 10% packing; site product-size dims not used as freight volume |

## Non-goals

- Migrate Konnen UI chips to PIN LOADED / PLATE LOADED / …
- Invent Buckler-style P–Z stack boxes inside Konnen kits
- Apply OOR assembly volume to freight quotes
- Fix fixture rows or run `import-shipper-product-catalog` for Konnen in this pass
- Re-scrape Konnen site (reuse existing stack map / site audit if present)

## Architecture

```
konnen-catalog-merged.json ──┐
line fixtures (optional) ────┤
konnen-site-stack-by-sku.json┤──► audit-konnen-kit-volumetry.ts ──► md + json
OOR volumetria (SKU list) ───┘         │
composeEquipmentWithWeightStack ◄──────┘ (read-only reuse)
skuProductLineKonnen (line chip) ◄─────┘
konnenFunctionalGroup() (new, docs) ◄──┘
```

### Components

1. **`scripts/audit-konnen-kit-volumetry.ts`**  
   CLI entry. Builds catalog via `buildShipperProductCatalog`, walks equipment SKUs, emits report files.

2. **`src/lib/konnen-functional-group.ts`** (or colocated helpers in script if tiny)  
   Maps SKU + name → one of:  
   `PIN LOADED` · `PLATE LOADED` · `CABLE CROSS` · `BENCHES & RACKS` · `ACESSORIOS` · `CARDIO` · `OUTROS`  
   Heuristics (explicit): FE97/IF93/IT95 (+ LCS/Torq/Encore when present) → `PIN LOADED`; IFP/SL/ECP/articulados → `PLATE LOADED`; dual pulley / cable → `CABLE CROSS`; bancos/racks/FW-like → `BENCHES & RACKS`; EC/AC/PS/HB/HS cardio → `CARDIO`; FEWS/IT95WS/IF93WS + small accessories → `ACESSORIOS`; else `OUTROS`. Document table in report appendix.

3. **Reuse (no rewrite)**  
   - `composeEquipmentWithWeightStack`, `defaultStackLbsForEquipment`, `EQUIPMENT_WS_RULES` / `wsSkuForEquipment` patterns from `shipper-product-catalog.ts`  
   - `pruneAliasWeightPlates` awareness (IT95WS vs FEWS)  
   - Existing `konnen-site-stack-by-sku.json` for lbs/kg when present

### Data sources

| Source | Role |
|--------|------|
| `src/lib/__tests__/fixtures/konnen-catalog-merged.json` | Primary shipping boxes (Item/caixas/mm/kg) — **no** `catalog_group` column |
| Other `konnen-*-caixas-por-medida.json` | Optional enrichment if merged incomplete |
| `konnen-site-stack-by-sku.json` | Optional OEM/site stack lbs → kg |
| OOR JSON | Copy/read `volumetria_oor_completa.json` from Downloads extract (or `docs/feira/homolog/konnen/oor/`); SKU+qty only; **discard** assembly mm/m³ |
| `skuProductLineKonnen` | Commercial line chip column (IMPULSE/XMASTER/ROCKIT) |

**Group is not in the fixture.** Functional group = heuristic in audit; commercial line = SKU prefix.

## Checks (per equipment SKU)

1. **Volumetry (shipping only)**  
   - Sum box `volumeM3` vs `volumeM3PerUnit`  
   - Sum `groupWeightKg` vs `weightKgPerUnit` (flag Δ > 0.1 kg)  
   - Flag **uniform** A–Z group weights (planilha média)  
   - Box count vs `boxesTotal`

2. **Weight stack SKU**  
   - If FE97 / IF93 / IT95 equipment rule matches → expected WS SKU for 160/200/235/295  
   - Report: default 295 present? other lbs present? missing WS?  
   - Alias: IT95WS pruned when FEWS exists → note as OK alias

3. **Composed kit (default 295 lb unless site map says otherwise)**  
   - `composeEquipmentWithWeightStack(catalog, sku, lbs)`  
   - Columns: máquina kg/m³/cx · stack kg/m³/cx · kit total  
   - Plate-loaded / cardio / benches / accessories: stack **not required** (N/A)

4. **Functional group**  
   - Assign 6-group label; include commercial line chip alongside

5. **OOR cross**  
   - For each OOR SKU: in catalog? has shipping boxes? stack rule?  
   - List gaps only (no OOR volume in totals)

## Outputs

| File | Content |
|------|---------|
| `docs/feira/homolog/konnen/kit-volumetry-stack-audit.md` | Executive summary + tables by functional group + OOR gaps |
| `docs/feira/homolog/konnen/kit-volumetry-stack-audit.json` | Machine-readable rows + metrics |
| `scripts/audit-konnen-kit-volumetry.ts` | Generator |

CLI:

```bash
npx tsx scripts/audit-konnen-kit-volumetry.ts
npx tsx scripts/audit-konnen-kit-volumetry.ts --sku=FE9701
npx tsx scripts/audit-konnen-kit-volumetry.ts --group=CARDIO
```

## Error handling

- Missing fixture → fail fast with path  
- Missing OOR zip path → OOR section skipped (warn), full catalog audit still runs  
- Unknown SKU prefix → `OUTROS` + commercial line fallback  
- Compose returns null (no WS) → row `stackStatus: missing` not crash

## Testing

- Unit: `konnenFunctionalGroup` (FE9701→PIN LOADED, AC2990→CARDIO, IFP*→PLATE LOADED, FEWS-295→ACESSORIOS)  
- Golden: script dry run on merged catalog exits 0; JSON has `metrics` + `rows`  
- No e2e / no DB

## Success criteria

- Report covers **all** equipment SKUs in merged catalog (WS SKUs listed as stack kits, not double-counted as machines)  
- Zero use of OOR/site assembly m³ in freight totals  
- UI chips unchanged  
- Gaps listed for OOR 47 SKUs vs shipping catalog  
- Ready for a later fix pass (Approach C) after human review of flags

## Follow-ups (out of this plan)

- Persist `catalog_group` on `feira.products` for Konnen  
- Switch UI chips to 6 groups  
- Fix uniform-weight / missing WS fixtures  
- Reimport Konnen catalog
