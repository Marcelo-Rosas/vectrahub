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

