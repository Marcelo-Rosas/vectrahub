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

