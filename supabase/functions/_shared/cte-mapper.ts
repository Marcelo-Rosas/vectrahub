// @ts-nocheck
/**
 * cte-mapper: build a Focus NFe CT-e payload from a CFN quote + shipper + client.
 *
 * Caller responsibility:
 *   - Load quote, shipper, client rows from DB.
 *   - Allocate (serie, numero) via public.next_cte_numero RPC.
 *   - Provide Vectra emitter config (env-derived).
 *   - Resolve missing IBGE via ibge-lookup if needed.
 *
 * This function only transforms data → no DB access, no network.
 */

import { resolveCfopCte, type IndicadorIE } from './cfop-resolver.ts';

export interface VectraConfig {
  cnpj: string;
  nome: string;
  fantasia: string;
  ie: string;
  iest: string; // may equal IE if no ST registration
  rntrc: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  ibge: number;
  uf: string;
  cep: string;
  telefone?: string;
  crt: number; // 1=Simples, 2=Simples sublimite, 3=Normal/LP
}

export interface QuoteRow {
  id: string;
  quote_code?: string | null;
  client_id?: string | null;
  shipper_id?: string | null;
  origin?: string | null;
  destination?: string | null;
  origin_cep?: string | null;
  destination_cep?: string | null;
  origin_ibge?: number | null;
  destination_ibge?: number | null;
  origin_uf?: string | null;
  destination_uf?: string | null;
  value: number; // total CT-e (R$, NOT centavos in this column per existing schema)
  cargo_value?: number | null;
  weight?: number | null; // kg
  cubage_weight?: number | null;
  billable_weight?: number | null;
  cargo_type?: string | null;
  freight_type?: string | null; // 'fracionado' | 'lotacao' | etc
  freight_modality?: string | null;
  pricing_breakdown?: PricingBreakdown | null;
  toll_value?: number | null;
  discount_value?: number | null;
  tomador_tipo: number; // 0-4 (required for CT-e)
  nfe_keys?: string[] | null;
}

