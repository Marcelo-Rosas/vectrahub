# Pricing Rules by Methodology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar precificação em `pricing_rules_config` com packs por metodologia (`lotacao` | `fracionado_ntc` | `fracionado_parceiro`), alinhando QuoteForm + Edge, e congelar edição duplicada em `pricing_parameters`.

**Architecture:** `price_tables.methodology` define o pack; `pricing_rules_config.methodology` (obrigatório em regras comerciais) + unique `(key, vehicle_type_id, methodology) NULLS NOT DISTINCT`. Resolve: override cotação → (key, meth, vehicle) → (key, meth, NULL) → `FREIGHT_CONSTANTS`. Fiscal Hub só em `lotacao` e `fracionado_ntc`. Motor B+C parceiro fica fora (spec irmã).

**Tech Stack:** Vite + React 18 + TS, Supabase Postgres/RLS/Edge (Deno), TanStack Query, Vitest (`npx vitest`), shadcn Tabs.

**Spec:** `docs/superpowers/specs/2026-08-01-pricing-rules-by-methodology-design.md`

## Global Constraints

- Moeda: centavos no DB; UI com R$ + 2 casas.
- Tipos: preferir `@/integrations/supabase/types.generated` após regen; espelhar em `src/types/pricing.ts` / hooks se necessário.
- Edge: chamar via `invokeEdgeFunction`; lógica shared em `supabase/functions/_shared/pricing-rules.ts`.
- Sem Bun; usar npm.
- Não implementar motor B+C / import RVL / drop físico de `pricing_parameters` neste plano.
- Fiscal **nunca** no pack `fracionado_parceiro`.
- Sem fallback comercial `methodology NULL` após seed.
- Commits: só quando humano pedir; passos Commit ficam no plano para o executor lembrar.

---

## File map

| File | Role |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_price_tables_methodology.sql` | Coluna + backfill `price_tables.methodology` |
| `supabase/migrations/YYYYMMDDHHMMSS_pricing_rules_methodology.sql` | Coluna + unique + seed 3 packs |
| `src/lib/pricingMethodology.ts` | Tipos, labels, modality derive, margin key map (client) |
| `src/hooks/usePricingRules.ts` | `PricingRuleConfig.methodology` + `resolvePricingRule` novo shape |
| `src/lib/tax-regime-resolve.ts` | Passa `methodology` no resolve |
| `supabase/functions/_shared/pricing-rules.ts` | Fetch/select methodology; resolve; `buildDynamicFreightParams` |
| `supabase/functions/calculate-freight/index.ts` | Lê methodology da tabela; margem por pack |
| `src/components/forms/QuoteForm.tsx` | Badge + sync table→modality/pack; gancho margem parceiro |
| `src/components/pricing/PricingRulesTab.tsx` | Remove accordion Impostos overlap |
| `src/components/pricing/PricingRulesManager.tsx` | Tabs Lotação / NTC / Parceiro |
| `src/hooks/usePricingRulesMutations.ts` | Insert com `methodology` |
| `src/lib/__tests__/resolvePricingRule.test.ts` | Unit precedence |
| `scripts/audit-pricing-dup-keys.ts` | Audit keys overlap (Fase 0) |

---

### Task 1: Freeze duplicate `pricing_parameters` editors (Fase 0)

**Files:**
- Modify: `src/components/pricing/PricingRulesTab.tsx`
- Create: `scripts/audit-pricing-dup-keys.ts`
- Test: manual + script dry-run

**Interfaces:**
- Consumes: `PricingParametersSection`, `usePricingParameters`
- Produces: accordion “Impostos e Margens” vira aviso redirect; script lista keys duplicadas

- [ ] **Step 1: Replace Impostos e Margens accordion body with redirect**

In `PricingRulesTab.tsx`, replace the `taxes-margins` `AccordionContent` that renders:

```tsx
<PricingParametersSection
  includeKeys={['das_percent', 'markup_percent', 'overhead_percent']}
/>
```

with:

```tsx
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Editado na Central de Regras</AlertTitle>
  <AlertDescription>
    DAS, Markup e Overhead agora vivem em Central de Regras (por metodologia). Não edite
    mais em pricing_parameters.
  </AlertDescription>
