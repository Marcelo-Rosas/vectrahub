/**
 * Lotação (FTL): base de custo carreteiro para gross-up = Piso ANTT bruto, quando calculado.
 * Cotação lotação/fracionado no mesmo caminhão+motorista: 1 contratante vs 2+ (eixo separado do CIOT).
 * Tabela NTC (+ over km) é referência comercial; fretePesoReferenciaMax = max(tabela+over km, piso) para compliance.
 * Paridade obrigatória com src/lib/lotacao-freight-base.ts
 */

export const LOTACAO_KM_OVER_RULE_KEYS = [
  { maxKm: 800, key: 'over_lotacao_ate_800km' },
  { maxKm: 1500, key: 'over_lotacao_801_1500km' },
  { maxKm: 2500, key: 'over_lotacao_1501_2500km' },
  { maxKm: Number.POSITIVE_INFINITY, key: 'over_lotacao_acima_2500km' },
] as const;

export const LOTACAO_OVER_ANTT_KEY = 'over_lotacao_percent';

export type QuoteFreightModality = 'lotacao' | 'fracionado';
export type CiotCadastroType = 'carga_lotacao' | 'carga_fracionada' | 'tac_agregado';

export interface QuoteTripParty {
  client_id?: string | null;
  shipper_id?: string | null;
  name?: string | null;
}

export interface QuoteTripContractorInput {
  clientId?: string | null;
  clientName?: string | null;
  additionalRecipients?: QuoteTripParty[];
  additionalShippers?: QuoteTripParty[];
  tacAgregado?: boolean;
  remuneratedRoadCargo?: boolean;
  international?: boolean;
  unplatedNewVehicle?: boolean;
  specialUnhomologatedComposition?: boolean;
}

export interface QuoteTripContractorClassification {
  contractorKeys: string[];
  distinctContractorCount: number;
  /** Tabela NTC / motor de cotação — 1 contratante no caminhão = lotação. */
  quoteFreightModality: QuoteFreightModality;
  /** Portaria SUROC nº 6/2026 art. 7º (cadastro CIOT). Não define o preço. */
  ciotCadastroType: CiotCadastroType;
  /** Lei 13.703/2018 art. 7º — independente da modalidade da cotação. */
  ciotObrigatorio: boolean;
}

export function normalizeContractorKey(raw: string | null | undefined): string | null {
  const v = String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return v.length > 0 ? v : null;
}

export function collectQuoteTripContractorKeys(input: QuoteTripContractorInput): string[] {
  const keys = new Set<string>();
  const primaryId = normalizeContractorKey(input.clientId);
  const primaryName = normalizeContractorKey(input.clientName);
  if (primaryId) keys.add(`id:${primaryId}`);
  else if (primaryName) keys.add(`name:${primaryName}`);

  for (const r of input.additionalRecipients ?? []) {
    const id = normalizeContractorKey(r.client_id);
    if (id) keys.add(`id:${id}`);
  }
  for (const s of input.additionalShippers ?? []) {
    const id = normalizeContractorKey(s.shipper_id);
    if (id) keys.add(`id:${id}`);
  }
  return [...keys];
}

/**
 * Cotação (NTC + piso PAG): mesmo caminhão/motorista.
 * 1 contratante embarcado → lotação. 2+ contratantes distintos → fracionado.
 * Não usa tipo CIOT nem tabela escolhida.
 */
export function resolveQuoteFreightModality(distinctContractorCount: number): QuoteFreightModality {
  return distinctContractorCount >= 2 ? 'fracionado' : 'lotacao';
}

/** Cadastro CIOT (SUROC 6 art. 7). Eixo regulatório separado da cotação. */
export function resolveCiotCadastroType(params: {
  distinctContractorCount: number;
  tacAgregado?: boolean;
}): CiotCadastroType {
  if (params.tacAgregado) return 'tac_agregado';
  return params.distinctContractorCount >= 2 ? 'carga_fracionada' : 'carga_lotacao';
}

/**
 * Obrigação de gerar CIOT (Lei 13.703 art. 7º + SUROC 6 art. 29).
 * Fracionado NTC ou lotação NTC: CIOT continua obrigatório no TRC remunerado.
 */
