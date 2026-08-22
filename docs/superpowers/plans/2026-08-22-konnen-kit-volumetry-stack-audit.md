# Konnen Kit Volumetry + Weight-Stack Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Buckler-style audit script + md/json report for the full Konnen shipping-box catalog (volumetry, FEWS/IF93WS/IT95WS pairing, composed kit, 6 functional groups docs-only, OOR gap checklist).

**Architecture:** New `konnenFunctionalGroup` + small volumetry/stack audit helpers; CLI `audit-konnen-kit-volumetry.ts` reads `konnen-catalog-merged.json`, reuses `composeEquipmentWithWeightStack` / `validateCatalogWeights`, writes `docs/feira/homolog/konnen/kit-volumetry-stack-audit.{md,json}`. No UI chip change, no DB import, no fixture fixes.

**Tech Stack:** TypeScript, Vitest, `npx tsx`, existing `shipper-product-catalog` builders.

**Spec:** `docs/superpowers/specs/2026-08-22-konnen-kit-volumetry-stack-audit-design.md`

## Global Constraints

- Volumetry source of truth = shipping boxes in fixtures only — never OOR/site assembly mm or +10% packing
- UI chips stay IMPULSE / XMASTER / ROCKIT (`skuProductLine(..., 'konnen')`)
- Functional groups (PIN LOADED … CARDIO) = docs/audit only
- No fixture mutation, no `import-shipper-product-catalog` for Konnen
- Do not invent Buckler P–Z stack boxes inside Konnen kits
- Commits only when user asks (skip commit steps unless user requested git commit)

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/konnen-functional-group.ts` | SKU+name → 6-group label + stack-kit detection |
| `src/lib/konnen-kit-volumetry-audit.ts` | Pure audit row builders (volumetry flags, stack status, compose summary, OOR cross) |
| `src/lib/__tests__/konnen-functional-group.test.ts` | Group heuristics |
| `src/lib/__tests__/konnen-kit-volumetry-audit.test.ts` | Volumetry/stack/OOR unit tests |
| `scripts/audit-konnen-kit-volumetry.ts` | CLI load fixtures → write md/json |
| `docs/feira/homolog/konnen/oor/volumetria_oor_completa.json` | Copied OOR SKU list (no assembly used) |
| `docs/feira/homolog/konnen/kit-volumetry-stack-audit.md` | Generated report |
| `docs/feira/homolog/konnen/kit-volumetry-stack-audit.json` | Generated machine report |

**Modify (minimal):** `src/lib/shipper-product-catalog.ts` — export `weightStackSkuForEquipment(sku, lbs)` (today private `wsSkuForEquipment`).

---

### Task 1: Export `weightStackSkuForEquipment`

**Files:**
- Modify: `src/lib/shipper-product-catalog.ts` (around `wsSkuForEquipment`)
- Test: `src/lib/__tests__/shipper-product-catalog.test.ts` (add 2–3 asserts in existing Konnen describe or new `it`)

**Interfaces:**
- Consumes: existing `EQUIPMENT_WS_RULES`
- Produces: `export function weightStackSkuForEquipment(sku: string, stackLbs: string): string | null`

- [ ] **Step 1: Write failing test**

Add to `src/lib/__tests__/shipper-product-catalog.test.ts`:

```ts
import { weightStackSkuForEquipment } from '@/lib/shipper-product-catalog';

it('weightStackSkuForEquipment mapeia FE/IF/IT → WS', () => {
  expect(weightStackSkuForEquipment('FE9701', '295')).toBe('FEWS-295');
  expect(weightStackSkuForEquipment('IF9302', '160')).toBe('IF93WS-160');
  expect(weightStackSkuForEquipment('IT9501', '235')).toBe('IT95WS-235');
  expect(weightStackSkuForEquipment('AC2990', '295')).toBeNull();
});
```

- [ ] **Step 2: Run test — expect FAIL (export missing)**

Run: `npx vitest run src/lib/__tests__/shipper-product-catalog.test.ts -t "weightStackSkuForEquipment"`

Expected: FAIL import/export

- [ ] **Step 3: Implement export**

In `shipper-product-catalog.ts`, replace private `wsSkuForEquipment` with:

```ts
export function weightStackSkuForEquipment(sku: string, stackLbs: string): string | null {
  const rule = EQUIPMENT_WS_RULES.find((r) => r.test(sku));
  return rule ? `${rule.wsPrefix}-${stackLbs}` : null;
}
```

Update `composeEquipmentWithWeightStack` to call `weightStackSkuForEquipment`.

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/lib/__tests__/shipper-product-catalog.test.ts -t "weightStackSkuForEquipment"`

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/lib/shipper-product-catalog.ts src/lib/__tests__/shipper-product-catalog.test.ts
git commit -m "feat(konnen): export weightStackSkuForEquipment for audit"
```

---

### Task 2: `konnenFunctionalGroup` helper

**Files:**
- Create: `src/lib/konnen-functional-group.ts`
- Test: `src/lib/__tests__/konnen-functional-group.test.ts`

**Interfaces:**
- Consumes: none (pure string rules)
- Produces:

```ts
export type KonnenFunctionalGroup =
  | 'PIN LOADED'
  | 'PLATE LOADED'
  | 'CABLE CROSS'
  | 'BENCHES & RACKS'
  | 'ACESSORIOS'
  | 'CARDIO'
  | 'OUTROS';