</Alert>
```

Import `Alert`, `AlertTitle`, `AlertDescription` from `@/components/ui/alert` and `AlertCircle` from `lucide-react` if missing.

Keep accordion “Parâmetros Gerais” for non-overlap keys (`cubage_factor`, `correction_factor_inctf`, etc.). Optionally pass `excludeKeys={['das_percent','markup_percent','overhead_percent']}` into `PricingParametersSection` if that prop exists; else filter inside section or leave read-only note.

- [ ] **Step 2: Add exclude support if needed**

If `PricingParametersSection` has no `excludeKeys`, extend props:

```tsx
interface PricingParametersSectionProps {
  includeKeys?: string[];
  excludeKeys?: string[];
}
```

Filter:

```tsx
const parameters = (allParameters ?? []).filter((p) => {
  if (includeKeys?.length) return includeKeys.includes(p.key);
  if (excludeKeys?.length) return !excludeKeys.includes(p.key);
  return true;
});
```

Use `excludeKeys={['das_percent','markup_percent','overhead_percent']}` on Parâmetros Gerais.

- [ ] **Step 3: Write audit script**

Create `scripts/audit-pricing-dup-keys.ts`:

```ts
/**
 * Lista keys presentes em pricing_parameters e pricing_rules_config com valores diferentes.
 * Uso: npx tsx scripts/audit-pricing-dup-keys.ts
 * Requer SUPABASE_URL + SUPABASE_SECRET_KEY (Hub) no env.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY');
  process.exit(1);
}

const sb = createClient(url, key);
const OVERLAP = ['das_percent', 'markup_percent', 'overhead_percent', 'profit_margin_percent'];

async function main() {
  const [{ data: params }, { data: rules }] = await Promise.all([
    sb.from('pricing_parameters').select('key, value').in('key', OVERLAP),
    sb.from('pricing_rules_config').select('key, value, vehicle_type_id, is_active').in('key', OVERLAP),
  ]);
  console.log('pricing_parameters:', params);
  console.log('pricing_rules_config:', rules);
  for (const k of OVERLAP) {
    const p = params?.find((x) => x.key === k);
    const r = rules?.filter((x) => x.key === k && x.vehicle_type_id == null);
    console.log(`\n${k}: param=${p?.value ?? '—'} rules(global)=`, r?.map((x) => x.value));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run audit (optional if secrets available)**

Run: `npx tsx scripts/audit-pricing-dup-keys.ts`  
Expected: prints overlap keys; no throw.

- [ ] **Step 5: Typecheck UI**

Run: `npx tsc --noEmit`  
Expected: PASS for changed files (or project clean).

- [ ] **Step 6: Commit (when human asks)**

```bash
git add src/components/pricing/PricingRulesTab.tsx src/components/pricing/PricingParametersSection.tsx scripts/audit-pricing-dup-keys.ts
git commit -m "chore(pricing): freeze duplicate impostos UI"
```

---

### Task 2: Schema — `price_tables.methodology` + backfill

**Files:**
- Create: `supabase/migrations/20260801180000_price_tables_methodology.sql`
- Modify (after push): regenerate types via `supabase gen types` / MCP `generate_typescript_types`
- Modify: `src/lib/pricingMethodology.ts` (create)

**Interfaces:**
- Consumes: existing `price_tables.modality`
- Produces: `PriceTableMethodology` type; `modalityFromMethodology()`; column NOT NULL after backfill

- [ ] **Step 1: Write migration SQL**

```sql
-- price_tables.methodology: lotacao | fracionado_ntc | fracionado_parceiro
ALTER TABLE public.price_tables
  ADD COLUMN IF NOT EXISTS methodology text;

UPDATE public.price_tables
SET methodology = CASE
  WHEN modality = 'lotacao' THEN 'lotacao'
  WHEN modality = 'fracionado' AND name ILIKE '%NTC%' THEN 'fracionado_ntc'
  WHEN modality = 'fracionado' AND name ILIKE '%ANTT%' THEN 'fracionado_ntc'
  WHEN modality = 'fracionado' AND (name ILIKE '%RVL%' OR name ILIKE '%parceiro%') THEN 'fracionado_parceiro'
  WHEN modality = 'fracionado' THEN 'fracionado_ntc'
  ELSE 'lotacao'
END
WHERE methodology IS NULL;

ALTER TABLE public.price_tables
  ALTER COLUMN methodology SET NOT NULL;

ALTER TABLE public.price_tables
  DROP CONSTRAINT IF EXISTS price_tables_methodology_check;

ALTER TABLE public.price_tables
  ADD CONSTRAINT price_tables_methodology_check
  CHECK (methodology IN ('lotacao', 'fracionado_ntc', 'fracionado_parceiro'));

COMMENT ON COLUMN public.price_tables.methodology IS
  'Pack de regras: lotacao | fracionado_ntc | fracionado_parceiro. modality permanece derivado.';

-- Keep modality in sync when methodology set (app responsibility); optional trigger:
CREATE OR REPLACE FUNCTION public.sync_price_table_modality_from_methodology()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.modality := CASE
    WHEN NEW.methodology = 'lotacao' THEN 'lotacao'
    ELSE 'fracionado'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_price_table_modality ON public.price_tables;
CREATE TRIGGER trg_sync_price_table_modality
  BEFORE INSERT OR UPDATE OF methodology ON public.price_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_price_table_modality_from_methodology();
```

Note: if remote Postgres uses `EXECUTE PROCEDURE` vs `EXECUTE FUNCTION`, match project convention from recent migrations.

- [ ] **Step 2: Apply migration**

Prefer local first if stack up: `npx supabase db push` (or MCP `apply_migration` on Hub `lrbtbrpoklgwaaclbufz` when human approves remote).

Verify:

```sql
SELECT name, modality, methodology FROM price_tables ORDER BY name;
```

Expected Hub: Referencial → `lotacao`; NTC Fracionado → `fracionado_ntc`; ANTT fracionado → `fracionado_ntc`.

- [ ] **Step 3: Create client helpers**

Create `src/lib/pricingMethodology.ts`:

```ts
export const PRICE_TABLE_METHODOLOGIES = [
  'lotacao',
  'fracionado_ntc',
  'fracionado_parceiro',
] as const;

export type PriceTableMethodology = (typeof PRICE_TABLE_METHODOLOGIES)[number];

export const METHODOLOGY_LABELS: Record<PriceTableMethodology, string> = {
  lotacao: 'Lotação',
  fracionado_ntc: 'Fracionado NTC',
  fracionado_parceiro: 'Fracionado Parceiro',
};

export function isPriceTableMethodology(v: unknown): v is PriceTableMethodology {
  return (
    typeof v === 'string' &&
    (PRICE_TABLE_METHODOLOGIES as readonly string[]).includes(v)
  );
}

export function modalityFromMethodology(
  m: PriceTableMethodology
): 'lotacao' | 'fracionado' {
  return m === 'lotacao' ? 'lotacao' : 'fracionado';
}

export function marginKeyForMethodology(m: PriceTableMethodology): string {
  switch (m) {
    case 'lotacao':
      return 'profit_margin_lotacao_percent';
    case 'fracionado_ntc':
      return 'profit_margin_fracionado_percent';
    case 'fracionado_parceiro':
      return 'profit_margin_parceiro_fracionado_percent';
  }
}

export function methodologyHasHubFiscal(m: PriceTableMethodology): boolean {
  return m === 'lotacao' || m === 'fracionado_ntc';
}
```

- [ ] **Step 4: Regenerate / patch types**

After migration applied: regenerate `types.generated.ts` so `price_tables.Row` includes `methodology: string`.  
Until regen: temporary cast in hooks OK, but do not leave permanent drift.

- [ ] **Step 5: Commit (when human asks)**

```bash
git add supabase/migrations/20260801180000_price_tables_methodology.sql src/lib/pricingMethodology.ts
git commit -m "feat(pricing): add price_tables.methodology"
```

---

### Task 3: Schema — `pricing_rules_config.methodology` + seed packs

**Files:**
- Create: `supabase/migrations/20260801180100_pricing_rules_methodology.sql`
- Modify: `src/hooks/usePricingRules.ts` (`PricingRuleConfig`)
- Modify: `src/hooks/usePricingRulesMutations.ts`

**Interfaces:**
- Consumes: existing commercial/fiscal rule rows
- Produces: every commercial row has `methodology`; unique `(key, vehicle_type_id, methodology) NULLS NOT DISTINCT`; partner margin key seeded

- [ ] **Step 1: Write migration — column + unique + clone packs**

```sql
-- 1) Add column (nullable during backfill)
ALTER TABLE public.pricing_rules_config
  ADD COLUMN IF NOT EXISTS methodology text;

-- 2) Drop old unique; add new
ALTER TABLE public.pricing_rules_config
  DROP CONSTRAINT IF EXISTS pricing_rules_config_key_vehicle_type_id_key;

-- name may differ — discover:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.pricing_rules_config'::regclass;

ALTER TABLE public.pricing_rules_config
  DROP CONSTRAINT IF EXISTS pricing_rules_config_key_vehicle_type_id_methodology_key;

-- Assign existing commercial/fiscal rows to BOTH emitting packs via INSERT clones.
-- Strategy:
-- a) Tag current NULL rows as methodology = 'lotacao' in place (keeps ids for lotacao).
-- b) INSERT copies for fracionado_ntc (same key/vehicle/value).
-- c) Seed partner margin only for fracionado_parceiro.

UPDATE public.pricing_rules_config
SET methodology = 'lotacao'
WHERE methodology IS NULL
  AND key IN (
    'das_percent','markup_percent','overhead_percent',
    'profit_margin_percent','profit_margin_lotacao_percent','profit_margin_fracionado_percent',
    'regime_simples_nacional','excesso_sublimite','regime_lucro_presumido',
    'pis_percent','cofins_percent','irpj_effective_percent','csll_effective_percent',
    'gris_percent','tso_percent','cost_value_percent',
    'over_lotacao_percent','ad_valorem_lotacao_percent','fiscal_origin_uf'
  );

INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value,
  vehicle_type_id, is_active, metadata, methodology
)
SELECT
  key, label, category, value_type, value, min_value, max_value,
  vehicle_type_id, is_active, metadata, 'fracionado_ntc'
FROM public.pricing_rules_config
WHERE methodology = 'lotacao'
  AND key IN (
    'das_percent','markup_percent','overhead_percent',
    'profit_margin_percent','profit_margin_lotacao_percent','profit_margin_fracionado_percent',
    'regime_simples_nacional','excesso_sublimite','regime_lucro_presumido',
    'pis_percent','cofins_percent','irpj_effective_percent','csll_effective_percent',
    'gris_percent','tso_percent','cost_value_percent',
    'over_lotacao_percent','ad_valorem_lotacao_percent','fiscal_origin_uf'
  )
ON CONFLICT DO NOTHING;

-- Partner pack: margin only (no fiscal)
INSERT INTO public.pricing_rules_config (
  key, label, category, value_type, value, min_value, max_value,
  vehicle_type_id, is_active, metadata, methodology
)
VALUES (
  'profit_margin_parceiro_fracionado_percent',
  'Margem Fracionado Parceiro (%)',
  'markup',
  'percentage',
  15,
  0,
  100,
  NULL,
  true,
  '{}'::jsonb,
  'fracionado_parceiro'
)
ON CONFLICT DO NOTHING;

-- Copy overhead/markup optional for partner? Spec: only partner margin key required.
-- Do NOT copy fiscal keys to fracionado_parceiro.

ALTER TABLE public.pricing_rules_config
  ALTER COLUMN methodology SET NOT NULL;

-- Non-commercial operational keys (aluguel, carga_descarga per vehicle) that should stay
-- methodology-scoped OR keep a sentinel? Spec: commercial require methodology.
-- For categories aluguel/carga_descarga/estadia still used across modalities:
-- set methodology = 'lotacao' as default pack OR allow shared via packing into both.
-- Decision locked: set remaining NULL → 'lotacao', then clone to fracionado_ntc for keys used in both engines.
UPDATE public.pricing_rules_config
SET methodology = 'lotacao'
WHERE methodology IS NULL;

ALTER TABLE public.pricing_rules_config
  ADD CONSTRAINT pricing_rules_config_methodology_check
  CHECK (methodology IN ('lotacao', 'fracionado_ntc', 'fracionado_parceiro'));

CREATE UNIQUE INDEX IF NOT EXISTS pricing_rules_config_key_vt_meth_uidx
  ON public.pricing_rules_config (key, vehicle_type_id, methodology)
  NULLS NOT DISTINCT;
```

If `ON CONFLICT DO NOTHING` needs a conflict target, use the unique index name after creating it **before** inserts, or use `WHERE NOT EXISTS` pattern instead:

```sql
INSERT INTO public.pricing_rules_config (...)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules_config t
  WHERE t.key = pricing_rules_config.key
    AND t.vehicle_type_id IS NOT DISTINCT FROM pricing_rules_config.vehicle_type_id
    AND t.methodology = 'fracionado_ntc'
);
```

Adjust insert accordingly so migration is idempotent.

- [ ] **Step 2: Apply + verify counts**

```sql
SELECT methodology, count(*) FROM pricing_rules_config GROUP BY 1;
SELECT * FROM pricing_rules_config WHERE key = 'profit_margin_parceiro_fracionado_percent';
SELECT count(*) FROM pricing_rules_config WHERE methodology = 'fracionado_parceiro'
  AND key IN ('das_percent','pis_percent'); -- expect 0
```

- [ ] **Step 3: Extend `PricingRuleConfig` + normalize**

In `src/hooks/usePricingRules.ts`:

```ts
import type { PriceTableMethodology } from '@/lib/pricingMethodology';

export interface PricingRuleConfig {
  // ...existing fields...
  methodology: PriceTableMethodology;
}

// in normalizePricingRule:
methodology: (isPriceTableMethodology(row.methodology)
  ? row.methodology
  : 'lotacao') as PriceTableMethodology,
```

- [ ] **Step 4: Mutations include methodology**

In `useCreatePricingRuleConfig` data type add `methodology: PriceTableMethodology` and pass into insert.

- [ ] **Step 5: Commit (when human asks)**

```bash
git add supabase/migrations/20260801180100_pricing_rules_methodology.sql src/hooks/usePricingRules.ts src/hooks/usePricingRulesMutations.ts
git commit -m "feat(pricing): seed rules packs by methodology"
```

---

### Task 4: `resolvePricingRule` with methodology (TDD)

**Files:**
- Create: `src/lib/__tests__/resolvePricingRule.test.ts`
- Modify: `src/hooks/usePricingRules.ts`
- Modify: `src/lib/tax-regime-resolve.ts`
- Modify: callers in `QuoteForm.tsx` (signature change — can finish wiring in Task 6; here update helper + tax-regime)

**Interfaces:**
- Consumes: `PricingRuleConfig[]`, `PriceTableMethodology`
- Produces:

```ts
export type ResolvePricingRuleScope = {
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
};

export function resolvePricingRule(
  rules: PricingRuleConfig[] | undefined,
  key: string,
  scope: ResolvePricingRuleScope,
  fallback?: number
): number | undefined;
```

Breaking change vs old `(rules, key, vehicleTypeId, fallback)` — update all call sites (grep `resolvePricingRule(`).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolvePricingRule, type PricingRuleConfig } from '@/hooks/usePricingRules';

function rule(
  partial: Partial<PricingRuleConfig> & Pick<PricingRuleConfig, 'key' | 'value' | 'methodology'>
): PricingRuleConfig {
  return {
    id: partial.id ?? '1',
    label: partial.label ?? partial.key,
    category: 'markup',
    value_type: 'percentage',
    min_value: null,
    max_value: null,
    vehicle_type_id: partial.vehicle_type_id ?? null,
    is_active: true,
    metadata: {},
    updated_at: '',
    ...partial,
  };
}

describe('resolvePricingRule methodology', () => {
  const rules: PricingRuleConfig[] = [
    rule({ key: 'overhead_percent', value: 10, methodology: 'lotacao' }),
    rule({ key: 'overhead_percent', value: 12, methodology: 'fracionado_ntc' }),
    rule({
      key: 'overhead_percent',
      value: 20,
      methodology: 'lotacao',
      vehicle_type_id: 'vt-truck',
    }),
    rule({
      key: 'profit_margin_parceiro_fracionado_percent',
      value: 18,
      methodology: 'fracionado_parceiro',
    }),
    rule({ key: 'das_percent', value: 14, methodology: 'lotacao' }),
  ];

  it('prefers vehicle+methodology over methodology pack', () => {
    expect(
      resolvePricingRule(rules, 'overhead_percent', {
        methodology: 'lotacao',
        vehicleTypeId: 'vt-truck',
      })
    ).toBe(20);
  });

  it('uses methodology pack when no vehicle row', () => {
    expect(
      resolvePricingRule(rules, 'overhead_percent', { methodology: 'fracionado_ntc' })
    ).toBe(12);
  });

  it('does not fall back to other methodology', () => {
    expect(
      resolvePricingRule(rules, 'overhead_percent', { methodology: 'fracionado_parceiro' }, 99)
    ).toBe(99);
  });

  it('partner margin resolves; das does not exist on partner', () => {
    expect(
      resolvePricingRule(rules, 'profit_margin_parceiro_fracionado_percent', {
        methodology: 'fracionado_parceiro',
      })
    ).toBe(18);
    expect(
      resolvePricingRule(rules, 'das_percent', { methodology: 'fracionado_parceiro' }, undefined)
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/lib/__tests__/resolvePricingRule.test.ts`  
Expected: FAIL (signature / wrong precedence).

If vitest missing from deps: `npm i -D vitest` (match other `__tests__` files) then re-run.

- [ ] **Step 3: Implement resolve**

```ts
export type ResolvePricingRuleScope = {
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
};

export function resolvePricingRule(
  rules: PricingRuleConfig[] | undefined,
  key: string,
  scope: ResolvePricingRuleScope,
  fallback?: number
): number | undefined {
  if (!rules?.length) return fallback;
  const byKey = rules.filter(
    (r) => r.key === key && r.methodology === scope.methodology && r.is_active !== false
  );
  if (byKey.length === 0) return fallback;

  const vehicleRule = scope.vehicleTypeId
    ? byKey.find((r) => r.vehicle_type_id === scope.vehicleTypeId)
    : null;
  const packRule = byKey.find((r) => r.vehicle_type_id == null);
  const rule = vehicleRule ?? packRule;
  if (!rule) return fallback;

  let val = Number(rule.value);
  if (rule.min_value != null && val < rule.min_value) val = rule.min_value;
  if (rule.max_value != null && val > rule.max_value) val = rule.max_value;
  return val;
}
```

- [ ] **Step 4: Update `resolveTaxRegimeFlags`**

```ts
export function resolveTaxRegimeFlags(params: {
  pricingRules?: PricingRuleConfig[];
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
  taxRegimeLucroPresumidoParam?: number | null;
}): ResolvedTaxRegimeFlags {
  const scope = {
    methodology: params.methodology,
    vehicleTypeId: params.vehicleTypeId,
  };
  const pisPercent = resolvePricingRule(params.pricingRules, 'pis_percent', scope, 0) ?? 0;
  // ... same for other keys with scope ...
}
```

- [ ] **Step 5: Grep-fix call sites**

Run: `rg "resolvePricingRule\\(" -g "*.ts" -g "*.tsx"`  
Update each to pass `{ methodology, vehicleTypeId }`. Temporary default `methodology: 'lotacao'` only where table unknown — QuoteForm Task 6 must pass real methodology.

- [ ] **Step 6: Run tests PASS**

Run: `npx vitest run src/lib/__tests__/resolvePricingRule.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit (when human asks)**

```bash
git add src/hooks/usePricingRules.ts src/lib/tax-regime-resolve.ts src/lib/__tests__/resolvePricingRule.test.ts
git commit -m "feat(pricing): resolve rules by methodology"
```

---

### Task 5: Edge `pricing-rules.ts` + `calculate-freight` (Fase 2)

**Files:**
- Modify: `supabase/functions/_shared/pricing-rules.ts`
- Modify: `supabase/functions/calculate-freight/index.ts`
- Mirror helpers: duplicate `PriceTableMethodology` types inline in Edge file (Deno cannot import `@/lib`)

**Interfaces:**
- Consumes: `input.price_table_id`, `pricing_rules_config.methodology`
- Produces: `buildDynamicFreightParams` uses methodology; margin key by pack; partner skips Hub fiscal defaults

- [ ] **Step 1: Extend backend types + fetch**

```ts
type PriceTableMethodology = 'lotacao' | 'fracionado_ntc' | 'fracionado_parceiro';

type PricingRuleRow = {
  key: string;
  value: number;
  vehicle_type_id: string | null;
  methodology: PriceTableMethodology;
};

export function resolvePricingRuleBackend(
  rules: PricingRuleRow[] | undefined,
  key: string,
  scope: { methodology: PriceTableMethodology; vehicleTypeId?: string | null },
  fallback?: number
): number | undefined {
  if (!rules?.length) return fallback;
  const byKey = rules.filter((r) => r.key === key && r.methodology === scope.methodology);
  if (byKey.length === 0) return fallback;
  const vehicleRule = scope.vehicleTypeId
    ? byKey.find((r) => r.vehicle_type_id === scope.vehicleTypeId)
    : null;
  const packRule = byKey.find((r) => r.vehicle_type_id == null);
  const rule = vehicleRule ?? packRule;
  const val = rule ? Number(rule.value) : undefined;
  return Number.isFinite(val as number) ? (val as number) : fallback;
}
```

Update `fetchPricingRulesConfig` select to `'key, value, vehicle_type_id, methodology'`.

- [ ] **Step 2: Resolve methodology inside `buildDynamicFreightParams`**

```ts
let methodology: PriceTableMethodology = 'lotacao';
if (input.price_table_id) {
  const { data: pt } = await supabase
    .from('price_tables')
    .select('methodology')
    .eq('id', input.price_table_id)
    .maybeSingle();
  const m = (pt as { methodology?: string } | null)?.methodology;
  if (m === 'lotacao' || m === 'fracionado_ntc' || m === 'fracionado_parceiro') {
    methodology = m;
  } else {
    fallbacksApplied.push('price_table.methodology missing — blocked path should error upstream');
  }
}
const scope = { methodology, vehicleTypeId: vehicleTypeIdForRules };
```

Margin:

```ts
const marginKey =
  methodology === 'fracionado_parceiro'
    ? 'profit_margin_parceiro_fracionado_percent'
    : methodology === 'fracionado_ntc'
      ? 'profit_margin_fracionado_percent'
      : 'profit_margin_lotacao_percent';

let profitMarginPercent =
  resolvePricingRuleBackend(allRules, marginKey, scope) ??
  (methodology === 'lotacao'
    ? resolvePricingRuleBackend(allRules, 'profit_margin_percent', scope)
    : undefined) ??
  FREIGHT_CONSTANTS.TARGET_MARGIN_PERCENT;

if (
  methodology === 'fracionado_parceiro' &&
  resolvePricingRuleBackend(allRules, marginKey, scope) == null &&
  input.partner_margin_percent == null // optional field — add to freight-types if needed
) {
  fallbacksApplied.push('partner margin missing');
}
```

For `fracionado_parceiro`: set fiscal flags to neutral / zeros and **do not** read `das_percent` / PIS etc. from other packs:

```ts
const hasFiscal = methodology === 'lotacao' || methodology === 'fracionado_ntc';
const dasPercent = hasFiscal
  ? (input.das_percent ?? resolvePricingRuleBackend(allRules, 'das_percent', scope) ?? FREIGHT_CONSTANTS.DEFAULT_DAS_PERCENT)
  : 0;
// similar for pis/cofins/regime — partner: regimeSimplesNacional=false, percents 0
```

Keep `pricing_parameters` fallback only for non-commercial (`cubage_factor`, `correction_factor_inctf`) in this task; commercial keys no longer fall back to params (Fase 2 early).

- [ ] **Step 3: Align `calculate-freight/index.ts` margin block**

Where it currently branches on `modality === 'fracionado'`, also load `methodology` from price_tables select:

```ts
.select('modality, methodology, ad_valorem_lotacao_percent')
```

Then:

```ts
const methodology = ptData?.methodology as PriceTableMethodology | undefined;
const marginKey =
  methodology === 'fracionado_parceiro'
    ? 'profit_margin_parceiro_fracionado_percent'
    : methodology === 'fracionado_ntc' || modality === 'fracionado'
      ? 'profit_margin_fracionado_percent'
      : 'profit_margin_lotacao_percent';
```

Use `resolvePricingRuleBackend` with scope including methodology (update local `resolveRule` wrappers).

If methodology missing on table: return 400 JSON `{ error: 'Tabela sem methodology' }`.

- [ ] **Step 4: Deploy Edge (when human asks)**

`npx supabase functions deploy calculate-freight` (and any shared bundle as usual).

- [ ] **Step 5: Smoke (manual)**

Same cargo/km, three tables if available — compare `profit_margin_target` / params in response.

- [ ] **Step 6: Commit (when human asks)**

```bash
git add supabase/functions/_shared/pricing-rules.ts supabase/functions/calculate-freight/index.ts supabase/functions/_shared/freight-types.ts
git commit -m "feat(pricing): edge resolve by methodology"
```

---

### Task 6: QuoteForm — table drives methodology (Fase 3)

**Files:**
- Modify: `src/components/forms/QuoteForm.tsx`
- Optional: small badge helper in `src/lib/pricingMethodology.ts`

**Interfaces:**
- Consumes: `selectedPriceTable.methodology`, `resolvePricingRule` new scope
- Produces: `freight_modality` synced; financial strip shows pack; partner margin field + hide Hub fiscal UI

- [ ] **Step 1: Sync on `price_table_id` change**

When user selects table:

```ts
onValueChange={(id) => {
  field.onChange(id);
  const table = priceTables?.find((t) => t.id === id);
  const meth = table?.methodology;
  if (isPriceTableMethodology(meth)) {
    form.setValue('freight_modality', modalityFromMethodology(meth));
  }
}}
```

Also `useEffect` when `selectedPriceTable` changes → same sync (edit load).

- [ ] **Step 2: Badge in SelectItem**

```tsx
{table.name}{' '}
<Badge variant="outline" className="ml-1">
  {isPriceTableMethodology(table.methodology)
    ? METHODOLOGY_LABELS[table.methodology]
    : table.modality}
</Badge>
```

- [ ] **Step 3: `resolvedPricingParams` use methodology scope**

```ts
const methodology: PriceTableMethodology =
  (isPriceTableMethodology(selectedPriceTable?.methodology)
    ? selectedPriceTable.methodology
    : debounced.freightModality === 'fracionado'
      ? 'fracionado_ntc'
      : 'lotacao');

const scope = { methodology, vehicleTypeId: vtId };
// replace all resolvePricingRule(..., vtId, ...) with scope
```

Partner margin getter:

```ts
profitMarginParceiroPercent: resolvePricingRule(
  pricingRules,
  'profit_margin_parceiro_fracionado_percent',
  scope,
  15
),
get profitMarginPercent() {
  if (methodology === 'fracionado_parceiro') return this.profitMarginParceiroPercent;
  if (methodology === 'fracionado_ntc') return this.profitMarginFracionadoPercent;
  return this.profitMarginLotacaoPercent;
},
```

- [ ] **Step 4: Partner UX gancho**

If `methodology === 'fracionado_parceiro'`:
- Show Input “Margem parceiro (%)” bound to optional form field `partner_margin_override` (add to zod schema as `z.number().optional()`); default from rule.
- Hide / skip fiscal regime UI blocks that assume Hub emission (search QuoteForm for DAS / regime displays in financial strip).
- Do **not** build full B+C compare UI.

If table has no methodology: toast + block calc (`canCalculate = false`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`  
Expected: PASS.

- [ ] **Step 6: Commit (when human asks)**

```bash
git add src/components/forms/QuoteForm.tsx src/lib/pricingMethodology.ts
git commit -m "feat(pricing): QuoteForm follows table methodology"
```

---

### Task 7: Central de Regras — methodology tabs (Fase 4)

**Files:**
- Modify: `src/components/pricing/PricingRulesManager.tsx`
- Modify: `src/hooks/usePricingRulesMutations.ts` (create requires methodology from active tab)

**Interfaces:**
- Consumes: `rules[].methodology`
- Produces: tabs Lotação | Fracionado NTC | Fracionado Parceiro; fiscal categories hidden on partner tab; formatters for bool/UF

- [ ] **Step 1: Outer methodology Tabs**

Wrap manager content:

```tsx
const [methodologyTab, setMethodologyTab] =
  useState<PriceTableMethodology>('lotacao');

const visibleRules = (rules ?? []).filter(
  (r) =>
    r.methodology === methodologyTab &&
    !r.key.startsWith('icms_uf_') &&
    r.key !== 'tde_percent' &&
    r.key !== 'tear_percent'
);
```

```tsx
<Tabs value={methodologyTab} onValueChange={(v) => isPriceTableMethodology(v) && setMethodologyTab(v)}>
  <TabsList>
    <TabsTrigger value="lotacao">Lotação</TabsTrigger>
    <TabsTrigger value="fracionado_ntc">Fracionado NTC</TabsTrigger>
    <TabsTrigger value="fracionado_parceiro">Fracionado Parceiro</TabsTrigger>
  </TabsList>
  {/* existing category tabs filtered by visibleRules */}
