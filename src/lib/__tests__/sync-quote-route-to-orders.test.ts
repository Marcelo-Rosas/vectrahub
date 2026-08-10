import { describe, expect, it } from 'vitest';
import { buildOrderRouteSyncUpdate, sumTollPlazasPratica } from '@/lib/sync-quote-route-to-orders';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

const plazas = [
  {
    nome: 'A',
    cidade: 'X',
    uf: 'SC',
    valor: 100.5,
    valorTag: 110,
    ordemPassagem: 1,
  },
  {
    nome: 'B',
    cidade: 'Y',
    uf: 'PR',
    valor: 257.35,
    valorTag: 260,
    ordemPassagem: 2,
  },
];

describe('sumTollPlazasPratica', () => {
  it('soma valor prática com 2 casas', () => {
    expect(sumTollPlazasPratica(plazas)).toBe(357.85);
  });
});

describe('buildOrderRouteSyncUpdate', () => {
  it('copia km/praças/toll e zera VPO', () => {
    const quoteBd = {
      calculatedAt: '2026-08-10T00:00:00.000Z',
      version: '4.0',
      status: 'OK',
      meta: {
        tollPlazas: plazas,
        kmByUf: { SC: 100 },
        vpo: { emissor: 'SEMPARAR', idANTT: 'OLD' },
      },
      weights: { cubageWeight: 0, billableWeight: 0, tonBillable: 0 },
      components: { toll: 357.85 },
      totals: { receitaBruta: 0, das: 0, icms: 0, totalImpostos: 0, totalCliente: 0 },
      profitability: {
        custosCarreteiro: 0,
        custosDescarga: 0,
        custosDiretos: 0,
        margemBruta: 0,
        overhead: 0,
        resultadoLiquido: 0,
        margemPercent: 0,
      },
      rates: {
        dasPercent: 14,
        icmsPercent: 0,
        grisPercent: 0,
        tsoPercent: 0,
        costValuePercent: 0,
        markupPercent: 30,
        overheadPercent: 15,
        targetMarginPercent: 15,
      },
    } as unknown as StoredPricingBreakdown;

    const orderBd = {
      ...quoteBd,
      meta: {
        tollPlazas: [{ ...plazas[0], valor: 9 }],
        vpo: { emissor: 'SEMPARAR', idANTT: '45990169007768973091', tag: '0737371360' },
      },
      components: { toll: 535.89 },
    } as unknown as StoredPricingBreakdown;

    const result = buildOrderRouteSyncUpdate(
      { km_distance: 2795, toll_value: 357.85, pricing_breakdown: quoteBd },
      {
        id: 'ord-1',
        os_number: 'OS-2026-08-0003',
        pricing_breakdown: orderBd,
        has_vpo: true,
      }
    );

    if ('error' in result) throw new Error(result.error);
    expect(result.km_distance).toBe(2795);
    expect(result.toll_value).toBe(357.85);
    expect(result.plazasCount).toBe(2);
    expect(result.has_vpo).toBe(false);
    expect(result.pricing_breakdown.meta?.tollPlazas).toHaveLength(2);
    expect(result.pricing_breakdown.meta?.vpo).toBeUndefined();
    expect(result.pricing_breakdown.components.toll).toBe(357.85);
    expect(result.clearedVpo?.idANTT).toBe('45990169007768973091');
  });

  it('erro sem praças', () => {
    const result = buildOrderRouteSyncUpdate(
      { km_distance: 100, pricing_breakdown: { meta: {} } },
      { id: 'o', os_number: 'OS-1' }
    );
    expect('error' in result).toBe(true);
  });
});
