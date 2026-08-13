import { describe, expect, it } from 'vitest';
import { resolvePricingRule, type PricingRuleResolveRow } from '@/lib/resolvePricingRule';

function rule(
  partial: Partial<PricingRuleResolveRow> &
    Pick<PricingRuleResolveRow, 'key' | 'value' | 'methodology'>
): PricingRuleResolveRow {
  return {
    vehicle_type_id: partial.vehicle_type_id ?? null,
    is_active: true,
    min_value: null,
    max_value: null,
    ...partial,
  };
}

describe('resolvePricingRule methodology', () => {
  const rules: PricingRuleResolveRow[] = [
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
    expect(resolvePricingRule(rules, 'overhead_percent', { methodology: 'fracionado_ntc' })).toBe(
      12
    );
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