export interface PartyRow {
  id: string;
  name: string;
  cnpj?: string | null;
  cpf?: string | null;
  state_registration?: string | null;
  ie_indicator?: IndicadorIE | null;
  ibge_code?: number | null;
  address?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PricingBreakdown {
  // Edge calculate-freight returns snake_case
  frete_peso?: number;
  frete_valor?: number;
  gris?: number;
  tso?: number;
  pedagio?: number;
  ad_valorem?: number;
  tac?: number;
  dispatch_fee?: number;
  // ICMS
  icms_base?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  totals?: {
    totalCliente?: number;
    discount?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BuildCteInput {
  quote: QuoteRow;
  shipper: PartyRow;
  client: PartyRow;
  serie: number;
  numero: number;
  vectra: VectraConfig;
  // Optional: override tomador (party defaults to client/destinatario)
  expedidor?: PartyRow; // defaults to shipper
  recebedor?: PartyRow; // defaults to client
  naturezaOperacao?: string;
  /** Incrementa sufixo `-rN` no ref (idempotência Focus + UNIQUE cte_emissions.ref). */
  retry?: number;
  /** Valor faturado da OS (card). Tem prioridade sobre quote.value. */
  orderValue?: number | string | null;
  /** Prestação desta via (1 CT-e por NF). Tem prioridade sobre order/quote. */
  valorPrestacao?: number | string | null;
  /** Número da NF-e vinculada (sufixo do ref Focus). */
  nfeNumero?: string | null;
}

export interface BuildCteResult {
  ref: string;
  payload: Record<string, unknown>;
  warnings: string[];
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/**
 * Tag IE de uma parte no CT-e (`inscricao_estadual_<papel>`).
 * Regras MOC CT-e (≠ NF-e — CT-e não tem indIEDest):
 *   IE numérica  → contribuinte inscrito
 *   "ISENTO"     → contribuinte isento de inscrição (ie_indicator=2)
 *   tag ausente  → não contribuinte (ie_indicator=9)
 */
function ieCteField(
  papel: 'destinatario' | 'recebedor' | 'remetente' | 'expedidor',
  party: PartyRow
): Record<string, string> {
  const key = `inscricao_estadual_${papel}`;
  const raw = String(party.state_registration ?? '').trim();
  const indicador = Number(party.ie_indicator ?? 1);
  if (raw && !/^isento$/i.test(raw)) return { [key]: digits(raw) || raw };
  if (indicador === 2) return { [key]: 'ISENTO' };
  return {};
}

/**
 * SEFAZ CT-e/MDF-e: RNTRC pattern `[0-9]{8}|ISENTO`.
 * Portal ANTT às vezes exibe 9 dígitos com zero à esquerda (ex.: 059734055) —
 * normaliza para 8 dígitos (último bloco numérico / strip leading zeros).
 */
export function normalizeRntrcSefaz(raw: string | null | undefined): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  if (/^ISENTO$/i.test(trimmed)) return 'ISENTO';
  const d = digits(trimmed);
  if (d.length === 8) return d;
  // ANTT 9 dig c/ zero à esquerda → SEFAZ 8 (drop 1 zero). Ex.: 059734055→59734055
  // Evita strip-all: 002353222 → 02353222 (errado p/ portal se reconsultado).
  if (d.length === 9 && d.startsWith('0')) return d.slice(1);
  if (d.length > 8) {
    const stripped = d.replace(/^0+/, '');
    if (stripped.length === 8) return stripped;
    if (stripped.length > 8) return stripped.slice(-8);
    return d.slice(-8);
  }
  return d.padStart(8, '0');
}

function toMoneyNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valor da prestação do CT-e = o que o tomador paga.
 * Ordem: OS.card (order.value) → tabela − desconto (1x) → quote.value.
 * Evita desconto duplicado quando quote.value já veio líquido e o save
 * subtraiu discount de novo (COT-2026-08-0002: 26.000 → 25.248,31).
 */
export function resolveCteValorPrestacao(input: {
  quoteValue?: number | string | null;
  orderValue?: number | string | null;
  totalCliente?: number | string | null;
  discount?: number | string | null;
  valorPrestacao?: number | string | null;
}): number {
  const forced = toMoneyNumber(input.valorPrestacao);
  if (forced != null && forced > 0) return Number(forced.toFixed(2));

  const order = toMoneyNumber(input.orderValue);
  if (order != null && order > 0) return Number(order.toFixed(2));

  const bruto = toMoneyNumber(input.totalCliente);
  const discount = Math.max(0, toMoneyNumber(input.discount) ?? 0);
  if (bruto != null && bruto > 0) {
    return Number(Math.max(0, bruto - discount).toFixed(2));
  }

  return Number((toMoneyNumber(input.quoteValue) ?? 0).toFixed(2));
}

function moneyToBRL(value: number | string | null | undefined): number {
  return Number((toMoneyNumber(value) ?? 0).toFixed(2));
}

function nz<T>(value: T | null | undefined, fallback: T): T {
  return value == null ? fallback : value;
}

function requireField(
  value: string | number | null | undefined,
  name: string,
  warnings: string[]
): string {
  if (value == null || value === '') {
    warnings.push(`Missing required field: ${name}`);
    return '';
  }
  return String(value);
}

function partyDoc(p: PartyRow): { cnpj?: string; cpf?: string } {
  const cnpj = digits(p.cnpj);
  if (cnpj.length === 14) return { cnpj };
  const cpf = digits(p.cpf);
  if (cpf.length === 11) return { cpf };
  return {};
}

function buildEnderecoFields(prefix: string, p: PartyRow): Record<string, unknown> {
  return {
    [`logradouro_${prefix}`]: p.address ?? '',
    [`numero_${prefix}`]: p.address_number ?? 'S/N',
    ...(p.address_complement ? { [`complemento_${prefix}`]: p.address_complement } : {}),
    [`bairro_${prefix}`]: p.address_neighborhood ?? '',
    [`codigo_municipio_${prefix}`]: p.ibge_code ?? null,
    [`municipio_${prefix}`]: p.city ?? '',
    [`uf_${prefix}`]: p.state ?? '',
    [`cep_${prefix}`]: digits(p.zip_code),
    [`codigo_pais_${prefix}`]: 1058,
    [`pais_${prefix}`]: 'Brasil',
  };
}

function buildComponentes(
  pb: PricingBreakdown | null | undefined
): Array<{ nome: string; valor: number }> {
  if (!pb) return [];
  const map: Array<[string, number | undefined]> = [
    ['FRETE PESO', pb.frete_peso],
    ['FRETE VALOR', pb.frete_valor],
    ['GRIS', pb.gris],
    ['TSO', pb.tso],
    ['PEDAGIO', pb.pedagio],
    ['AD VALOREM', pb.ad_valorem],
    ['TAC', pb.tac],
    ['DESPACHO', pb.dispatch_fee],
  ];
  return map
    .filter(([_, v]) => typeof v === 'number' && v > 0)
    .map(([nome, valor]) => ({ nome, valor: Number((valor as number).toFixed(2)) }));
}

export function buildCteRef(quoteCode: string, retry = 0, nfeNumero?: string | null): string {
  const code = quoteCode || 'NOCODE';
  const nfe = String(nfeNumero ?? '').replace(/\D/g, '');
  const nfePart = nfe ? `-NF${nfe}` : '';
  return retry > 0 ? `CFN-CTE-${code}${nfePart}-r${retry}` : `CFN-CTE-${code}${nfePart}`;
}

/**
 * Extrai o nome do município de strings compostas tipo "Itajaí - SC, 88317100"
 * ou " Itanhaém- SP, 11746-160". SEFAZ (xMunInic/xMunFim) exige só o nome da cidade,
 * sem UF/CEP e sem espaço nas pontas (rejeição schema 422 facet 'pattern').
 * Remove o sufixo "- UF[, CEP]" e normaliza espaços; preserva hífen no nome
 * (ex.: "Biritiba-Mirim"). Cai no fallback (cidade limpa do cadastro) se vazio.
 */
function municipioNome(
  composite: string | null | undefined,
  fallback: string | null | undefined
): string {
  const stripped = (composite ?? '').replace(/\s*-\s*[A-Z]{2}\s*(?:,.*)?$/, '').trim();
  return stripped || (fallback ?? '').trim();
}

export function buildCtePayload(input: BuildCteInput): BuildCteResult {
  const { quote, shipper, client, serie, numero, vectra } = input;
  const expedidor = input.expedidor ?? shipper;
  const recebedor = input.recebedor ?? client;
  const warnings: string[] = [];
  const retry = Number(input.retry ?? 0);

  const ufOrigem = (quote.origin_uf || shipper.state || vectra.uf).toUpperCase();
  const ufDestino = (quote.destination_uf || client.state || '').toUpperCase();

  // Tomador IE indicator deve vir da parte correta (CIF→remetente, FOB→destinatário).
  // Bug antigo: sempre usava client → CIF mandava indTomador=9 com academia.
  const tomadorTipo = Number(quote.tomador_tipo ?? 3);
  const tomadorParty: PartyRow =
    tomadorTipo === 0
      ? shipper
      : tomadorTipo === 1
        ? expedidor
        : tomadorTipo === 2
          ? recebedor
          : client;
  const rawTomadorIe = Number(tomadorParty.ie_indicator);
  const tomadorIndicadorIE = (
    rawTomadorIe === 1 || rawTomadorIe === 2 || rawTomadorIe === 9 ? rawTomadorIe : 1
  ) as IndicadorIE;
  const destIndicadorIE = (Number(client.ie_indicator ?? 9) as IndicadorIE) || 9;

  const cfop = resolveCfopCte({
    ufOrigem,
    ufDestino,
    ufEmitente: vectra.uf,
    tomadorIndicadorIE,
  });

  const componentes = buildComponentes(quote.pricing_breakdown ?? undefined);
  const pbTotals = quote.pricing_breakdown?.totals;
  const valorTotal = resolveCteValorPrestacao({
    quoteValue: quote.value,
    orderValue: input.orderValue,
    totalCliente: pbTotals?.totalCliente,
    discount: pbTotals?.discount ?? quote.discount_value,
    valorPrestacao: input.valorPrestacao,
  });
  const valorReceber = valorTotal;

  const ref = buildCteRef(quote.quote_code ?? quote.id, retry, input.nfeNumero);
  const rntrcSefaz = normalizeRntrcSefaz(vectra.rntrc);
  if (!rntrcSefaz || (rntrcSefaz !== 'ISENTO' && rntrcSefaz.length !== 8)) {
    warnings.push(`vectra.rntrc invalid for SEFAZ pattern [0-9]{8}|ISENTO (raw=${vectra.rntrc})`);
  } else if (digits(vectra.rntrc) !== rntrcSefaz && rntrcSefaz !== 'ISENTO') {
    warnings.push(
      `vectra.rntrc normalized ${digits(vectra.rntrc)} → ${rntrcSefaz} (SEFAZ 8 digits)`
    );
  }

  // ICMS — Lucro Presumido / Normal: CST 00 (tributação integral)
  const icmsAliquota = quote.pricing_breakdown?.icms_aliquota ?? null;
  const icmsBase = quote.pricing_breakdown?.icms_base ?? valorTotal;
  const icmsValor = quote.pricing_breakdown?.icms_valor ?? null;

  const payload: Record<string, unknown> = {
    // === ide ===
    cfop,
    natureza_operacao: input.naturezaOperacao ?? 'PRESTACAO DE SERVICO DE TRANSPORTE',
    // SEFAZ exige horário local. Brasil é UTC-3 fixo (sem DST desde 2019).
    // toISOString() é UTC → SEFAZ lê 3h no futuro (rejeição 212 "data posterior
    // ao recebimento"). Subtrai 3h e anexa o offset -03:00 explícito.
    data_emissao: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 19) + '-03:00',
    tipo_documento: 0, // 0 = Normal
    modal: '01', // 01 = Rodoviário
    tipo_servico: 0, // 0 = Normal
    serie,
    numero,
    codigo_municipio_envio: shipper.ibge_code ?? null,
    municipio_envio: shipper.city ?? '',
    uf_envio: ufOrigem,
    codigo_municipio_inicio: quote.origin_ibge ?? shipper.ibge_code ?? null,
    municipio_inicio: municipioNome(quote.origin, shipper.city),
    uf_inicio: ufOrigem,
    codigo_municipio_fim: quote.destination_ibge ?? client.ibge_code ?? null,
    municipio_fim: municipioNome(quote.destination, client.city),
    uf_fim: ufDestino,
    retirar_mercadoria: 0,
    detalhes_retirar: nz(quote.cargo_type, 'CARGA GERAL'),

    // === emitente ===
    cnpj_emitente: vectra.cnpj,
    inscricao_estadual_emitente: vectra.ie,
    inscricao_estadual_st_emitente: vectra.iest,
    nome_emitente: vectra.nome,
    nome_fantasia_emitente: vectra.fantasia,
    crt_emitente: vectra.crt,
    logradouro_emitente: vectra.logradouro,
    numero_emitente: vectra.numero,
    ...(vectra.complemento ? { complemento_emitente: vectra.complemento } : {}),
    bairro_emitente: vectra.bairro,
    codigo_municipio_emitente: vectra.ibge,
    municipio_emitente: vectra.municipio,
    uf_emitente: vectra.uf,
    cep_emitente: vectra.cep,
    ...(vectra.telefone ? { telefone_emitente: vectra.telefone } : {}),

    // === remetente ===
    ...(shipper.cnpj ? { cnpj_remetente: digits(shipper.cnpj) } : {}),
    ...(shipper.cpf ? { cpf_remetente: digits(shipper.cpf) } : {}),
    nome_remetente: requireField(shipper.name, 'remetente.name', warnings),
    ...(shipper.state_registration && shipper.state_registration.trim() !== ''
      ? { inscricao_estadual_remetente: shipper.state_registration }
      : {}),
    telefone_remetente: digits(shipper.phone) || undefined,
    ...buildEnderecoFields('remetente', shipper),

    // === expedidor ===
    nome_expedidor: expedidor.name,
    ...(expedidor.cnpj ? { cnpj_expedidor: digits(expedidor.cnpj) } : {}),
    ...(expedidor.cpf ? { cpf_expedidor: digits(expedidor.cpf) } : {}),
    // SEFAZ exige IE do expedidor contribuinte (rejeição 717). Só envia se não-vazia.
    ...(expedidor.state_registration && expedidor.state_registration.trim() !== ''
      ? { inscricao_estadual_expedidor: expedidor.state_registration }
      : {}),
    telefone_expedidor: digits(expedidor.phone) || undefined,
    ...buildEnderecoFields('expedidor', expedidor),

    // === recebedor ===
    nome_recebedor: recebedor.name,
    ...(recebedor.cnpj ? { cnpj_recebedor: digits(recebedor.cnpj) } : {}),
    ...(recebedor.cpf ? { cpf_recebedor: digits(recebedor.cpf) } : {}),
    // SEFAZ exige IE do recebedor contribuinte (rejeição 718). Só envia se não-vazia.
    ...ieCteField('recebedor', recebedor),
    telefone_recebedor: digits(recebedor.phone) || undefined,
    ...buildEnderecoFields('recebedor', recebedor),

    // === destinatário ===
    nome_destinatario: requireField(client.name, 'destinatario.name', warnings),
    ...(client.cnpj ? { cnpj_destinatario: digits(client.cnpj) } : {}),
    ...(client.cpf ? { cpf_destinatario: digits(client.cpf) } : {}),
    // CT-e não tem indIEDest (isso é NF-e). Só a tag IE: número, "ISENTO"
    // (contribuinte isento de inscrição) ou ausente (não contribuinte).
    // MOC G129: ISENTO/ausente + destinatário COM IE ativa na UF → rejeição 232.
    ...ieCteField('destinatario', client),
    telefone_destinatario: digits(client.phone) || undefined,
    ...buildEnderecoFields('destinatario', client),

    // === tomador ===
    indicador_inscricao_estadual_tomador: tomadorIndicadorIE,
    tomador: quote.tomador_tipo,

    // === vPrest ===
    valor_total: valorTotal,
    valor_receber: valorReceber,
    componentes_valor_servico: componentes,

    // === ICMS (CST 00 — tributação normal LP) ===
    icms_situacao_tributaria: '00',
    ...(icmsBase != null ? { base_calculo_icms: Number(icmsBase.toFixed(2)) } : {}),
    ...(icmsAliquota != null ? { aliquota_icms: Number(icmsAliquota.toFixed(2)) } : {}),
    ...(icmsValor != null ? { valor_icms: Number(icmsValor.toFixed(2)) } : {}),

    // === infCarga ===
    valor_carga: moneyToBRL(quote.cargo_value),
    produto_predominante: nz(quote.cargo_type, 'CARGA GERAL'),
    quantidades: [
      {
        codigo_unidade_medida: '01', // 01 = KG
        tipo_medida: 'PESO BRUTO',
        quantidade: Number((quote.weight ?? 0).toFixed(3)),
      },
    ],

    // === modal rodoviário ===
    modal_rodoviario: {
      rntrc: rntrcSefaz,
    },

    // === documentos vinculados ===
    ...(quote.nfe_keys && quote.nfe_keys.length > 0
      ? { nfes: quote.nfe_keys.map((chave_nfe) => ({ chave_nfe })) }
      : {
          outros_documentos: [
            {
              tipo_documento: '99',
              descricao: 'DECLARACAO DE CARGA',
              numero: quote.quote_code ?? quote.id.slice(0, 8),
              data_emissao: new Date().toISOString().slice(0, 10),
              valor: moneyToBRL(quote.cargo_value),
            },
          ],
        }),

    // === info adicionais ===
    informacoes_adicionais_contribuinte: input.nfeNumero
      ? `Cotacao ${quote.quote_code ?? quote.id.slice(0, 8)} NF-e ${input.nfeNumero} dest ${client.name} — CFN`
      : `Cotacao ${quote.quote_code ?? quote.id.slice(0, 8)} — emitido via CFN`,
  };

  // Validation warnings (non-blocking — caller decides)
  if (!shipper.ibge_code)
    warnings.push('shipper.ibge_code missing — codigo_municipio_remetente will be null');
  if (!client.ibge_code)
    warnings.push('client.ibge_code missing — codigo_municipio_destinatario will be null');
  if (!quote.origin_ibge)
    warnings.push('quote.origin_ibge missing — codigo_municipio_inicio fallback used');
  if (!quote.destination_ibge)
    warnings.push('quote.destination_ibge missing — codigo_municipio_fim fallback used');
  if (!ufDestino) warnings.push('destination_uf could not be resolved');
  if (quote.tomador_tipo == null) warnings.push('quote.tomador_tipo not set — required by SEFAZ');
  if (!quote.nfe_keys || quote.nfe_keys.length === 0)
    warnings.push('No NFe keys — using outros_documentos fallback (declaração de carga)');

  return { ref, payload, warnings };
}
