import type { PriceTableMethodology } from '@/lib/pricingMethodology';

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
