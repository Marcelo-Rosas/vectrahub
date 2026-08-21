import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { digitsOnly } from '@/lib/fair-client';

export type FairRouteKmResult = {
  km: number;
  /** Pedágio WebRouter (praças). 0 se a Edge não trouxe. */
  toll: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** KM (+ pedágio Hub) via WebRouter. Prefetch de KM não precisa de eixos. */
export async function fetchFairRouteKm(input: {
  originCep: string;
  destinationCep: string;
  originUf: string;
  destinationUf: string;
  axesCount?: number;
  categoriaVeiculo?: string;
}): Promise<FairRouteKmResult> {
  const origin = digitsOnly(input.originCep);
  const dest = digitsOnly(input.destinationCep);
  if (origin.length !== 8 || dest.length !== 8) {
    throw new Error('CEP origem e destino precisam de 8 dígitos');
  }

  const data = await invokeEdgeFunction<{
    success: boolean;
    data?: { km_distance: number; toll?: number };
    error?: string;
  }>('calculate-distance-webrouter', {
    body: {
      origin_cep: origin,
      destination_cep: dest,
      origin_uf: input.originUf,
      destination_uf: input.destinationUf,
      axes_count: input.axesCount,
      categoria_veiculo: input.categoriaVeiculo,
    },
  });

  if (!data?.success) {
    throw new Error(data?.error || 'Erro ao calcular KM');
  }

  const km = Number(data.data?.km_distance);
  if (!Number.isFinite(km) || km <= 0) {
    throw new Error('Distância inválida retornada pela rota');
  }

  const tollRaw = Number(data.data?.toll);
  const toll = Number.isFinite(tollRaw) && tollRaw > 0 ? roundMoney(tollRaw) : 0;

  return { km: Math.round(km), toll };
}

/** Dedicado: pedágio Hub (WebRouter + eixos). Fracionado: sem toll no motor (12% no overlay). */
export async function resolveFairHubToll(input: {
  originCep: string;
  destinationCep: string;
  originUf: string;
  destinationUf: string;
  dedicado: boolean;
  axesCount?: number | null;
  kmFallback: number;
}): Promise<{ km: number; tollValue: number }> {
  if (!input.dedicado) {
    return { km: input.kmFallback, tollValue: 0 };
  }

  const route = await fetchFairRouteKm({
    originCep: input.originCep,
    destinationCep: input.destinationCep,
    originUf: input.originUf,
    destinationUf: input.destinationUf,
    axesCount: input.axesCount ?? undefined,
  });

  return { km: route.km, tollValue: route.toll };
}