export function isCiotGenerationObligatory(params?: {
  quoteFreightModality?: QuoteFreightModality;
  remuneratedRoadCargo?: boolean;
  international?: boolean;
  unplatedNewVehicle?: boolean;
  specialUnhomologatedComposition?: boolean;
}): boolean {
  void params?.quoteFreightModality;
  if (params?.remuneratedRoadCargo === false) return false;
  if (params?.international) return false;
  if (params?.unplatedNewVehicle) return false;
  if (params?.specialUnhomologatedComposition) return false;
  return true;
}

export function classifyQuoteTripContractors(
  input: QuoteTripContractorInput = {}
): QuoteTripContractorClassification {
  const contractorKeys = collectQuoteTripContractorKeys(input);
  const distinctContractorCount = contractorKeys.length;
  return {
    contractorKeys,
    distinctContractorCount,
    quoteFreightModality: resolveQuoteFreightModality(distinctContractorCount),
    ciotCadastroType: resolveCiotCadastroType({
      distinctContractorCount,
      tacAgregado: input.tacAgregado,
    }),
    ciotObrigatorio: isCiotGenerationObligatory({
      remuneratedRoadCargo: input.remuneratedRoadCargo,
      international: input.international,
      unplatedNewVehicle: input.unplatedNewVehicle,
      specialUnhomologatedComposition: input.specialUnhomologatedComposition,
    }),
  };
}

/** Prêmio seguro estimado (custo real): RCTR-C 0,015% + RC-DC 0,015% s/ valor da carga. */
export const INSURANCE_RCTR_C_RATE = 0.00015;
export const INSURANCE_RC_DC_RATE = 0.00015;

export type ResolvePricingRuleFn = (key: string) => number | undefined;

export function resolveLotacaoKmOverPercent(km: number, resolveRule: ResolvePricingRuleFn): number {
  const kmCeil = Math.ceil(Math.max(0, km));
  for (const band of LOTACAO_KM_OVER_RULE_KEYS) {
    if (kmCeil <= band.maxKm) {
      return resolveRule(band.key) ?? 0;
    }
  }
  return 0;
}

export interface LotacaoFretePesoResult {
  /** Base de custo motorista (piso ANTT bruto) usada no gross-up e custos diretos */
  fretePeso: number;
  /** max(tabela+over km, piso ANTT) — referência comercial e piso mínimo de venda */
  fretePesoReferenciaMax: number;
  freteTabela: number;
  freteTabelaComOverKm: number;
  pisoAntt: number;
  pisoComOverAntt: number;
  overKmPercent: number;
  overAnttPercent: number;
  /** true quando o piso ANTT é a base de custo do cálculo */
  pisoAplicado: boolean;
  anttCostBaseUsed: boolean;
  /** Legado/meta: piso usado como base OU piso > tabela bruta (compliance) */
  anttFloorApplied: boolean;
}

export function resolveLotacaoFretePeso(params: {
  freteTabela: number;
  pisoAntt: number;
  km: number;
  overKmPercent: number;
  overAnttPercent: number;
  round?: (n: number) => number;
}): LotacaoFretePesoResult {
  const round = params.round ?? ((n: number) => Math.round((n + Number.EPSILON) * 100) / 100);
  const freteTabela = round(Math.max(0, params.freteTabela));
  /** Piso já calculado pela fórmula ANTT (ceil(km)×CCD+CC); não reaplicar over nem markup. */
  const pisoAntt = round(Math.max(0, params.pisoAntt));
  const freteTabelaComOverKm = round(freteTabela * (1 + params.overKmPercent / 100));
  /** Legado/meta: igual ao piso bruto (over ANTT não entra no gross-up). */
  const pisoComOverAntt = pisoAntt;
  const fretePesoReferenciaMax = round(Math.max(freteTabelaComOverKm, pisoAntt));
  const anttCostBaseUsed = pisoAntt > 0;
  const fretePeso = anttCostBaseUsed ? pisoAntt : freteTabelaComOverKm;
  const pisoAplicado = anttCostBaseUsed;
  const anttFloorApplied =
    anttCostBaseUsed ||
    (pisoAntt > 0 && pisoAntt > freteTabela) ||
    pisoAntt >= freteTabelaComOverKm;

  return {
    fretePeso,
    fretePesoReferenciaMax,
    freteTabela,
    freteTabelaComOverKm,
    pisoAntt,
    pisoComOverAntt,
    overKmPercent: params.overKmPercent,
    overAnttPercent: params.overAnttPercent,
    pisoAplicado,
    anttCostBaseUsed,
    anttFloorApplied,
  };
}

