import { describe, expect, it } from 'vitest';
import {
  listCatalogPricingRules,
  resolvePricingRule,
  type CatalogPricingRuleRow,
  type PricingRuleResolveRow,
} from '@/lib/resolvePricingRule';

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

function catalogRule(
  partial: Partial<CatalogPricingRuleRow> &
    Pick<CatalogPricingRuleRow, 'id' | 'key' | 'category' | 'methodology'>
): CatalogPricingRuleRow {
  return {
    vehicle_type_id: partial.vehicle_type_id ?? null,
    is_active: true,
    label: partial.label ?? partial.key,
    ...partial,
  };
}

describe('listCatalogPricingRules', () => {
  const rows: CatalogPricingRuleRow[] = [
    catalogRule({
      id: 'lot-emp',
      key: 'empilhadeira',
      category: 'aluguel',
      methodology: 'lotacao',
      label: 'Empilhadeira',
    }),
    catalogRule({
      id: 'ntc-emp',
      key: 'empilhadeira',
      category: 'aluguel',
      methodology: 'fracionado_ntc',
      label: 'Empilhadeira',
    }),
    catalogRule({
      id: 'lot-munck',
      key: 'munck',
      category: 'aluguel',
      methodology: 'lotacao',
      label: 'Munck',
    }),
    catalogRule({
      id: 'lot-descarga',
      key: 'descarga_manual',
      category: 'carga_descarga',
      methodology: 'lotacao',
    }),
  ];

  it('does not list the same key twice when lotacao and fracionado_ntc packs exist', () => {
    const listed = listCatalogPricingRules(rows, {
      category: 'aluguel',
      methodology: 'lotacao',
    });
    expect(listed.filter((r) => r.key === 'empilhadeira')).toHaveLength(1);
    expect(listed.find((r) => r.key === 'empilhadeira')?.id).toBe('lot-emp');
    expect(listed.map((r) => r.key).sort()).toEqual(['empilhadeira', 'munck']);
  });

  it('uses fracionado_ntc pack and does not fall back to lotacao-only keys', () => {
    const listed = listCatalogPricingRules(rows, {
      category: 'aluguel',
      methodology: 'fracionado_ntc',
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe('ntc-emp');
  });

  it('dedupes by key even without methodology so checkboxes cannot double', () => {
    const listed = listCatalogPricingRules(rows, { category: 'aluguel' });
    expect(listed.filter((r) => r.key === 'empilhadeira')).toHaveLength(1);
  });

  it('collapses Hub aluguel packs so lotacao quote is not 5 checkboxes', () => {
    const hubAluguel: CatalogPricingRuleRow[] = [
      catalogRule({
        id: 'emp-ntc',
        key: 'empilhadeira',
        category: 'aluguel',
        methodology: 'fracionado_ntc',
        label: 'Empilhadeira',
      }),
      catalogRule({
        id: 'emp-lot',
        key: 'empilhadeira',
        category: 'aluguel',
        methodology: 'lotacao',
        label: 'Empilhadeira',
      }),
      catalogRule({
        id: 'munck-ntc',
        key: 'munck',
        category: 'aluguel',
        methodology: 'fracionado_ntc',
        label: 'Munck',
      }),
      catalogRule({
        id: 'pal-ntc',
        key: 'paleteira',
        category: 'aluguel',
        methodology: 'fracionado_ntc',
        label: 'Paleteira',
      }),
      catalogRule({
        id: 'pal-lot',
        key: 'paleteira',
        category: 'aluguel',
        methodology: 'lotacao',
        label: 'Paleteira',
      }),
    ];
    const lotacao = listCatalogPricingRules(hubAluguel, {
      category: 'aluguel',
      methodology: 'lotacao',
    });
    expect(lotacao.map((r) => r.key).sort()).toEqual(['empilhadeira', 'paleteira']);
    const ntc = listCatalogPricingRules(hubAluguel, {
      category: 'aluguel',
      methodology: 'fracionado_ntc',
    });
    expect(ntc.map((r) => r.key).sort()).toEqual(['empilhadeira', 'munck', 'paleteira']);
  });

  it('prefers vehicle+methodology over pack for the same key', () => {
    const withVehicle = [
      ...rows,
      catalogRule({
        id: 'lot-emp-vt',
        key: 'empilhadeira',
        category: 'aluguel',
        methodology: 'lotacao',
        vehicle_type_id: 'vt-truck',
      }),
    ];
    const listed = listCatalogPricingRules(withVehicle, {
      category: 'aluguel',
      methodology: 'lotacao',
      vehicleTypeId: 'vt-truck',
    });
    expect(listed.find((r) => r.key === 'empilhadeira')?.id).toBe('lot-emp-vt');
  });
});
