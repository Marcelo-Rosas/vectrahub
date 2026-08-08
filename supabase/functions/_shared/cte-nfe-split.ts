/** Rateia o frete contratado entre NFs. Última parcela absorve o centavo residual. */
export function splitFreightProportional(totalReais: number, weights: number[]): number[] {
  const total = Number((Number(totalReais) || 0).toFixed(2));
  if (!weights.length) return [];
  const ws = weights.map((w) => Math.max(0, Number(w) || 0));
  const sumW = ws.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    const even = Number((total / ws.length).toFixed(2));
    const parts = Array.from({ length: ws.length }, () => even);
    const diff = Number((total - even * (ws.length - 1)).toFixed(2));
    parts[parts.length - 1] = diff;
    return parts;
  }
  const parts = ws.map((w) => Number(((total * w) / sumW).toFixed(2)));
  const diff = Number((total - parts.reduce((a, b) => a + b, 0)).toFixed(2));
  parts[parts.length - 1] = Number((parts[parts.length - 1] + diff).toFixed(2));
  return parts;
}

/** Número da NF-e (sem zeros à esquerda) a partir da chave 44 dígitos. */
export function nfeNumeroFromChave(chave: string): string {
  const d = String(chave ?? '').replace(/\D/g, '');
  if (d.length !== 44) return '';
  return String(parseInt(d.slice(25, 34), 10) || '');
}

/** CNPJ emitente da NF-e (posições 7–20 da chave 44). */
export function nfeEmitCnpjFromChave(chave: string): string {
  const d = String(chave ?? '').replace(/\D/g, '');
  if (d.length !== 44) return '';
  return d.slice(6, 20);
}

export const MIN_GLOBALIZADO_PARTIES = 5;

export type CteNfeForSplit = {
  chave: string;
  destTaxId: string;
  destUf?: string | null;
};

export type CteEmissionPlan =
  | { mode: 'single'; nfes: CteNfeForSplit[] }
  | { mode: 'normal_multi_nfe'; destTaxId: string; nfes: CteNfeForSplit[] }
  | {
      mode: 'globalizado';
      kind: 'um_remetente_n_dest' | 'n_remetente_um_dest';
      nfes: CteNfeForSplit[];
    }
  | {
      mode: 'per_destinatario';
      reason: string;
      groups: Array<{ destTaxId: string; nfes: CteNfeForSplit[] }>;
    }
  | { mode: 'per_nfe'; reason: string; nfes: CteNfeForSplit[] };

function digitsOnly(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

function groupByDest(nfes: CteNfeForSplit[]): Map<string, CteNfeForSplit[]> {
  const m = new Map<string, CteNfeForSplit[]>();
  for (const n of nfes) {
    const k = digitsOnly(n.destTaxId) || '_';
    const arr = m.get(k) ?? [];
    arr.push(n);
    m.set(k, arr);
  }
  return m;
}

/**
 * Decide 1 CT-e globalizado vs N CT-es.
 * Fontes: MOC CT-e Anexo I (indGlobalizado) + validações 722–730, 743, 744.
 *
 * Globalizado NÃO é “N NFs do mesmo shipper”. Exige também:
 * intramunicipal/interestadual vedado (UF início = UF fim, rej. 743),
 * tomador só remetente(0) ou destinatário(3) (722),
 * só NF-e (723), mínimo 5 destinos (CIF) ou 5 remetentes (FOB),
 * CIF → todas as NF do mesmo emitente (744) + dest = DIVERSOS + CNPJ do emitente do CT-e (728),
 * FOB → ≥5 emitentes NF distintos (724) + rem = DIVERSOS + CNPJ do emitente do CT-e (727).
 */
export function planCteEmissions(input: {
  nfes: CteNfeForSplit[];
  tomadorTipo: number;
  ufInicio: string;
}): CteEmissionPlan {
  const nfes = input.nfes.filter((n) => digitsOnly(n.chave).length === 44);
  if (nfes.length <= 1) return { mode: 'single', nfes };

  const ufIni = String(input.ufInicio ?? '')
    .trim()
    .toUpperCase();
  const toma = Number(input.tomadorTipo);
  const destGroups = groupByDest(nfes);
  const emitSet = new Set(nfes.map((n) => nfeEmitCnpjFromChave(n.chave)).filter(Boolean));
  const destUfs = new Set(
    nfes
      .map((n) =>
        String(n.destUf ?? '')
          .trim()
          .toUpperCase()
      )
      .filter((u) => u.length === 2)
  );
  const sameUf = Boolean(ufIni) && destUfs.size === 1 && destUfs.has(ufIni);
  const tomaOk = toma === 0 || toma === 3;

  if (destGroups.size === 1) {
    const [destTaxId, list] = [...destGroups.entries()][0]!;
    if (emitSet.size <= 1) {
      return { mode: 'normal_multi_nfe', destTaxId, nfes: list };
    }
    if (toma === 3 && sameUf && emitSet.size >= MIN_GLOBALIZADO_PARTIES) {
      return { mode: 'globalizado', kind: 'n_remetente_um_dest', nfes: list };
    }
    return {
      mode: 'per_nfe',
      reason: 'varios_emitentes_sem_globalizado_rej729',
      nfes: list,
    };
  }

  if (
    toma === 0 &&
    tomaOk &&
    sameUf &&
    emitSet.size === 1 &&
    destGroups.size >= MIN_GLOBALIZADO_PARTIES
  ) {
    return { mode: 'globalizado', kind: 'um_remetente_n_dest', nfes };
  }

  const reasons: string[] = [];
  if (!tomaOk) reasons.push('tomador_nao_rem_nem_dest');
  if (!sameUf) reasons.push('interestadual_ou_uf_destino_divergente');
  if (toma === 0 && destGroups.size < MIN_GLOBALIZADO_PARTIES) {
    reasons.push(`destinatarios_lt_${MIN_GLOBALIZADO_PARTIES}`);
  }
  if (toma === 0 && emitSet.size !== 1) reasons.push('remetentes_nf_divergentes');
  if (toma === 3 && emitSet.size < MIN_GLOBALIZADO_PARTIES) {
    reasons.push(`remetentes_lt_${MIN_GLOBALIZADO_PARTIES}`);
  }

  return {
    mode: 'per_destinatario',
    reason: reasons.join(',') || 'destinatarios_diferentes',
    groups: [...destGroups.entries()].map(([destTaxId, list]) => ({ destTaxId, nfes: list })),
  };
}
