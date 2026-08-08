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