export function isKonnenWeightStackSku(sku: string): boolean;
export function konnenFunctionalGroup(sku: string, name?: string): KonnenFunctionalGroup;
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  konnenFunctionalGroup,
  isKonnenWeightStackSku,
} from '@/lib/konnen-functional-group';

describe('konnenFunctionalGroup', () => {
  it('pin loaded lines', () => {
    expect(konnenFunctionalGroup('FE9701', 'SUPINO')).toBe('PIN LOADED');
    expect(konnenFunctionalGroup('IF9302')).toBe('PIN LOADED');
    expect(konnenFunctionalGroup('IT9501')).toBe('PIN LOADED');
  });
  it('plate / articulados', () => {
    expect(konnenFunctionalGroup('IFP001', 'LEG PRESS')).toBe('PLATE LOADED');
    expect(konnenFunctionalGroup('SL7001')).toBe('PLATE LOADED');
  });
  it('cardio', () => {
    expect(konnenFunctionalGroup('AC2990', 'TREADMILL')).toBe('CARDIO');
    expect(konnenFunctionalGroup('ECE5', 'ELLIPTICAL')).toBe('CARDIO');
  });
  it('weight stack SKUs → ACESSORIOS', () => {
    expect(isKonnenWeightStackSku('FEWS-295')).toBe(true);
    expect(konnenFunctionalGroup('FEWS-295')).toBe('ACESSORIOS');
  });
  it('cable cross by name', () => {
    expect(konnenFunctionalGroup('FE9725', 'CABLE CROSSOVER')).toBe('CABLE CROSS');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/__tests__/konnen-functional-group.test.ts`

- [ ] **Step 3: Implement**

Create `src/lib/konnen-functional-group.ts`:

```ts
export type KonnenFunctionalGroup =
  | 'PIN LOADED'
  | 'PLATE LOADED'
  | 'CABLE CROSS'
  | 'BENCHES & RACKS'
  | 'ACESSORIOS'
  | 'CARDIO'
  | 'OUTROS';

export function isKonnenWeightStackSku(sku: string): boolean {
  const u = sku.trim().toUpperCase();
  return /^(FEWS|IF93WS|IT95WS)-/.test(u);
}

export function konnenFunctionalGroup(sku: string, name = ''): KonnenFunctionalGroup {
  const u = sku.trim().toUpperCase();
  const n = name.toUpperCase();
  if (isKonnenWeightStackSku(u)) return 'ACESSORIOS';
  if (/^(AC|EC|ECE|ECR|ECU|PS|HB|HS|HSR)/.test(u) || /TREADMILL|ELLIPTICAL|BIKE|ROWING|CARDIO/.test(n))
    return 'CARDIO';
  if (/CABLE\s*CROSS|CROSSOVER|HI-?LO\s*PULLEY|DUAL\s*PULLEY/.test(n)) return 'CABLE CROSS';
  if (/^(IFP|SL|ECP|IFL)/.test(u) || /PLATE\s*LOADED|HACK|LEG\s*PRESS/.test(n) && !/^FE97|^IF93|^IT95/.test(u))
    return 'PLATE LOADED';
  if (/BENCH|RACK|BANCO|SUPORTE/.test(n) && !/^FE97|^IF93|^IT95/.test(u)) return 'BENCHES & RACKS';
  if (/^(FE97|IF93|IT95|LCS|AM80)/.test(u)) return 'PIN LOADED';
  if (/ACCESSOR|ANILHA|BARRA|HALTER|WEIGHT\s*PLATE|FEWS/.test(n)) return 'ACESSORIOS';
  return 'OUTROS';
}
```

Tune if any golden asserts fail (prefer name rules after stack/cardio).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/__tests__/konnen-functional-group.test.ts`

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 3: Pure audit helpers (`konnen-kit-volumetry-audit.ts`)

**Files:**
- Create: `src/lib/konnen-kit-volumetry-audit.ts`
- Test: `src/lib/__tests__/konnen-kit-volumetry-audit.test.ts`

**Interfaces:**
- Consumes: `ShipperProductCatalog`, `ShipperProductCatalogEntry`, `validateCatalogWeights`, `sumGroupWeightsKg`, `composeEquipmentWithWeightStack`, `defaultStackLbsForEquipment`, `weightStackSkuForEquipment`, `skuProductLine`, `konnenFunctionalGroup`, `isKonnenWeightStackSku`
- Produces:

```ts
export type KonnenStackStatus = 'ok' | 'missing_ws' | 'na' | 'alias_ok';

export type KonnenVolumetryAuditRow = {
  sku: string;
  name: string;
  commercialLine: string;
  functionalGroup: string;
  kind: 'equipment' | 'weight_stack';
  boxesTotal: number;
  weightKg: number;
  volumeM3: number;
  weightSumOk: boolean;
  uniformBoxWeights: boolean;
  stackLbs: string | null;
  stackSku: string | null;
  stackStatus: KonnenStackStatus;
  composedWeightKg: number | null;
  composedVolumeM3: number | null;
  composedBoxes: number | null;
  issues: string[];
};

export type KonnenOorGapRow = {
  sku: string;
  product: string;
  qty: number;
  inCatalog: boolean;
  stackStatus: KonnenStackStatus | 'n/a';
};

export function auditKonnenCatalogEntry(
  catalog: ShipperProductCatalog,
  entry: ShipperProductCatalogEntry,
  stackLbsBySku?: Record<string, { stackLbs?: string; stackWeightKg?: number }>
): KonnenVolumetryAuditRow;

export function auditKonnenOorSkus(
  catalog: ShipperProductCatalog,
  oor: Record<string, { produto?: string; quantidade_set?: number }>
): KonnenOorGapRow[];

export function summarizeKonnenAudit(rows: KonnenVolumetryAuditRow[]): {
  equipmentCount: number;
  weightStackCount: number;
  weightMismatch: number;
  uniformWeights: number;
  missingWs: number;
  byFunctionalGroup: Record<string, number>;
};
```

- [ ] **Step 1: Write failing tests** using tiny in-memory catalog (2–3 synthetic entries), not full merged JSON:

```ts
import { describe, expect, it } from 'vitest';
import {
  auditKonnenCatalogEntry,
  auditKonnenOorSkus,
  summarizeKonnenAudit,
} from '@/lib/konnen-kit-volumetry-audit';
import type { ShipperProductCatalog, ShipperProductCatalogEntry } from '@/lib/shipper-product-catalog';

function entry(partial: Partial<ShipperProductCatalogEntry> & { sku: string }): ShipperProductCatalogEntry {
  return {
    name: partial.name ?? partial.sku,
    boxesTotal: partial.boxTypes?.length ?? 1,
    boxTypesCount: partial.boxTypes?.length ?? 1,
    weightKgPerUnit: partial.weightKgPerUnit ?? 100,
    volumeM3PerUnit: partial.volumeM3PerUnit ?? 1,
    boxTypes: partial.boxTypes ?? [
      {
        boxType: 'A',
        lengthMm: 1000,
        widthMm: 1000,
        heightMm: 1000,
        boxesPerUnit: 1,
        groupWeightKg: partial.weightKgPerUnit ?? 100,
        volumeM3: 1,
      },
    ],
    ...partial,
  };
}

describe('auditKonnenCatalogEntry', () => {
  it('FE97 + FEWS-295 → stackStatus ok + composed', () => {
    const catalog: ShipperProductCatalog = new Map();
    catalog.set('FE9701', entry({ sku: 'FE9701', name: 'SUPINO', weightKgPerUnit: 200 }));
    catalog.set(
      'FEWS-295',
      entry({ sku: 'FEWS-295', name: 'WEIGHT STACK', weightKgPerUnit: 133.8, volumeM3PerUnit: 0.5 })
    );
    const row = auditKonnenCatalogEntry(catalog, catalog.get('FE9701')!);
    expect(row.functionalGroup).toBe('PIN LOADED');
    expect(row.stackSku).toBe('FEWS-295');
    expect(row.stackStatus).toBe('ok');
    expect(row.composedWeightKg).toBeCloseTo(333.8, 1);
  });

  it('cardio → stackStatus na', () => {
    const catalog: ShipperProductCatalog = new Map();
    catalog.set('AC2990', entry({ sku: 'AC2990', name: 'TREADMILL', weightKgPerUnit: 258 }));
    const row = auditKonnenCatalogEntry(catalog, catalog.get('AC2990')!);
    expect(row.stackStatus).toBe('na');
    expect(row.functionalGroup).toBe('CARDIO');
  });

  it('OOR gap when SKU missing', () => {
    const catalog: ShipperProductCatalog = new Map();
    const gaps = auditKonnenOorSkus(catalog, {
      IT9501: { produto: 'CHEST PRESS', quantidade_set: 1 },
    });
    expect(gaps[0]!.inCatalog).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/__tests__/konnen-kit-volumetry-audit.test.ts`

- [ ] **Step 3: Implement `src/lib/konnen-kit-volumetry-audit.ts`**

Logic sketch:

1. `commercialLine = skuProductLine(sku, 'konnen')`
2. `functionalGroup = konnenFunctionalGroup(sku, name)`
3. `kind = isKonnenWeightStackSku(sku) ? 'weight_stack' : 'equipment'`
4. Weight check: `Math.abs(sumGroupWeightsKg(entry) - entry.weightKgPerUnit) <= 0.1`
5. Uniform: all `groupWeightKg` within 0.01 of first
6. If `defaultStackLbsForEquipment(sku)`:
   - `lbs = stackLbsBySku?.[sku]?.stackLbs ?? default`
   - `stackSku = weightStackSkuForEquipment(sku, lbs)`
   - if `catalog.has(stackSku)` → `ok` else if IT95WS and FEWS exists → `alias_ok` else `missing_ws`
   - `composed = composeEquipmentWithWeightStack(catalog, sku, lbs)`
7. Else `stackStatus = 'na'`
8. Issues array strings for each fail flag

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 4: Stage OOR JSON + CLI script + generate report

**Files:**
- Create: `docs/feira/homolog/konnen/oor/volumetria_oor_completa.json` (copy from Downloads extract)
- Create: `scripts/audit-konnen-kit-volumetry.ts`
- Generate: `docs/feira/homolog/konnen/kit-volumetry-stack-audit.md`
- Generate: `docs/feira/homolog/konnen/kit-volumetry-stack-audit.json`

**Interfaces:**
- Consumes: Task 2–3 APIs + `buildShipperProductCatalog` + `pruneAliasWeightPlates`
- Produces: report files on disk

- [ ] **Step 1: Copy OOR**

```powershell
New-Item -ItemType Directory -Force -Path "docs\feira\homolog\konnen\oor" | Out-Null
Copy-Item "C:\Users\marce\Downloads\Konnen Produtos Site\extracted\volumetria_oor_completa.json" "docs\feira\homolog\konnen\oor\volumetria_oor_completa.json"
```

- [ ] **Step 2: Implement CLI `scripts/audit-konnen-kit-volumetry.ts`**

Behavior:

```ts
// Load merged fixture → buildShipperProductCatalog → pruneAliasWeightPlates
// Optional: load konnen-site-stack-by-sku.json
// Optional --sku= / --group= filters
// For each catalog entry → auditKonnenCatalogEntry
// Load OOR → auditKonnenOorSkus (use only Object.keys + produto/quantidade_set; ignore medidas/volume_*)
// Write JSON { generatedAt, metrics, rows, oorGaps, mappingAppendix }
// Write MD: summary table, by-group sections, issues-only table, OOR gaps, appendix heuristics
```

CLI args: `--sku=`, `--group=`, `--out-dir=docs/feira/homolog/konnen` (default).

MD must state explicitly: **Assembly / OOR packing volumes discarded.**

- [ ] **Step 3: Run full audit**

Run: `npx tsx scripts/audit-konnen-kit-volumetry.ts`

Expected stdout: metrics counts + wrote paths; exit 0.

- [ ] **Step 4: Sanity spot-check**

- Open JSON: `FE9701` has `stackStatus` ok|missing_ws; `AC2990` `na` + CARDIO  
- OOR section lists ~47 SKUs with inCatalog true/false  
- No report field uses OOR `volume_*` as freight total

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/lib/konnen-functional-group.ts src/lib/konnen-kit-volumetry-audit.ts \
  src/lib/__tests__/konnen-functional-group.test.ts src/lib/__tests__/konnen-kit-volumetry-audit.test.ts \
  src/lib/shipper-product-catalog.ts src/lib/__tests__/shipper-product-catalog.test.ts \
  scripts/audit-konnen-kit-volumetry.ts docs/feira/homolog/konnen/
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Full merged catalog audit | Task 4 |
| Ignore assembly/OOR m³ | Task 3–4 (OOR qty only) |
| FEWS map + composed kit (C) | Task 1 + 3 |
| 6 groups docs-only | Task 2 + 4 |
| UI chips unchanged | Global constraint |
| Script + md/json, no fixture fix | Task 4 / non-goals |
| OOR gap checklist | Task 3 `auditKonnenOorSkus` + Task 4 |
| Unit tests | Tasks 1–3 |

No TBD placeholders. Types consistent across tasks.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-22-konnen-kit-volumetry-stack-audit.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, `executing-plans`, checkpoints  

Which approach?
