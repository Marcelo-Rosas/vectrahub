import { useQuery } from '@tanstack/react-query';
import { computeAnttPisoCarreteiroReais } from '@/lib/antt-floor-calc';
import { asDb } from '@/lib/supabase-utils';
import { supabase } from '@/integrations/supabase/client';

export interface AnttFloorRate {
  operation_table: 'A' | 'B' | 'C' | 'D';
  cargo_type: string;
  axes_count: number;
  ccd: number; // R$/km
  cc: number; // R$
  valid_from: string | null;
  valid_until: string | null;
}

interface UseAnttFloorRateParams {
  operationTable?: 'A' | 'B' | 'C' | 'D';
  cargoType?: string;
  axesCount?: number | null;
}

/**
 * Busca coeficientes CCD/CC para cálculo do piso mínimo ANTT (carga geral).
 * Tabela A–D conforme flags em `resolveAnttOperationTable` (calculadora ANTT).
 */
export function useAnttFloorRate(params: UseAnttFloorRateParams) {
  const operationTable = params.operationTable ?? 'A';
  const cargoType = params.cargoType ?? 'carga_geral';
  const axesCount = params.axesCount;

  return useQuery({
    queryKey: ['antt-floor-rate', operationTable, cargoType, axesCount],
    queryFn: async () => {
      if (!axesCount) return null;

      // Estratégia simples: pega a mais recente (maior valid_from) ou sem valid_from
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('antt_floor_rates')
        .select('operation_table,cargo_type,axes_count,ccd,cc,valid_from,valid_until')
        .eq('operation_table', asDb(operationTable))
        .eq('cargo_type', asDb(cargoType))
        .eq('axes_count', asDb(axesCount))
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .order('valid_from', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as AnttFloorRate | null) ?? null;
    },
    enabled: !!axesCount,
  });
}

export function calculateAnttMinimum(input: {
  kmDistance: number;
  ccd: number;
  cc: number;
  retornoVazio?: boolean;
}) {
  const { kmUsed, ida, retornoVazio, total } = computeAnttPisoCarreteiroReais({
    kmDistance: input.kmDistance,
    ccd: input.ccd,
    cc: input.cc,
    retornoVazio: input.retornoVazio ?? false,
  });
  return {
    ida,
    retornoVazio,
    total,
    formula: {
      kmDistance: kmUsed,
      ccd: input.ccd,
      cc: input.cc,
      retornoVazio: input.retornoVazio ?? false,
    },
  };
}
