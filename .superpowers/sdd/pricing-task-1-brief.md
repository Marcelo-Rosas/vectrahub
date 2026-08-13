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

