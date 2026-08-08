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