</Tabs>
```

- [ ] **Step 2: Hide fiscal categories on partner**

```ts
const CATEGORIES_PARTNER = CATEGORIES.filter((c) =>
  ['markup', 'taxa', 'veiculo'].includes(c.id)
);
const categories =
  methodologyTab === 'fracionado_parceiro' ? CATEGORIES_PARTNER : CATEGORIES;
```

- [ ] **Step 3: Fix `formatValue` for boolean / UF**

```ts
function formatValue(rule: PricingRuleConfig): string {
  if (rule.value_type === 'boolean' || rule.key.startsWith('regime_')) {
    return Number(rule.value) === 1 ? 'Sim' : 'Não';
  }
  if (rule.key === 'fiscal_origin_uf') {
    return String(rule.metadata?.uf ?? rule.value);
  }
  // ...existing percentage / money
}
```

- [ ] **Step 4: Create dialog sets `methodology: methodologyTab`**

Pass into `createMutation.mutate({ ..., methodology: methodologyTab })`.

Add `profit_margin_parceiro_fracionado_percent` to `PROTECTED_RULE_KEYS`.

- [ ] **Step 5: Manual UI check**

Open Precificação → Central: three tabs; partner shows margin; Lotação/NTC show impostos.

- [ ] **Step 6: Commit (when human asks)**

```bash
git add src/components/pricing/PricingRulesManager.tsx src/hooks/usePricingRulesMutations.ts
git commit -m "feat(pricing): Central tabs by methodology"
```

---

### Task 8: Drop commercial `pricing_parameters` fallback (Fase 5)

**Files:**
- Modify: `supabase/functions/_shared/pricing-rules.ts`
- Gate: only after Tasks 5–6 smoke green

**Interfaces:**
- Consumes: rules-only commercial keys
- Produces: no `paramsMap.get('das_percent'|'markup'|'overhead'|'profit_margin')`

- [ ] **Step 1: Remove commercial fallbacks from `buildDynamicFreightParams`**

Keep paramsMap only for:

- `cubage_factor`
- `correction_factor_inctf`
- `carreteiro_percent` (until moved)

Delete lines that do `paramsMap.get('das_percent')` etc.

- [ ] **Step 2: Update fallbacksApplied messages** to mention rules-only.

- [ ] **Step 3: Smoke calculate-freight again**

- [ ] **Step 4: Commit (when human asks)**

```bash
git add supabase/functions/_shared/pricing-rules.ts
git commit -m "refactor(pricing): drop params commercial fallback"
```

---

## Self-review vs spec

| Spec section | Task |
|---|---|
| §4.1 price_tables.methodology | Task 2 |
| §4.2 rules methodology + unique | Task 3 |
| §4.3 pack contents / no fiscal partner | Task 3 + 5 + 7 |
| §5 resolve precedence | Task 4 + 5 |
| §6 QuoteForm UX | Task 6 |
| §6 Central tabs | Task 7 |
| §7 Fase 0 | Task 1 |
| §7 Fase 5 | Task 8 |
| §9 unit tests | Task 4 |
| Out of scope B+C/RVL | Explicitly omitted |

Placeholder scan: none intentional.  
Type names: `PriceTableMethodology`, `ResolvePricingRuleScope`, `marginKeyForMethodology` consistent across tasks.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-pricing-rules-by-methodology.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans + checkpoints  

Which approach?
