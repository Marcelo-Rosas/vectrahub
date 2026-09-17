import type { PriceTableMethodology } from '@/lib/pricingMethodology';
import { compareSkuNatural } from '@/lib/sku-sort';

export interface PricingRuleResolveRow {
  key: string;
  value: number;
  min_value?: number | null;
  max_value?: number | null;
  vehicle_type_id: string | null;
  methodology: PriceTableMethodology;
  is_active?: boolean;
}

export type ResolvePricingRuleScope = {
  methodology: PriceTableMethodology;
  vehicleTypeId?: string | null;
};

/**
 * Precedence: (key, methodology, vehicle) > (key, methodology, null) > fallback.
 * No cross-methodology commercial fallback.
 */
export function resolvePricingRule(
  rules: PricingRuleResolveRow[] | undefined,
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

export interface CatalogPricingRuleRow {
  id: string;
  key: string;
  label?: string;
  category: string;
  methodology: PriceTableMethodology;
  vehicle_type_id: string | null;
  is_active?: boolean;
}

export type ListCatalogPricingRulesOpts = {
  category: string;
  methodology?: PriceTableMethodology;
  vehicleTypeId?: string | null;
};

function catalogRuleRank(rule: CatalogPricingRuleRow, vehicleTypeId?: string | null): number {
  if (vehicleTypeId && rule.vehicle_type_id === vehicleTypeId) return 3;
  if (rule.vehicle_type_id == null) return 2;
  return 1;
}

function pickCatalogRule<T extends CatalogPricingRuleRow>(
  current: T,
  candidate: T,
  vehicleTypeId?: string | null
): T {
  const currentRank = catalogRuleRank(current, vehicleTypeId);
  const candidateRank = catalogRuleRank(candidate, vehicleTypeId);
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  if (current.methodology !== candidate.methodology) {
    if (current.methodology === 'lotacao') return current;
    if (candidate.methodology === 'lotacao') return candidate;
  }
  return current;
}

/**
 * Unique catalog rows for aluguel / carga_descarga UI.
 * Same key on lotacao + fracionado_ntc packs must not yield two checkboxes.
 * No cross-methodology fallback when methodology is set.
 */
export function listCatalogPricingRules<T extends CatalogPricingRuleRow>(
  rules: T[] | undefined,
  opts: ListCatalogPricingRulesOpts
): T[] {
  if (!rules?.length) return [];
  const category = opts.category.trim().toLowerCase();
  const scoped = rules.filter((rule) => {
    if (rule.is_active === false) return false;
    if (String(rule.category).trim().toLowerCase() !== category) return false;
    if (opts.methodology && rule.methodology !== opts.methodology) return false;
    return true;
  });

  const byKey = new Map<string, T>();
  for (const rule of scoped) {
    const existing = byKey.get(rule.key);
    if (!existing) {
      byKey.set(rule.key, rule);
      continue;
    }
    byKey.set(rule.key, pickCatalogRule(existing, rule, opts.vehicleTypeId));
  }

  return [...byKey.values()].sort(
    (a, b) =>
      compareSkuNatural(a.key, b.key) || compareSkuNatural(a.label ?? a.key, b.label ?? b.key)
  );
}
