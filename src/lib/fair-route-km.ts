import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { digitsOnly } from '@/lib/fair-client';

/** KM origem→destino via WebRouter. Pedágio da resposta é ignorado (feira usa % do frete peso). */
export async function fetchFairRouteKm(input: {
  originCep: string;
  destinationCep: string;
  originUf: string;
  destinationUf: string;
}): Promise<number> {
  const origin = digitsOnly(input.originCep);
  const dest = digitsOnly(input.destinationCep);
  if (origin.length !== 8 || dest.length !== 8) {
    throw new Error('CEP origem e destino precisam de 8 dígitos');
  }

  const data = await invokeEdgeFunction<{
    success: boolean;
    data?: { km_distance: number };
    error?: string;
  }>('calculate-distance-webrouter', {
    body: {
      origin_cep: origin,
      destination_cep: dest,
      origin_uf: input.originUf,
      destination_uf: input.destinationUf,
    },
  });

  if (!data?.success) {
    throw new Error(data?.error || 'Erro ao calcular KM');
  }

  const km = Number(data.data?.km_distance);
  if (!Number.isFinite(km) || km <= 0) {
    throw new Error('Distância inválida retornada pela rota');
  }

  return Math.round(km);
}
