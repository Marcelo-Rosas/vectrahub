/**
 * Sync rota operacional COT → OS: km + praças + toll_value (soma praças).
 * Zera meta.vpo / has_vpo para permitir novo Emitir VPO (cancel SemParar separado).
 */

import type { StoredPricingBreakdown, TollPlaza, VpoEmissionRecord } from '@/lib/freightCalculator';

export type QuoteRouteSyncSource = {
  km_distance?: number | null;
  toll_value?: number | null;
  pricing_breakdown?: unknown;
};

export type OrderRouteSyncTarget = {
  id: string;
  os_number: string;
  pricing_breakdown?: unknown;
  has_vpo?: boolean | null;
};

export type OrderRouteSyncUpdate = {
  id: string;
  os_number: string;
  km_distance: number | null;
  toll_value: number;
  has_vpo: false;
  pricing_breakdown: StoredPricingBreakdown;
  clearedVpo: VpoEmissionRecord | null;
  plazasCount: number;
};

function asBreakdown(raw: unknown): StoredPricingBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as StoredPricingBreakdown;
}

export function sumTollPlazasPratica(plazas: TollPlaza[]): number {
  const sum = plazas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
  return Math.round(sum * 100) / 100;
}

export function extractTollPlazas(breakdown: StoredPricingBreakdown | null): TollPlaza[] {
  const plazas = breakdown?.meta?.tollPlazas;
  return Array.isArray(plazas) ? plazas : [];
}

/**
 * Monta update de OS a partir da COT.
 * - km_distance da COT
 * - tollPlazas da COT (substitui)
 * - toll_value = soma prática das praças COT (fallback: components.toll / quote.toll_value)
 * - remove meta.vpo; has_vpo=false
 */
export function buildOrderRouteSyncUpdate(
  quote: QuoteRouteSyncSource,
  order: OrderRouteSyncTarget
): OrderRouteSyncUpdate | { error: string } {
  const quoteBd = asBreakdown(quote.pricing_breakdown);
  const plazas = extractTollPlazas(quoteBd);
  if (plazas.length === 0) {
    return { error: 'Cotação sem praças de pedágio em pricing_breakdown.meta.tollPlazas' };
  }

  const tollFromPlazas = sumTollPlazasPratica(plazas);
  const tollFallback =
    Number(quoteBd?.components?.toll) ||
    (quote.toll_value != null ? Number(quote.toll_value) : NaN);
  const toll_value = Number.isFinite(tollFromPlazas)
    ? tollFromPlazas
    : Number.isFinite(tollFallback)
      ? Math.round(tollFallback * 100) / 100
      : 0;

  const km =
    quote.km_distance != null && Number.isFinite(Number(quote.km_distance))
      ? Number(quote.km_distance)
      : null;

  const orderBd = asBreakdown(order.pricing_breakdown);
  const baseMeta = {
    ...(orderBd?.meta || quoteBd?.meta || {}),
  } as NonNullable<StoredPricingBreakdown['meta']>;
  const clearedVpo = (baseMeta.vpo as VpoEmissionRecord | null | undefined) ?? null;
  delete (baseMeta as { vpo?: VpoEmissionRecord }).vpo;

  const kmByUf = quoteBd?.meta?.kmByUf;
  if (kmByUf && typeof kmByUf === 'object') {
    baseMeta.kmByUf = kmByUf;
  }
  baseMeta.tollPlazas = plazas;

  const components = {
    ...(orderBd?.components || quoteBd?.components || {}),
    toll: toll_value,
  } as StoredPricingBreakdown['components'];

  const pricing_breakdown: StoredPricingBreakdown = {
    calculatedAt: orderBd?.calculatedAt || quoteBd?.calculatedAt || new Date().toISOString(),
    version: orderBd?.version || quoteBd?.version || '4.0',
    status: orderBd?.status || quoteBd?.status || 'OK',
    error: orderBd?.error,
    meta: baseMeta,
    weights: orderBd?.weights ||
      quoteBd?.weights || {
        cubageWeight: 0,
        billableWeight: 0,
        tonBillable: 0,
      },
    components,
    totals: orderBd?.totals ||
      quoteBd?.totals || {
        receitaBruta: 0,
        das: 0,
        icms: 0,
        totalImpostos: 0,
        totalCliente: 0,
      },
    profitability: orderBd?.profitability ||
      quoteBd?.profitability || {
        custosCarreteiro: 0,
        custosDescarga: 0,
        custosDiretos: 0,
        margemBruta: 0,
        overhead: 0,
        resultadoLiquido: 0,
        margemPercent: 0,
      },
    rates: orderBd?.rates ||
      quoteBd?.rates || {
        dasPercent: 14,
        icmsPercent: 0,
        grisPercent: 0,
        tsoPercent: 0,
        costValuePercent: 0,
        markupPercent: 30,
        overheadPercent: 15,
        targetMarginPercent: 15,
      },
    conditionalFeesBreakdown: orderBd?.conditionalFeesBreakdown,
  };

  return {
    id: order.id,
    os_number: order.os_number,
    km_distance: km,
    toll_value,
    has_vpo: false,
    pricing_breakdown,
    clearedVpo,
    plazasCount: plazas.length,
  };
}
