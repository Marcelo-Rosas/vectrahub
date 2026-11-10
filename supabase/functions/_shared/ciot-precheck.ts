/**
 * Pré-validação do CIOT (aba CIOT da OS): combina vínculo de placa, piso mínimo,
 * forma de pagamento e saldo CIOT Online. Puro — as chamadas ficam no manage-ciot.
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md §4.1
 */
import type { CiotOnlinePisoData, CiotOnlineResult } from './ciotonline-client.ts';
import type { CiotOnlinePagamento } from './ciotonline-hub.ts';
import type { PlateCheck } from './ciot-plate-cache.ts';

export const DEFAULT_EIXOS_PISO = 5;

export type CiotPrecheckResult = {
  placa: PlateCheck;
  piso: {
    piso_minimo: number | null;
    valor_frete: number;
    abaixo: boolean | null;
    eixos: number;
    eixos_cadastrados: boolean;
    erro?: string;
  };
  pagamento: CiotOnlinePagamento;
  saldo: { creditos: number | null; erro_code?: string };
};

export function summarizePrecheck(input: {
  placa: PlateCheck;
  piso: CiotOnlineResult<CiotOnlinePisoData> | null;
  valorFrete: number;
  eixos: number | null | undefined;
  pagamento: CiotOnlinePagamento;
  saldo: CiotOnlineResult<{ creditos?: number; saldo?: number }> | null;
}): CiotPrecheckResult {
  const eixosCadastrados = Number(input.eixos) > 0;
  const eixos = eixosCadastrados ? Number(input.eixos) : DEFAULT_EIXOS_PISO;
  const valor_frete = Math.round((Number(input.valorFrete) || 0) * 100) / 100;

  let piso_minimo: number | null = null;
  let erro: string | undefined;
  if (input.piso?.ok && input.piso.data?.piso_minimo != null) {
    piso_minimo = Number(input.piso.data.piso_minimo);
  } else if (input.piso && !input.piso.ok) {
    erro = input.piso.error.message;
  }

  let saldo: CiotPrecheckResult['saldo'];
  if (input.saldo?.ok) {
    const c = input.saldo.data?.creditos ?? input.saldo.data?.saldo;
    saldo = { creditos: c != null ? Number(c) : null };
  } else {
    saldo = { creditos: null, ...(input.saldo ? { erro_code: input.saldo.error.code } : {}) };
  }

  return {
    placa: input.placa,
    piso: {
      piso_minimo,
      valor_frete,
      abaixo: piso_minimo == null ? null : valor_frete < piso_minimo,
      eixos,
      eixos_cadastrados: eixosCadastrados,
      ...(erro ? { erro } : {}),
    },
    pagamento: input.pagamento,
    saldo,
  };
}
