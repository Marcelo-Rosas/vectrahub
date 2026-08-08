# Task 1 Report: Freeze duplicate `pricing_parameters` editors (Fase 0)

**Status:** DONE  
**Branch:** `feat/pricing-rules-by-methodology`  
**Date:** 2026-08-01

## Summary

Implemented Fase 0 of pricing-rules-by-methodology: stopped editing DAS/markup/overhead via the `pricing_parameters` UI and redirected users to Central de Regras. Added audit script to detect duplicate keys across tables.

## Changes Made

### 1. `src/components/pricing/PricingRulesTab.tsx`

- Replaced `taxes-margins` accordion body (`PricingParametersSection` with `includeKeys`) with an `Alert` redirect pointing users to Central de Regras.
- Added imports: `Alert`, `AlertTitle`, `AlertDescription` from `@/components/ui/alert`; `AlertCircle` from `lucide-react`.
- Added `excludeKeys={['das_percent','markup_percent','overhead_percent']}` to the "Parâmetros Gerais" `PricingParametersSection` so overlap keys no longer appear there.

### 2. `src/components/pricing/PricingParametersSection.tsx`

- Extended props interface with optional `excludeKeys?: string[]`.
- Updated filter logic per brief:

```tsx
const parameters = (allParameters ?? []).filter((p) => {
  if (includeKeys?.length) return includeKeys.includes(p.key);
  if (excludeKeys?.length) return !excludeKeys.includes(p.key);
  return true;
});
```

### 3. `scripts/audit-pricing-dup-keys.ts` (new)

- Script lists overlap keys (`das_percent`, `markup_percent`, `overhead_percent`, `profit_margin_percent`) from both `pricing_parameters` and `pricing_rules_config`.
- Requires `SUPABASE_URL` (or `VITE_SUPABASE_URL`) + `SUPABASE_SECRET_KEY`.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| ESLint on changed files | No new issues |
| `npx tsx scripts/audit-pricing-dup-keys.ts` | **Skipped** — `Missing SUPABASE_URL / SUPABASE_SECRET_KEY` (expected without env secrets) |

## Self-Review

- **Scope:** Only touched the three files specified in the brief.
- **Behavior:** "Impostos e Margens" accordion now shows read-only redirect; no edit/delete/create for DAS/markup/overhead via parameters UI.
- **Parâmetros Gerais:** Overlap keys excluded via `excludeKeys`; other keys (`cubage_factor`, `correction_factor_inctf`, etc.) remain editable.
- **Pre-existing:** Badge on "Parâmetros Gerais" still shows total count from `usePricingParameters()` (unfiltered); not changed per brief scope.
- **Commit:** Not performed (human rule — commits only when explicitly asked).

## Concerns

None blocking. Audit script runtime verification deferred until Supabase secrets are available in env.

## Files Touched

- `src/components/pricing/PricingRulesTab.tsx` (modified)
- `src/components/pricing/PricingParametersSection.tsx` (modified)
- `scripts/audit-pricing-dup-keys.ts` (created)

## Suggested Commit (when human asks)

```bash
git add src/components/pricing/PricingRulesTab.tsx src/components/pricing/PricingParametersSection.tsx scripts/audit-pricing-dup-keys.ts
git commit -m "chore(pricing): freeze duplicate impostos UI"
```
