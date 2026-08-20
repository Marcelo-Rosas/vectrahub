# PlayFit Feira Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tenant PlayFit no app feira — motor pallets compartilhado, UI mínima em `/feira/simples` (m² + badge, sem SKU) e catálogo `PBR-PALLET` em `/feira`, com save/PDF/promote Hub.

**Architecture:** `playfit-pallet-gate.ts` estende `fairFreightGate` com pallets + teto por veículo. Config versionada `playfit-tenant-config.ts`. Branch por `tenant.slug === 'playfit'` em `FairSimpleQuotePage` e `FairQuoteCalculator`. Migration seed `feira.companies` + `feira.products` (`PBR-PALLET`). Sem Edge nova.

**Tech Stack:** Vite + React 18 + TS, Supabase Postgres/RLS, TanStack Query, Vitest, shadcn Field/ToggleGroup, `calculate-freight` via `useCalculateFreight`, npm.

**Spec:** `docs/superpowers/specs/2026-08-19-playfit-simple-freight-design.md`

## Global Constraints

- Moeda UI: `formatCurrency` — valores Hub em centavos onde aplicável; exibição sempre R$ 2 casas.
- Peso PlayFit: `weightKg = m2 × 14` (inteiro/arredondado kg no gate via `roundKg` existente).
- Badge 50/60/80: altera **só** `volumeM3PerPallet`; **não** altera `maxPalletsByVehicleCode`.
- Simples `/feira/simples`: **sem** `FairQtyStepper` SKU, **sem** linha catálogo na UI; save linha `PLAYFIT-M2`.
- Catálogo `/feira`: SKU `PBR-PALLET` + stepper + badge + campo m²; save linha `PBR-PALLET`.
- Tipos Supabase: regenerar `types.generated.ts` após migration (`npx supabase gen types` ou workflow repo).
- Edge: `invokeEdgeFunction`; não importar `src/` no Deno.
- npm only. Commits só se humano pedir.
- Konnen/Buckler: zero regressão — branches guardadas por `tenant.slug === 'playfit'`.
- Homolog constants marcadas `// homolog — substituir com PlayFit` até dados reais.

---

## File map

| File | Role |
|------|------|
| `supabase/migrations/20260819200000_feira_playfit_tenant.sql` | Seed company PlayFit + product `PBR-PALLET` |
| `src/lib/playfit-tenant-config.ts` | Branches, badges, max pallets, homolog defaults |
| `src/lib/playfit-pallet-gate.ts` | `playfitLoadMetrics`, `playfitFreightGate` |
| `src/lib/__tests__/playfit-pallet-gate.test.ts` | TDD motor |
| `src/lib/fair-brand-palettes.ts` | Paleta + union slug `playfit` |
| `public/brand/playfit-logo.svg` | Logo tenant |
| `src/components/fair/PlayFitMontageToggle.tsx` | ToggleGroup 50/60/80 reutilizável |
| `src/components/fair/PlayFitSimpleFreightCalculator.tsx` | UI simples (sem catálogo) |
| `src/components/fair/PlayFitCatalogSection.tsx` | UI catálogo: PBR-PALLET + stepper + m² |
| `src/pages/FairSimpleQuote.tsx` | Branch calculator PlayFit |
| `src/components/fair/FairQuoteCalculator.tsx` | Branch PlayFit catálogo |
| `src/lib/playfit-quote-build.ts` | Monta lines + breakdown save por rota |
| `src/lib/fair-quote-pdf.ts` | Bloco PlayFit no PDF |
| `src/hooks/useFairSaveQuote.ts` | Passa `pricing_breakdown.playfit` no hub payload |
| `docs/superpowers/tenants/playfit.md` | Espelho config (já existe — atualizar CEPs quando confirmados) |

**Já existe (reutilizar):** `fairFreightGate`, `FairFreightProfileCard`, `FairQtyStepper`, `FairClientFields`, `useFairSaveQuote`, `downloadFairQuotePdf`, `usePromoteFairQuoteToHub`, `fetchFairRouteKm`, `pickFairPriceTableId`.

