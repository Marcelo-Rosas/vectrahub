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
  if (!sameUf) reasons.push('interestadual_ou_uf_destino_divergente'); // rej. 743
  if (toma === 0 && destGroups.size < MIN_GLOBALIZADO_PARTIES) {
    reasons.push(`destinatarios_lt_${MIN_GLOBALIZADO_PARTIES}`);
  }
  if (toma === 0 && emitSet.size !== 1) reasons.push('remetentes_nf_divergentes'); // rej. 744
  if (toma === 3 && emitSet.size < MIN_GLOBALIZADO_PARTIES) {
    reasons.push(`remetentes_lt_${MIN_GLOBALIZADO_PARTIES}`);
  }

  return {
    mode: 'per_destinatario',
    reason: reasons.join(',') || 'destinatarios_diferentes',
    groups: [...destGroups.entries()].map(([destTaxId, list]) => ({ destTaxId, nfes: list })),
  };
}

/**
 * Agrupa NFs em CT-es normais: mesma NF-e emitente (chave pos. 7–20) + mesmo destinatário
 * → 1 CT-e com N NF-e (planCteEmissions 'normal_multi_nfe'). Emitentes distintos → CT-es
 * separados (rej. 729/744 sem globalizado). Somas de valor/peso/frete; ordem estável.
 */
export type CteLegInput = {
  nfe_key: string;
  nfe_numero: string;
  destTaxId: string;
  cargo_value: number;
  weight: number;
  valor_prestacao: number;
  km_negociado: number;
};

export type CteLegGroup<T extends CteLegInput> = {
  key: string;
  legs: T[];
  nfe_keys: string[];
  nfe_numeros: string[];
  cargo_value: number;
  weight: number;
  valor_prestacao: number;
  km_negociado: number;
};

export function groupCteLegs<T extends CteLegInput>(legs: T[]): CteLegGroup<T>[] {
  const groups = new Map<string, CteLegGroup<T>>();
  const r2 = (n: number) => Number(n.toFixed(2));
  for (const leg of legs) {
    const key = `${nfeEmitCnpjFromChave(leg.nfe_key) || '_'}|${digitsOnly(leg.destTaxId) || '_'}`;
    const g =
      groups.get(key) ??
      ({
        key,
        legs: [],
        nfe_keys: [],
        nfe_numeros: [],
        cargo_value: 0,
        weight: 0,
        valor_prestacao: 0,
        km_negociado: 0,
      } as CteLegGroup<T>);
    g.legs.push(leg);
    g.nfe_keys.push(leg.nfe_key);
    g.nfe_numeros.push(leg.nfe_numero);
    g.cargo_value = r2(g.cargo_value + (Number(leg.cargo_value) || 0));
    g.weight = Number((g.weight + (Number(leg.weight) || 0)).toFixed(3));
    g.valor_prestacao = r2(g.valor_prestacao + (Number(leg.valor_prestacao) || 0));
    g.km_negociado = Math.max(g.km_negociado, Number(leg.km_negociado) || 0);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/**
 * Totais da NF-e a partir do XML: vNF (ICMSTot) e soma de pesoB dos volumes.
 * Fonte de verdade para infCarga/vCarga por CT-e — nunca o rateio do total da OS.
 */
export function nfeTotalsFromXml(xml: string): { valor_nf_xml?: number; peso_bruto_xml?: number } {
  const out: { valor_nf_xml?: number; peso_bruto_xml?: number } = {};
  const text = String(xml ?? '');
  const tot = text.match(/<ICMSTot>([\s\S]*?)<\/ICMSTot>/);
  const vnf = (tot ? tot[1] : text).match(/<vNF>\s*([0-9.]+)\s*<\/vNF>/);
  if (vnf) {
    const v = Number(vnf[1]);
    if (Number.isFinite(v) && v > 0) out.valor_nf_xml = Number(v.toFixed(2));
  }
  let peso = 0;
  for (const m of text.matchAll(/<pesoB>\s*([0-9.]+)\s*<\/pesoB>/g)) {
    const p = Number(m[1]);
    if (Number.isFinite(p)) peso += p;
  }
  if (peso > 0) out.peso_bruto_xml = Number(peso.toFixed(3));
  return out;
}