export interface InsuranceRiskCosts {
  items: Array<{ code: string; name: string; cost: number }>;
  total: number;
}

/** Custo real de seguro (não confundir com repasse cobrado do cliente). */
export function estimateInsuranceRiskCosts(
  cargoValue: number,
  round: (n: number) => number = (n) => Math.round((n + Number.EPSILON) * 100) / 100
): InsuranceRiskCosts {
  if (!Number.isFinite(cargoValue) || cargoValue <= 0) {
    return { items: [], total: 0 };
  }
  const rctrc = round(cargoValue * INSURANCE_RCTR_C_RATE);
  const rcdc = round(cargoValue * INSURANCE_RC_DC_RATE);
  return {
    items: [
      { code: 'RCTR-C', name: 'RCTR-C (prêmio)', cost: rctrc },
      { code: 'RC-DC', name: 'RC-DC (prêmio)', cost: rcdc },
    ],
    total: round(rctrc + rcdc),
  };
}

export interface LotacaoProfitabilityInput {
  receitaLiquida: number;
  overhead: number;
  fretePeso: number;
  pisoAntt?: number;
  /** Só custos operacionais NTC (pedágio, taxas, espera…) — SEM repasse de risco. */
  custoServicos: number;
  custosDescarga: number;
  custosDiretos: number;
  totalCliente: number;
  profitMarginPercent: number;
  /** Prêmio seguro / Buonny etc. — deduz do resultado contábil, não do gross-up. */
  custosRiscoReal?: number;
}

export interface LotacaoProfitabilityResult {
  /** Margem de contribuição: RL − OH − motorista − serviços op. − descarga */
  margemBruta: number;
  /** Resultado contábil: margemBruta − custosRiscoReal */
  resultadoLiquido: number;
  /** Lucro embutido no gross-up: custosDiretos × profitMarginPercent */
  lucroAlvo: number;
  /** Margem operacional: resultadoLiquido ÷ totalCliente × 100 */
  margemPercent: number;
  custoMotoristaContratado: number;
  custoMotoristaAntt: number;
}

/**
 * Lotação: separa margem de contribuição, resultado contábil e lucro-alvo do gross-up.
 */
export function calculateLotacaoProfitability(
  input: LotacaoProfitabilityInput,
  round: (n: number) => number = (n) => Math.round((n + Number.EPSILON) * 100) / 100
): LotacaoProfitabilityResult {
  const pisoAntt = round(Math.max(0, input.pisoAntt ?? 0));
  const custoMotoristaContratado = round(input.fretePeso);
  const custoMotoristaMargem = pisoAntt > 0 ? pisoAntt : custoMotoristaContratado;
  const margemBruta = round(
    input.receitaLiquida -
      input.overhead -
      custoMotoristaMargem -
      input.custoServicos -
      input.custosDescarga
  );
  const custosRiscoReal = round(Math.max(0, input.custosRiscoReal ?? 0));
  const resultadoLiquido = round(margemBruta - custosRiscoReal);
  const custosDiretos = round(Math.max(0, input.custosDiretos));
  const lucroAlvo =
    custosDiretos > 0 && input.profitMarginPercent > 0
      ? round(custosDiretos * (input.profitMarginPercent / 100))
      : resultadoLiquido;
  const margemPercent =
    input.totalCliente > 0 ? round((resultadoLiquido / input.totalCliente) * 100) : 0;

  return {
    margemBruta,
    resultadoLiquido,
    lucroAlvo,
    margemPercent,
    custoMotoristaContratado,
    custoMotoristaAntt: pisoAntt > 0 ? pisoAntt : custoMotoristaContratado,
  };
}
