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

