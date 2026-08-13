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

