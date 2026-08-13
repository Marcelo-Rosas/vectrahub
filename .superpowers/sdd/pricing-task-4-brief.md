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