**Não fazer (spec §10):** multi-SKU Konnen-style, Edge dedicada, rota `/playfit/*`, tabela preço própria.

---

### Task 1: Config + migration tenant PlayFit

**Files:**
- Create: `src/lib/playfit-tenant-config.ts`
- Create: `supabase/migrations/20260819200000_feira_playfit_tenant.sql`
- Modify: `docs/superpowers/tenants/playfit.md`

**Interfaces:**
- Produces: `PLAYFIT_TENANT_CONFIG`, `PlayFitPlatesPerPallet`, `getPlayFitPalletProfile(plates)`, `getPlayFitBranch(id)`

- [ ] **Step 1: Create config module**

```ts
// src/lib/playfit-tenant-config.ts
export type PlayFitPlatesPerPallet = 50 | 60 | 80;

export type PlayFitBranch = {
  id: string;
  label: string;
  originCep: string;
  originCity: string;
  originUf: string;
};

export type PlayFitPalletProfile = {
  platesPerPallet: PlayFitPlatesPerPallet;
  volumeM3PerPallet: number;
};

export const PLAYFIT_SKU_PALLET = 'PBR-PALLET';
export const PLAYFIT_SKU_M2 = 'PLAYFIT-M2';

export const PLAYFIT_TENANT_CONFIG = {
  kgPerM2: 14,
  m2PerPlate: 0.5, // homolog — substituir com PlayFit
  cubageFactor: 300,
  palletProfiles: [
    { platesPerPallet: 50, volumeM3PerPallet: 1.2 },
    { platesPerPallet: 60, volumeM3PerPallet: 1.4 },
    { platesPerPallet: 80, volumeM3PerPallet: 1.8 },
  ] satisfies PlayFitPalletProfile[],
  maxPalletsByVehicleCode: {
    VUC: 4,
    TOCO: 8,
    TRUCK: 16,
    BI_TRUCK: 20,
    CARRETA_3: 26,
    CARRETA_4: 30,
    RODOTREM: 33,
  } as Record<string, number>,
  branches: [
    { id: 'fortaleza', label: 'Filial Fortaleza', originCep: '60000000', originCity: 'Fortaleza', originUf: 'CE' },
    { id: 'recife', label: 'Filial Recife', originCep: '50000000', originCity: 'Recife', originUf: 'PE' },
    { id: 'salvador', label: 'Filial Salvador', originCep: '40000000', originCity: 'Salvador', originUf: 'BA' },
    { id: 'fabrica', label: 'Fábrica / matriz', originCep: '88000000', originCity: 'Itajaí', originUf: 'SC' },
  ] satisfies PlayFitBranch[],
} as const;

export function getPlayFitPalletProfile(plates: PlayFitPlatesPerPallet): PlayFitPalletProfile {
  return (
    PLAYFIT_TENANT_CONFIG.palletProfiles.find((p) => p.platesPerPallet === plates) ??
    PLAYFIT_TENANT_CONFIG.palletProfiles[1]
  );
}

export function getPlayFitBranch(id: string): PlayFitBranch | undefined {
  return PLAYFIT_TENANT_CONFIG.branches.find((b) => b.id === id);
}
```

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/20260819200000_feira_playfit_tenant.sql
INSERT INTO feira.companies (
  slug, name, origin_city, origin_uf, origin_label, origin_cep,
  email_domains, event_flag, toll_fallback_percent
)
VALUES (
  'playfit',
  'PlayFit Pisos',
  'Itajaí',
  'SC',
  'Itajaí - SC',
  '88000000',
  ARRAY['playfitpisos.com.br'],
  'PLAYFIT',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  email_domains = EXCLUDED.email_domains,
  event_flag = EXCLUDED.event_flag,
  toll_fallback_percent = EXCLUDED.toll_fallback_percent;

INSERT INTO feira.products (
  company_id, sku, name, boxes_total, box_types_count,
  weight_kg_per_unit, volume_m3_per_unit
)
SELECT
  c.id,
  'PBR-PALLET',
  'Pallet PBR',
  1,
  3,
  0,
  1.4
FROM feira.companies c
WHERE c.slug = 'playfit'
ON CONFLICT (company_id, sku) DO UPDATE SET
  name = EXCLUDED.name,
  volume_m3_per_unit = EXCLUDED.volume_m3_per_unit;

INSERT INTO feira.product_boxes (
  product_id, box_type, length_mm, width_mm, height_mm,
  boxes_per_unit, group_weight_kg, volume_m3
)
SELECT p.id, v.box_type, 1200, 1000, 150, 1, 0, v.vol
FROM feira.products p
JOIN feira.companies c ON c.id = p.company_id
CROSS JOIN (VALUES ('50', 1.2), ('60', 1.4), ('80', 1.8)) AS v(box_type, vol)
WHERE c.slug = 'playfit' AND p.sku = 'PBR-PALLET'
ON CONFLICT (product_id, box_type) DO UPDATE SET volume_m3 = EXCLUDED.volume_m3;

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Apply migration + regen types**

```bash
npx supabase db push
npx supabase gen types typescript --project-id lrbtbrpoklgwaaclbufz > src/integrations/supabase/types.generated.ts
```

Expected: company `playfit` + product `PBR-PALLET` visíveis no SQL editor.

- [ ] **Step 4: Commit** *(só se humano pedir)*

---

### Task 2: Motor `playfit-pallet-gate` (TDD)

**Files:**
- Create: `src/lib/playfit-pallet-gate.ts`
- Create: `src/lib/__tests__/playfit-pallet-gate.test.ts`

**Interfaces:**
- Consumes: `fairFreightGate`, `FAIR_VEHICLE_LADDER`, `PLAYFIT_TENANT_CONFIG`
- Produces:
  - `playfitLoadMetrics(input: PlayFitLoadInput): PlayFitLoadMetrics`
  - `playfitFreightGate(input: PlayFitGateInput): PlayFitGateResult`
  - `PlayFitLoadInput = { m2: number; platesPerPallet: PlayFitPlatesPerPallet; palletQtyOverride?: number | null }`
  - `PlayFitLoadMetrics = { plates: number; pallets: number; weightKg: number; volumeM3: number; platesPerPallet: PlayFitPlatesPerPallet }`
  - `PlayFitGateResult = FairFreightGateResult & { load: PlayFitLoadMetrics }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { playfitLoadMetrics, playfitFreightGate } from '@/lib/playfit-pallet-gate';

describe('playfitLoadMetrics', () => {
  it('2500 m² → 5000 placas, 84 pallets @60, peso 35000 kg', () => {
    const m = playfitLoadMetrics({ m2: 2500, platesPerPallet: 60 });
    expect(m.plates).toBe(5000);
    expect(m.pallets).toBe(84);
    expect(m.weightKg).toBe(35000);
    expect(m.volumeM3).toBeCloseTo(84 * 1.4, 2);
  });

  it('override palletQty usa stepper catálogo', () => {
    const m = playfitLoadMetrics({ m2: 2500, platesPerPallet: 60, palletQtyOverride: 90 });
    expect(m.pallets).toBe(90);
    expect(m.volumeM3).toBeCloseTo(90 * 1.4, 2);
  });

  it('badge 80 aumenta volume por pallet', () => {
    const m60 = playfitLoadMetrics({ m2: 100, platesPerPallet: 60 });
    const m80 = playfitLoadMetrics({ m2: 100, platesPerPallet: 80 });
    expect(m80.volumeM3).toBeGreaterThan(m60.volumeM3);
  });
});

describe('playfitFreightGate', () => {
  it('35000 kg → dedicado com veículo que cabe pallets', () => {
    const gate = playfitFreightGate({ m2: 2500, platesPerPallet: 60 });
    expect(gate.mode).toBe('dedicado');
    expect(gate.load.pallets).toBe(84);
    expect(gate.suggestedVehicle).not.toBeNull();
    const max = gate.suggestedVehicle!.code;
    expect(gate.alerts.some((a) => a.code === 'pallets_exceed_vehicle')).toBe(false);
    expect(max).toBeTruthy();
  });

  it('500 m² → fracionado, sem veículo', () => {
    const gate = playfitFreightGate({ m2: 500, platesPerPallet: 60 });
    expect(gate.mode).toBe('fracionado');
    expect(gate.suggestedVehicle).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/__tests__/playfit-pallet-gate.test.ts
```

Expected: FAIL module not found.

- [ ] **Step 3: Implement motor**

```ts
// src/lib/playfit-pallet-gate.ts
import {
  fairFreightGate,
  FAIR_VEHICLE_LADDER,
  type FairFreightGateResult,
} from '@/lib/fair-freight-gate';
import {
  getPlayFitPalletProfile,
  PLAYFIT_TENANT_CONFIG,
  type PlayFitPlatesPerPallet,
} from '@/lib/playfit-tenant-config';

export type PlayFitLoadInput = {
  m2: number;
  platesPerPallet: PlayFitPlatesPerPallet;
  palletQtyOverride?: number | null;
};

export type PlayFitLoadMetrics = {
  plates: number;
  pallets: number;
  weightKg: number;
  volumeM3: number;
  platesPerPallet: PlayFitPlatesPerPallet;
};

export type PlayFitGateInput = PlayFitLoadInput;

export type PlayFitGateResult = FairFreightGateResult & { load: PlayFitLoadMetrics };

function ceilPos(n: number): number {
  return Math.max(0, Math.ceil(n));
}

export function playfitLoadMetrics(input: PlayFitLoadInput): PlayFitLoadMetrics {
  const { m2PerPlate, kgPerM2 } = PLAYFIT_TENANT_CONFIG;
  const profile = getPlayFitPalletProfile(input.platesPerPallet);
  const plates = ceilPos(m2 / m2PerPlate);
  const autoPallets = ceilPos(plates / profile.platesPerPallet);
  const pallets =
    input.palletQtyOverride != null && input.palletQtyOverride > 0
      ? Math.floor(input.palletQtyOverride)
      : autoPallets;
  const weightKg = m2 * kgPerM2;
  const volumeM3 = pallets * profile.volumeM3PerPallet;
  return { plates, pallets, weightKg, volumeM3, platesPerPallet: input.platesPerPallet };
}

function suggestPlayFitVehicle(
  billableWeightKg: number,
  pallets: number
): FairFreightGateResult['suggestedVehicle'] {
  const { maxPalletsByVehicleCode } = PLAYFIT_TENANT_CONFIG;
  const match = FAIR_VEHICLE_LADDER.find(
    (v) =>
      v.capacityKg >= billableWeightKg &&
      (maxPalletsByVehicleCode[v.code] ?? 0) >= pallets
  );
  if (match) {
    return {
      code: match.code,
      name: match.name,
      axesCount: match.axesCount,
      capacityKg: match.capacityKg,
      pbtHint: match.pbtHint,
    };
  }
  const byWeight = FAIR_VEHICLE_LADDER.find((v) => v.capacityKg >= billableWeightKg);
  return byWeight
    ? {
        code: byWeight.code,
        name: byWeight.name,
        axesCount: byWeight.axesCount,
        capacityKg: byWeight.capacityKg,
        pbtHint: byWeight.pbtHint,
      }
    : null;
}

export function playfitFreightGate(input: PlayFitGateInput): PlayFitGateResult {
  const load = playfitLoadMetrics(input);
  const base = fairFreightGate({
    weightKg: load.weightKg,
    volumeM3: load.volumeM3,
    cubageFactor: PLAYFIT_TENANT_CONFIG.cubageFactor,
    manualMode: 'auto',
  });

  const alerts = [...base.alerts];
  let suggestedVehicle = base.suggestedVehicle;

  if (base.mode === 'dedicado') {
    suggestedVehicle = suggestPlayFitVehicle(base.billableWeightKg, load.pallets);
    const maxPallets = suggestedVehicle
      ? PLAYFIT_TENANT_CONFIG.maxPalletsByVehicleCode[suggestedVehicle.code]
      : undefined;
    if (suggestedVehicle && maxPallets != null && load.pallets > maxPallets) {
      alerts.push({
        level: 'warning',
        code: 'pallets_exceed_vehicle',
        message: `Pallets (${load.pallets}) excedem capacidade do ${suggestedVehicle.name} (${maxPallets}).`,
      });
    }
    if (!FAIR_VEHICLE_LADDER.some(
      (v) =>
        v.capacityKg >= base.billableWeightKg &&
        (PLAYFIT_TENANT_CONFIG.maxPalletsByVehicleCode[v.code] ?? 0) >= load.pallets
    )) {
      alerts.push({
        level: 'warning',
        code: 'no_vehicle_fits_pallets',
        message: 'Nenhum veículo da escada comporta peso e pallets juntos.',
      });
    }
  }

  return { ...base, suggestedVehicle, alerts, load };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/playfit-pallet-gate.test.ts
```

- [ ] **Step 5: Commit** *(só se humano pedir)*

---

### Task 3: Brand PlayFit (paleta + logo)

**Files:**
- Modify: `src/lib/fair-brand-palettes.ts`
- Create: `public/brand/playfit-logo.svg`

**Interfaces:**
- Produces: `resolveFairPalette('playfit')` funcional; logo em `/brand/playfit-logo.svg`

- [ ] **Step 1: Add palette** — copiar estrutura `KONNEN_FAIR_PALETTE`; slug union `'playfit'`; cores verde sustentável (`#2D6A4F` primary, `#95D5B2` accent — ajustar contra site).

- [ ] **Step 2: Add minimal SVG logo** — wordmark "PlayFit" ou placeholder vetorial verde (substituir asset oficial depois).

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Abrir `/feira/simples` logado domínio PlayFit *(após Task 4)* ou forçar `resolveFairPalette('playfit')` no preview `public/brand/feira-palettes.html` se existir entrada.

- [ ] **Step 4: Commit** *(só se humano pedir)*

---

### Task 4: UI simples — `PlayFitSimpleFreightCalculator`

**Files:**
- Create: `src/components/fair/PlayFitMontageToggle.tsx`
- Create: `src/components/fair/PlayFitSimpleFreightCalculator.tsx`
- Modify: `src/pages/FairSimpleQuote.tsx`

**Interfaces:**
- Consumes: `playfitFreightGate`, `PLAYFIT_TENANT_CONFIG`, `useCalculateFreight`, `fetchFairRouteKm`, `pickFairPriceTableId`, `FairFreightProfileCard`
- Produces: componente exportado; **sem** catálogo SKU

- [ ] **Step 1: `PlayFitMontageToggle`**

```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PlayFitPlatesPerPallet } from '@/lib/playfit-tenant-config';

type Props = {
  value: PlayFitPlatesPerPallet;
  onChange: (v: PlayFitPlatesPerPallet) => void;
};

export function PlayFitMontageToggle({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={String(value)}
      onValueChange={(v) => v && onChange(Number(v) as PlayFitPlatesPerPallet)}
    >
      {[50, 60, 80].map((n) => (
        <ToggleGroupItem key={n} value={String(n)} aria-label={`${n} placas por pallet`}>
          {n}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
```

- [ ] **Step 2: Build calculator** — espelhar `FairSimpleFreightCalculator.tsx`:
  - State: `branchId`, `destCep`, `m2Input`, `cargoValue`, `platesPerPallet` (default 60), `kmDistance`
  - Origin CEP/label de `getPlayFitBranch(branchId)`
  - `gate = playfitFreightGate({ m2, platesPerPallet })` — **sem** `palletQtyOverride`
  - `FairFreightProfileCard` com `showManualOverride={false}`
  - Exibir read-only: pallets estimados (`gate.load.pallets`), volume
  - Calcular frete: `weight_kg: gate.billableWeightKg`, `volume_m3: gate.load.volumeM3`, vehicle do gate

- [ ] **Step 3: Branch em `FairSimpleQuotePage`**

```tsx
import { PlayFitSimpleFreightCalculator } from '@/components/fair/PlayFitSimpleFreightCalculator';

// dentro do main, após tenant resolve:
{tenant.slug === 'playfit' ? (
  <PlayFitSimpleFreightCalculator tenant={tenant} />
) : (
  <FairSimpleFreightCalculator />
)}
```

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

`/feira/simples` tenant PlayFit: filial, m², badge, sem stepper PBR.

- [ ] **Step 5: Commit** *(só se humano pedir)*

---

### Task 5: UI catálogo — branch PlayFit em `/feira`

**Files:**
- Create: `src/components/fair/PlayFitCatalogSection.tsx`
- Modify: `src/components/fair/FairQuoteCalculator.tsx`

**Interfaces:**
- Consumes: `useFairProductCatalog` (SKU `PBR-PALLET`), `playfitFreightGate`, `PlayFitMontageToggle`, `FairQtyStepper`
- Produces: seção catálogo PlayFit integrada quando `tenant.slug === 'playfit'`

- [ ] **Step 1: `PlayFitCatalogSection`**

Props: `m2`, `onM2Change`, `platesPerPallet`, `onPlatesChange`, `palletQty`, `onPalletQtyChange`, `palletQtyManual`, `onPalletQtyManualChange`.

Lógica sync:
- `autoPallets = playfitLoadMetrics({ m2, platesPerPallet }).pallets`
- Se `!palletQtyManual`, `palletQty = autoPallets`
- Ao mudar m² ou badge com manual=false → recalc stepper
- Se usuário clica stepper → `palletQtyManual = true`; toast se `palletQty !== autoPallets`

UI: Card "Pallet PBR" (`PBR-PALLET`), `FairQtyStepper`, `PlayFitMontageToggle`, input m².

- [ ] **Step 2: Branch early em `FairQuoteCalculator`**

Quando `tenant?.slug === 'playfit'`:
- Ocultar busca multi-SKU / import PDF Konnen
- Render `PlayFitCatalogSection` no lugar do picker de linhas
- Gate: `playfitFreightGate({ m2, platesPerPallet, palletQtyOverride: palletQtyManual ? palletQty : null })`
- Agregação carga: peso/volume/boxes de `gate.load`

Quando slug ≠ playfit: fluxo atual intacto.

- [ ] **Step 3: Smoke catálogo**

```bash
npm run dev
```

`/feira` PlayFit: PBR-PALLET + stepper + badge + m²; Konnen ainda abre catálogo normal.

- [ ] **Step 4: Commit** *(só se humano pedir)*

---

### Task 6: Save, PDF, promote

**Files:**
- Create: `src/lib/playfit-quote-build.ts`
- Modify: `src/components/fair/PlayFitSimpleFreightCalculator.tsx`
- Modify: `src/components/fair/FairQuoteCalculator.tsx` (ou wrapper save PlayFit)
- Modify: `src/hooks/useFairSaveQuote.ts`
- Modify: `src/lib/fair-quote-pdf.ts`

**Interfaces:**
- Produces:
  - `buildPlayfitQuotePayload(args): { lines; playfitBreakdown; boxesCount }`
  - `args.source: 'simples' | 'catalogo'`

- [ ] **Step 1: Quote build helper**

```ts
// src/lib/playfit-quote-build.ts
export function buildPlayfitQuotePayload(input: {
  source: 'simples' | 'catalogo';
  m2: number;
  branchId: string;
  platesPerPallet: PlayFitPlatesPerPallet;
  load: PlayFitLoadMetrics;
}) {
  const sku = input.source === 'simples' ? PLAYFIT_SKU_M2 : PLAYFIT_SKU_PALLET;
  const quantity = input.source === 'simples' ? input.m2 : input.load.pallets;
  return {
    lines: [{
      sku,
      quantity,
      selectedBoxTypes: [String(input.platesPerPallet)],
    }],
    boxesCount: input.load.pallets,
    playfitBreakdown: {
      m2: input.m2,
      palletQty: input.load.pallets,
      platesPerPallet: input.platesPerPallet,
      branchId: input.branchId,
      source: input.source,
      sku,
      plates: input.load.plates,
      kgPerM2: PLAYFIT_TENANT_CONFIG.kgPerM2,
    },
  };
}
```

- [ ] **Step 2: Wire save em ambas UIs**

Reutilizar `FairClientFields` + `useFairSaveQuote`. Draft inclui:
- `lines`, `boxesCount`, `weightKg`, `volumeM3` do gate
- `freightModality`, `vehicleTypeCode`, `gateAlerts` do gate
- Passar em `hub.pricing_breakdown`: `{ playfit: playfitBreakdown, freight_gate: ... }`

Ajuste mínimo em `useFairSaveQuote.ts`:

```ts
pricing_breakdown: {
  km_band_label: draft.kmBandLabel,
  playfit: draft.playfitBreakdown ?? null,
},
```

*(Adicionar `playfitBreakdown?` opcional em `FairQuoteDraft`.)*

- [ ] **Step 3: PDF bloco PlayFit**

Em `downloadFairQuotePdf`, se `quote.playfitBreakdown` ou parse de lines SKU PlayFit:

```ts
notes: [
  fairPdfDisclaimer(),
  `PlayFit · ${breakdown.m2} m² · ${breakdown.palletQty} pallets · montagem ${breakdown.platesPerPallet} placas/pallet`,
  breakdown.branchId ? `Origem filial: ${breakdown.branchId}` : '',
].filter(Boolean).join('\n'),
```

- [ ] **Step 4: Promote smoke**

Dashboard `/feira/dashboard` → promote quote PlayFit → verificar `public.quotes` notes contém `feira-source:` e lines mapeadas.

`usePromoteFairQuoteToHub` — **sem mudança** se `buildFairWonHubInsert` já serializa lines genéricas; se falhar SKU desconhecido, mapear `PLAYFIT-M2` / `PBR-PALLET` como `cargo_type` texto em `fair-hub-clone.ts` (só se teste falhar).

- [ ] **Step 5: Commit** *(só se humano pedir)*

---

### Task 7: Testes regressão + deploy feira

**Files:**
- Modify: `src/lib/__tests__/playfit-pallet-gate.test.ts` (casos edge se faltarem)
- Optional: `scripts/smoke-playfit-feira.ts`

- [ ] **Step 1: Full vitest gate suite**

```bash
npx vitest run src/lib/__tests__/playfit-pallet-gate.test.ts src/lib/__tests__/fair-freight-gate.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 3: Build + deploy feira**

```bash
npm run build
npm run deploy:feira
```

Expected: Cloudflare Pages `vectra-feira` OK; `/feira/simples` + `/feira` PlayFit em prod.

- [ ] **Step 4: Checklist homolog pós-deploy**

- [ ] Signup `@playfitpisos.com.br` funciona; outro domínio bloqueado
- [ ] Simples: m² + badge, sem PBR stepper
- [ ] Catálogo: PBR-PALLET + stepper + badge
- [ ] Save + PDF + promote
- [ ] Buckler/Konnen smoke rápido sem regressão

---

## Self-review (spec coverage)

| Spec § | Task |
|--------|------|
| Duas rotas simples vs catálogo | Task 4, 5 |
| Motor compartilhado | Task 2 |
| Migration tenant + PBR-PALLET | Task 1 |
| Badge volume only | Task 2 tests |
| Save PLAYFIT-M2 vs PBR-PALLET | Task 6 |
| PDF + promote | Task 6, 7 |
| Brand | Task 3 |
| Auth domain | Task 1 migration (trigger já existe) |
| Fora de escopo respeitado | File map |

**Placeholder scan:** homolog constants explicit in config with comment — OK per spec §4.2.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-19-playfit-feira.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
