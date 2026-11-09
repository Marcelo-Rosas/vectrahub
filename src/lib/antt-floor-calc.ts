/**
 * Piso mínimo ANTT (Lei 13.703/2018) — paridade com calculadorafrete.antt.gov.br
 * Carga geral; tabela A/B/C/D conforme flags da calculadora.
 * Paridade obrigatória com supabase/functions/_shared/antt-floor-calc.ts
 */

export type AnttOperationTable = 'A' | 'B' | 'C' | 'D';

export const ANTT_CARGO_TYPE_DEFAULT = 'carga_geral' as const;

export interface AnttFloorFlags {
  /** Veículo automotor + implemento (ou caminhão simples se false) */
  composicaoVeicular: boolean;
  altoDesempenho: boolean;
  retornoVazio: boolean;
}

export const ANTT_FLOOR_DEFAULT_FLAGS: AnttFloorFlags = {
  composicaoVeicular: true,
  altoDesempenho: false,
  retornoVazio: false,
};

/**
 * Tabela ANTT — paridade calculadorafrete.antt.gov.br (Res. 6.084/2026 Anexo II):
 * - Composição veicular / lotação (§1) → Tabela A ou C (alto desempenho)
 * - Apenas unidade de tração (§2) → Tabela B ou D
 */
export function resolveAnttOperationTable(flags: AnttFloorFlags): AnttOperationTable {
  if (flags.composicaoVeicular) {
    return flags.altoDesempenho ? 'C' : 'A';
  }
  return flags.altoDesempenho ? 'D' : 'B';
}

export function getAnttOperationTableLabel(table: AnttOperationTable): string {
  const labels: Record<AnttOperationTable, string> = {
    A: 'Tabela A — Lotação (composição veicular)',
    B: 'Tabela B — Apenas unidade de tração',
    C: 'Tabela C — Lotação alto desempenho',
    D: 'Tabela D — Tração alto desempenho',
  };
  return labels[table];
}

export function inferAnttFlagsFromStoredMeta(
  meta?: {
    operationTable?: AnttOperationTable;
    retornoVazio?: number;
    composicaoVeicular?: boolean;
    altoDesempenho?: boolean;
  } | null
): AnttFloorFlags {
  if (!meta) return { ...ANTT_FLOOR_DEFAULT_FLAGS };
  if (meta.composicaoVeicular != null || meta.altoDesempenho != null) {
    return {
      composicaoVeicular: meta.composicaoVeicular ?? ANTT_FLOOR_DEFAULT_FLAGS.composicaoVeicular,
      altoDesempenho: meta.altoDesempenho ?? false,
      retornoVazio: (meta.retornoVazio ?? 0) > 0.01,
    };
  }
  const table = meta.operationTable ?? 'A';
  return {
    composicaoVeicular: table === 'A' || table === 'C',
    altoDesempenho: table === 'C' || table === 'D',
    retornoVazio: (meta.retornoVazio ?? 0) > 0.01,
  };
}

/**
 * Piso em R$ (mesma base da calculadora ANTT):
 * - Ida: km × CCD + CC
 * - Retorno vazio: acrescenta km × CCD (deslocamento de volta sem novo CC fixo)
 */
/** KM da fórmula oficial (calculadorafrete.antt.gov.br): arredonda para cima. */
export function resolveAnttKmForPiso(kmDistance: number): number {
  return Math.ceil(Math.max(0, kmDistance));
}

export function calculateAnttPisoBrl(params: {
  kmDistance: number;
  ccd: number;
  cc: number;
  retornoVazio: boolean;
}): { ida: number; retornoVazio: number; total: number } {
  const km = Math.max(0, params.kmDistance);
  const ida = km * params.ccd + params.cc;
  const retorno = params.retornoVazio ? km * params.ccd : 0;
  return {
    ida,
    retornoVazio: retorno,
    total: ida + retorno,
  };
}

/**
 * Piso carreteiro (R$) com paridade calculadora ANTT: ceil(km)×CCD + CC (+ retorno vazio).
 * Valor retornado em `total` é a base seca do gross-up em lotação.
 */
export function computeAnttPisoCarreteiroReais(params: {
  kmDistance: number;
  ccd: number;
  cc: number;
  retornoVazio?: boolean;
  round?: (n: number) => number;
}): { kmUsed: number; ida: number; retornoVazio: number; total: number } {
  const kmUsed = resolveAnttKmForPiso(params.kmDistance);
  const round = params.round ?? ((n: number) => Math.round((n + Number.EPSILON) * 100) / 100);
  const raw = calculateAnttPisoBrl({
    kmDistance: kmUsed,
    ccd: params.ccd,
    cc: params.cc,
    retornoVazio: params.retornoVazio ?? false,
  });
  return {
    kmUsed,
    ida: round(raw.ida),
    retornoVazio: round(raw.retornoVazio),
    total: round(raw.total),
  };
}
