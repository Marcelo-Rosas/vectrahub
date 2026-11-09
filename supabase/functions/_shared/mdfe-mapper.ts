// @ts-nocheck
/**
 * mdfe-mapper: build a Focus NFe MDF-e (modelo 58) payload aggregating N CT-es
 * for a single (veículo + motorista + data + UF rota) operation.
 *
 * Caller responsibility:
 *   - Allocate (serie, numero) via public.next_mdfe_numero RPC.
 *   - Load CT-e rows already AUTHORIZED with chave_cte populated.
 *   - Load vehicle, driver, vectra config.
 *   - Provide percurso UFs (intermediate states between origin and destination).
 *
 * No DB access, no network.
 */

import { normalizeRntrcSefaz, type VectraConfig } from './cte-mapper.ts';

export interface VehicleRow {
  id: string;
  plate: string;
  plate_2?: string | null; // reboque
  renavam?: string | null;
  brand?: string | null;
  model?: string | null;
  // Optional CT-e/MDF-e specific fields (may not be persisted yet)
  tara_kg?: number | null;
  capacidade_kg?: number | null;
  capacidade_m3?: number | null;
  tipo_rodado?: string | null; // '01'..'06' (truck/cavalo/etc)
  tipo_carroceria?: string | null; // '00'..'05' (MOC MDF-e)
  uf_licenciamento?: string | null;
  // Capacidade (nomes reais da tabela vehicles)
  capacity_kg?: number | null;
  capacity_m3?: number | null;
  // Reboque/complemento (quando plate_2 presente)
  reboque_tara_kg?: number | null;
  reboque_capacity_kg?: number | null;
  reboque_tipo_carroceria?: string | null;
  reboque_uf_licenciamento?: string | null;
}

/** Proprietário do veículo (terceiro/TAC) — vem do owner vinculado (owner_id). */
export interface MdfeProprietario {
  rntrc?: string | null;
  cpf_cnpj?: string | null;
  nome?: string | null;
  ie?: string | null;
  uf?: string | null;
  tipo_proprietario?: number | null; // 0=TAC Agregado, 1=TAC Independente, 2=Outros
  /** Pagamento frete (Focus pagamentos / SEFAZ 302-303). */
  payment_prefer?: 'pix' | 'banco' | string | null;
  pix_key?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
}

/** Pagamento do contrato (Focus modal_rodoviario.pagamentos). */
export interface MdfePagamento {
  /** Valor total contrato em R$ (decimal Focus). */
  valorContrato: number;
  /** 0=à vista, 1=a prazo */
  formaPagamento?: 0 | 1;
  /** Componentes; default frete (04) = valorContrato. */
  componentes?: Array<{ tipo: string; valor: number; descricao?: string }>;
}

export interface DriverRow {
  id: string;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
}

export interface CteRowForMdfe {
  chave_cte: string; // 44 chars
  municipio_destino_ibge: number;
  municipio_destino_nome: string;
  uf_destino: string;
  /** UF de início da prestação no CT-e (carregamento). */
  uf_origem?: string;
  valor_carga: number; // R$
  peso_kg: number;
}

export interface MunicipioCarregamento {
  codigo: number;
  nome: string;
  /** UF do município — deve bater com uf_inicio (SEFAZ 456). */
  uf?: string;
}

/** Seguro da carga (grupo seguros_carga do MDF-e). responsavel_seguro: 1=emitente, 2=contratante. */
export interface MdfeSeguro {
  responsavel_seguro: '1' | '2';
  cnpj_responsavel?: string;
  nome_seguradora?: string;
  cnpj_seguradora?: string;
  numero_apolice?: string;
  /** Focus: string ou array — SEFAZ nAver obrigatório no rodoviário (rejeição 699). */
  numero_averbacao?: string | string[];
}

export interface BuildMdfeInput {
  ctes: CteRowForMdfe[];
  vehicle: VehicleRow;
  driver: DriverRow;
  serie: number;
  numero: number;
  vectra: VectraConfig;
  retry?: number; // prior emissions → ref CFN-MDFE-{H|P}-…-rN (Focus dedup)
  /** homolog | prod — prefixo no ref evita UNIQUE global vs homolog. */
  ambiente?: 'homolog' | 'prod';
  municipiosCarregamento: MunicipioCarregamento[]; // 1..50 (where cargo was picked up)
  /**
   * Override UFIni (SEFAZ 456). Sem override: UF majoritária das origens dos CT-es;
   * carregamentos de outras UFs são omitidos do grupo (CT-es continuam no manifesto).
   */
  ufInicio?: string;
  percursoUfs?: string[]; // intermediate UFs between uf_inicio and uf_fim
  /** Apólices ativas (RCTR-C / RC-DC). Responsável = emitente (Vectra). */
  seguros?: MdfeSeguro[];
  /** Proprietário do veículo (do owner vinculado). Ausente = veículo próprio Vectra. */
  proprietario?: MdfeProprietario;
  /**
   * Contratante/tomador do frete (infContratante).
   * SEFAZ 578: obrigatório p/ tpEmit=1 rodoviário sem CIOT/vale-pedágio.
   */
  contratante?: { nome: string; cnpj?: string; cpf?: string };
  produtoPredominante?: {
    descricao: string;
    tipoCarga?: string; // tpCarga: 01..14 (default 05 = Carga Geral)
    ncm?: string;
    cean?: string; // GTIN if available
  };
  /**
   * CEPs infLotacao (Focus: cep_carregamento / cep_descarregamento).
   * SEFAZ 726: obrigatório quando modal rodoviário + tpEmit prestador + 1 único DF-e.
   * Não enviar junto com latitude/longitude.
   */
  cepCarregamento?: string;
  cepDescarregamento?: string;
  /**
   * Pagamento frete (SEFAZ 302 lotação / 303 TAC).
   * Responsável = proprietário (ou omitido se sem dados bancários).
   */
  pagamento?: MdfePagamento;
  /**
   * CIOT (SEFAZ 304 TAC). Fonte: e-FRETE gratuito → orders.ciot_number
   * ou CIOT fracionado de parceiro (meta.ciot.cnpjResponsavel).
   * Focus: modal_rodoviario.ciot[]
   */
  ciots?: Array<{ ciot: string; cnpjResponsavel?: string; cpfResponsavel?: string }>;
  /**
   * Vale-Pedágio (Focus dispositivos_vale_pedagio[]).
   * Fonte: pricing_breakdown.meta.vpo — emissão própria ou IdVpo de parceiro.
   */
  dispositivosValePedagio?: MdfeDispositivoValePedagio[];
  /** SEFAZ 731: obrigatório quando há dispositivos_vale_pedagio (ex.: 04 = 3 eixos). */
  categoriaCombinacaoVeicular?: string;
}

/** Focus modal_rodoviario.dispositivos_vale_pedagio[] */
export interface MdfeDispositivoValePedagio {
  cnpjFornecedora: string;
  cnpjPagador?: string;
  cpfPagador?: string;
  /** IDVPO / nCompra */
  numeroComprovante: string;
  valor: number;
  tipo?: '01' | '04';
}

export interface BuildMdfeResult {
  ref: string;
  payload: Record<string, unknown>;
  warnings: string[];
}

function digits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '');
}

/**
 * Remove o sufixo " - UF" do nome do município (ex.: "Rio de Janeiro - RJ" →
 * "Rio de Janeiro"). O xMunDescarga/xMunCarrega deve ser só o nome do município
 * — o CT-e autorizado usa nome limpo.
 */
function cleanMunicipioNome(s: string | null | undefined): string {
  return (s ?? '').replace(/\s*-\s*[A-Za-z]{2}\s*$/, '').trim();
}

/** RNTRC SEFAZ válido para tag RNTRC do prop: 8 dígitos (ISENTO não aceito neste facet). */
/** Monta Focus `pagamentos[]` a partir do owner + valor contrato. */
export function buildMdfePagamentos(
  prop: MdfeProprietario | undefined,
  pagamento: MdfePagamento | undefined,
  warnings: string[]
): Record<string, unknown>[] | undefined {
  if (!pagamento || !(pagamento.valorContrato > 0)) {
    return undefined;
  }
  const nome = String(prop?.nome ?? '')
    .trim()
    .slice(0, 60);
  const doc = digits(prop?.cpf_cnpj);
  if (!nome || (doc.length !== 11 && doc.length !== 14)) {
    warnings.push('pagamentos omitido — owner sem nome/CPF-CNPJ (SEFAZ 302)');
    return undefined;
  }

  const prefer = String(prop?.payment_prefer ?? '').toLowerCase();
  const pix = String(prop?.pix_key ?? '')
    .trim()
    .slice(0, 60);
  const banco = digits(prop?.bank_code).slice(0, 5);
  const agencia = String(prop?.bank_agency ?? '')
    .trim()
    .slice(0, 10);

  let bancario: Record<string, unknown> | null = null;
  if (prefer === 'pix' && pix.length >= 2) {
    bancario = { pix };
  } else if (prefer === 'banco' && banco.length >= 3 && agencia) {
    bancario = { numero_banco: banco, numero_agencia: agencia };
  } else if (pix.length >= 2) {
    bancario = { pix };
  } else if (banco.length >= 3 && agencia) {
    bancario = { numero_banco: banco, numero_agencia: agencia };
  }

  if (!bancario) {
    warnings.push('pagamentos omitido — owner sem PIX nem banco+agência (SEFAZ 302/303)');
    return undefined;
  }

  const v = Number(pagamento.valorContrato.toFixed(2));
  const comps =
    pagamento.componentes && pagamento.componentes.length > 0
      ? pagamento.componentes.map((c) => ({
          tipo: c.tipo,
          valor: Number(Number(c.valor).toFixed(2)),
          ...(c.descricao ? { descricao: c.descricao.slice(0, 60) } : {}),
        }))
      : [{ tipo: '04', valor: v }];

  return [
    {
      nome,
      ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }),
      componentes: comps,
      valor_total_contrato: v,
      forma_pagamento: pagamento.formaPagamento ?? 0,
      ...bancario,
    },
  ];
}

/**
 * Monta Focus `dispositivos_vale_pedagio[]` (+ categoria_combinacao_veicular).
 * SEFAZ 731: categ obrigatória quando o grupo valePed existe.
 */
export function buildMdfeDispositivosValePedagio(
  dispositivos: MdfeDispositivoValePedagio[] | undefined,
  categoriaCombinacaoVeicular: string | undefined,
  warnings: string[]
): Record<string, unknown> | undefined {
  if (!dispositivos || dispositivos.length === 0) return undefined;

  const list: Record<string, unknown>[] = [];
  for (const d of dispositivos) {
    const forn = digits(d.cnpjFornecedora);
    const nCompra = String(d.numeroComprovante ?? '').replace(/\D/g, '');
    const valor = Number(d.valor);
    if (forn.length !== 14 || nCompra.length < 1 || !(valor > 0)) {
      warnings.push(
        'dispositivo vale-pedágio ignorado — exige cnpj_fornecedora 14d, IDVPO e valor > 0'
      );
      continue;
    }
    const cnpjPg = digits(d.cnpjPagador);
    const cpfPg = digits(d.cpfPagador);
    const row: Record<string, unknown> = {
      cnpj_empresa_fornecedora: forn,
      numero_comprovante_compra: nCompra.slice(0, 20),
      valor_vale_pedagio: Number(valor.toFixed(2)),
      tipo_vale_pedagio: d.tipo === '04' ? '04' : '01',
    };
    if (cnpjPg.length === 14) row.cnpj_responsavel_pagamento = cnpjPg;
    else if (cpfPg.length === 11) row.cpf_responsavel_pagamento = cpfPg;
    else {
      warnings.push('dispositivo vale-pedágio ignorado — falta CNPJ/CPF pagador');
      continue;
    }
    list.push(row);
  }
  if (list.length === 0) return undefined;

  const categ = String(categoriaCombinacaoVeicular ?? '')
    .replace(/\D/g, '')
    .padStart(2, '0')
    .slice(0, 2);
  const out: Record<string, unknown> = { dispositivos_vale_pedagio: list };
  if (categ.length === 2 && categ !== '00') {
    out.categoria_combinacao_veicular = categ;
  } else {
    warnings.push(
      'categoria_combinacao_veicular ausente — SEFAZ 731 exige categ quando há vale-pedágio'
    );
  }
  return out;
}

function rntrcPropSefaz(raw: string | null | undefined): string | null {
  const n = normalizeRntrcSefaz(raw);
  if (/^[0-9]{8}$/.test(n)) return n;
  return null;
}

/**
 * Campos do proprietário do veículo de tração, no formato FLAT do
 * modal_rodoviário Focus (sufixo `_proprietario_veiculo`).
 * Só emite grupo se houver CPF/CNPJ + RNTRC 8 dígitos — RNTRC vazio → SEFAZ
 * rejeita pattern `[0-9]{8}`. Sem RNTRC válido → {} (trata como frota própria).
 */
function buildProprietarioFields(
  prop: MdfeProprietario | undefined,
  warnings: string[]
): Record<string, unknown> {
  if (!prop) return {};
  const doc = digits(prop.cpf_cnpj);
  const hasDoc = doc.length === 11 || doc.length === 14;
  if (!hasDoc && !prop.rntrc) return {};

  const rntrc = rntrcPropSefaz(prop.rntrc);
  if (!rntrc) {
    warnings.push(
      `owner.rntrc ausente/inválido (raw=${prop.rntrc ?? ''}) — grupo proprietário omitido; cadastre RNTRC 8 dígitos no owner do veículo`
    );
    return {};
  }

  const docField =
    doc.length === 14
      ? { cnpj_proprietario_veiculo: doc }
      : doc.length === 11
        ? { cpf_proprietario_veiculo: doc }
        : {};

  // Ordem do grupo `prop` (XSD MDF-e): CPF|CNPJ, RNTRC, xNome, IE?, tpProp.
  return {
    ...docField,
    rntrc_proprietario_veiculo: rntrc,
    razao_social_proprietario_veiculo: prop.nome ?? '',
    ...(prop.ie ? { inscricao_estadual_proprietario_veiculo: prop.ie } : {}),
    tipo_proprietario_veiculo: prop.tipo_proprietario ?? 2,
  };
}

function uniqByCode<T extends { codigo: number }>(arr: T[]): T[] {
  const seen = new Set<number>();
  return arr.filter((x) => (seen.has(x.codigo) ? false : (seen.add(x.codigo), true)));
}

export function mdfeRefAmbienteTag(ambiente: 'homolog' | 'prod' | string): 'H' | 'P' {
  return ambiente === 'prod' ? 'P' : 'H';
}

export function buildMdfeRef(
  serie: number,
  numero: number,
  retry = 0,
  ambiente: 'homolog' | 'prod' = 'homolog'
): string {
  const tag = mdfeRefAmbienteTag(ambiente);
  const base = `CFN-MDFE-${tag}-${serie}-${numero}`;
  return retry > 0 ? `${base}-r${retry}` : base;
}

/**
 * SEFAZ 456: todos cMunCarrega devem pertencer a UFIni.
 * Com CT-es de origens em UFs distintas, escolhe a UF majoritária (empate: ordem
 * alfabética) e filtra o grupo de carregamento.
 */
export function resolveMdfeUfInicioECarregamentos(
  ctes: Array<{ uf_origem?: string }>,
  municipios: MunicipioCarregamento[],
  overrideUf?: string | null
): { ufInicio: string; municipios: MunicipioCarregamento[]; omitted: MunicipioCarregamento[] } {
  const override = String(overrideUf ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

  const counts = new Map<string, number>();
  for (const c of ctes) {
    const uf = String(c.uf_origem ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    if (uf.length === 2) counts.set(uf, (counts.get(uf) ?? 0) + 1);
  }
  for (const m of municipios) {
    const uf = String(m.uf ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    if (uf.length === 2 && !counts.has(uf)) counts.set(uf, 0);
  }

  let ufInicio = override;
  if (ufInicio.length !== 2) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    ufInicio =
      ranked[0]?.[0] ||
      String(municipios[0]?.uf ?? '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2);
  }

  const kept: MunicipioCarregamento[] = [];
  const omitted: MunicipioCarregamento[] = [];
  for (const m of municipios) {
    const uf = String(m.uf ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
    if (!uf || uf === ufInicio) kept.push({ ...m, uf: uf || ufInicio });
    else omitted.push(m);
  }

  return { ufInicio, municipios: kept, omitted };
}

export function buildMdfePayload(input: BuildMdfeInput): BuildMdfeResult {
  const { ctes, vehicle, driver, serie, numero, vectra } = input;
  const warnings: string[] = [];

  if (ctes.length === 0) throw new Error('[mdfe-mapper] at least 1 CT-e required');

  // UFIni/UFFim = rota da carga (CT-e), NÃO a UF do emitente.
  // SEFAZ 456: cMunCarrega deve pertencer à UFIni (ex.: Fortaleza/CE ≠ uf_inicio=SC).
  const resolved = resolveMdfeUfInicioECarregamentos(
    ctes,
    uniqByCode(input.municipiosCarregamento),
    input.ufInicio
  );
  const ufInicio = resolved.ufInicio;
  const municipiosCarregamento = resolved.municipios;
  if (resolved.omitted.length > 0) {
    warnings.push(
      `SEFAZ 456: uf_inicio=${ufInicio}; omitidos carregamentos fora da UF: ${resolved.omitted
        .map((m) => `${cleanMunicipioNome(m.nome)}(${m.uf})`)
        .join(', ')}`
    );
  }
  const ufFim = String(ctes[ctes.length - 1]?.uf_destino || ufInicio)
    .toUpperCase()
    .slice(0, 2);

  // infMunDescarga groups CT-es by destination município
  const grupos = new Map<number, { nome: string; uf: string; ctes: CteRowForMdfe[] }>();
  for (const c of ctes) {
    const g = grupos.get(c.municipio_destino_ibge);
    if (g) g.ctes.push(c);
    else
      grupos.set(c.municipio_destino_ibge, {
        nome: c.municipio_destino_nome,
        uf: c.uf_destino,
        ctes: [c],
      });
  }

  const municipios_descarregamento = Array.from(grupos.entries()).map(([codigo, g]) => ({
    codigo,
    nome: cleanMunicipioNome(g.nome),
    // Focus NFe: a lista de CT-es por município é `conhecimentos_transporte`
    // (não `documentos`); sem isso SEFAZ rejeita 616 (município sem documento).
    // chave_cte = só os 44 dígitos (a coluna guarda com prefixo "CTe..." → 47
    // chars; SEFAZ rejeita por maxLength/pattern). `digits` remove o prefixo.
    conhecimentos_transporte: g.ctes.map((c) => ({ chave_cte: digits(c.chave_cte) })),
  }));

  // Totalizadores
  const vCarga = ctes.reduce((sum, c) => sum + c.valor_carga, 0);
  const pesoBruto = ctes.reduce((sum, c) => sum + c.peso_kg, 0);

  if (municipiosCarregamento.length === 0)
    warnings.push('municipiosCarregamento empty — SEFAZ requires at least 1');

  // Motorista
  const cpfMotorista = digits(driver.cpf);
  if (cpfMotorista.length !== 11)
    warnings.push('driver.cpf invalid — required for MDF-e modal rodoviário');

  // Vehicle critical
  if (!vehicle.tara_kg) warnings.push('vehicle.tara_kg missing — required by SEFAZ');
  if (!vehicle.tipo_rodado)
    warnings.push('vehicle.tipo_rodado missing — required by SEFAZ (01-06)');
  if (!vehicle.tipo_carroceria)
    warnings.push('vehicle.tipo_carroceria missing — required by SEFAZ (00-05)');

  const ref = buildMdfeRef(serie, numero, Number(input.retry ?? 0), input.ambiente ?? 'homolog');

  const propFields = buildProprietarioFields(input.proprietario, warnings);
  // Contratante só quando grupo prop realmente vai no payload (RNTRC 8 dígitos).
  const isTerceiro = Object.keys(propFields).length > 0;
  // SEFAZ 743: CPF no prop → tpTransp=TAC(2). CNPJ → ETC(1). Sem prop → omite (745).
  const propDoc = digits(input.proprietario?.cpf_cnpj);
  const tipoTransporte = !isTerceiro
    ? undefined
    : propDoc.length === 11
      ? 2 // TAC
      : 1; // ETC (PJ)

  if (!ufInicio || ufInicio.length !== 2) {
    throw new Error(
      `[mdfe-mapper] uf_inicio inválida (${ufInicio}) — use UF do município de carregamento (CT-e)`
    );
  }
  if (!ufFim || ufFim.length !== 2) {
    throw new Error(
      `[mdfe-mapper] uf_fim inválida (${ufFim ?? ''}) — preencha destination_uf na cotação/cliente`
    );
  }
  for (const m of municipiosCarregamento) {
    if (m.uf && m.uf.toUpperCase() !== ufInicio) {
      throw new Error(
        `[mdfe-mapper] SEFAZ 456: carregamento ${m.nome} (${m.uf}) diverge de uf_inicio=${ufInicio}`
      );
    }
  }
  for (const m of municipios_descarregamento) {
    if (!m.codigo || m.codigo < 1000000) {
      throw new Error(
        `[mdfe-mapper] municipio_destino_ibge inválido (${m.codigo}) em ${m.nome} — preencha IBGE destino`
      );
    }
  }

  const payload: Record<string, unknown> = {
    // === ide ===
    emitente: 1, // 1 = Prestador serviço transporte (transportadora)
    serie,
    numero,
    // Modal é sinalizado pela presença da chave `modal_rodoviario` (Focus NFe),
    // não por um campo `modal` numérico — ver bloco abaixo.
    // Horário local Brasil (UTC-3 fixo). UTC puro → SEFAZ rejeita 212. Ver cte-mapper.
    data_emissao: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 19) + '-03:00',
    uf_inicio: ufInicio,
    uf_fim: ufFim,
    // tpTransp (`tipo_transporte`): 1=ETC, 2=TAC, 3=CTC.
    // SEFAZ 745: omitir sem prop. SEFAZ 743: CPF prop → TAC(2); CNPJ → ETC(1).
    ...(tipoTransporte != null ? { tipo_transporte: tipoTransporte } : {}),
    ...(input.percursoUfs && input.percursoUfs.length > 0
      ? { percursos: input.percursoUfs.map((uf_percurso) => ({ uf_percurso })) }
      : {}),

    // === emitente ===
    cnpj_emitente: vectra.cnpj,
    inscricao_estadual_emitente: vectra.ie,
    nome_emitente: vectra.nome,
    nome_fantasia_emitente: vectra.fantasia,
    logradouro_emitente: vectra.logradouro,
    numero_emitente: vectra.numero,
    ...(vectra.complemento ? { complemento_emitente: vectra.complemento } : {}),
    bairro_emitente: vectra.bairro,
    codigo_municipio_emitente: vectra.ibge,
    municipio_emitente: vectra.municipio,
    cep_emitente: vectra.cep,
    uf_emitente: vectra.uf,

    // === modal rodoviário ===
    // Focus NFe: bloco do modal vai sob a chave `modal_rodoviario`, com campos
    // FLAT (sufixo `_veiculo`). Sem esse wrapper → erro
    // `parametros_modal_nao_informados`.
    modal_rodoviario: {
      registro_nacional_transporte: normalizeRntrcSefaz(vectra.rntrc), // SEFAZ: 8 dígitos | ISENTO
      placa_veiculo: vehicle.plate.toUpperCase(),
      renavam_veiculo: digits(vehicle.renavam),
      tara_veiculo: vehicle.tara_kg ?? 0,
      capacidade_kg_veiculo: vehicle.capacity_kg ?? 0,
      ...(vehicle.capacity_m3 ? { capacidade_m3_veiculo: vehicle.capacity_m3 } : {}),
      tipo_rodado_veiculo: vehicle.tipo_rodado ?? '02', // 02 = Toco fallback
      tipo_carroceria_veiculo: vehicle.tipo_carroceria ?? '02', // 02 = Fechada/Baú fallback
      uf_licenciamento_veiculo: vehicle.uf_licenciamento ?? vectra.uf,
      condutores: [
        {
          nome: driver.name,
          cpf: cpfMotorista,
        },
      ],
      // Proprietário (terceiro/TAC) — só com RNTRC 8 dígitos; senão frota própria.
      ...propFields,
      // Pagamento frete (SEFAZ 302 lotação / 303 TAC) — Focus pagamentos[]
      ...(() => {
        const pags = buildMdfePagamentos(input.proprietario, input.pagamento, warnings);
        return pags && pags.length > 0 ? { pagamentos: pags } : {};
      })(),
      // CIOT (SEFAZ 304) — AILOG/WebRouter (mesma chave rota/VPO)
      ...(() => {
        const seen = new Set<string>();
        const list = (input.ciots ?? [])
          .map((c) => {
            const n = String(c.ciot ?? '').replace(/\D/g, '');
            if (n.length < 8) return null;
            const cnpj = digits(c.cnpjResponsavel);
            const cpf = digits(c.cpfResponsavel);
            const row: Record<string, unknown> = { ciot: n.slice(0, 12) };
            if (cnpj.length === 14) row.cnpj_responsavel = cnpj;
            else if (cpf.length === 11) row.cpf_responsavel = cpf;
            else return null;
            const key = `${row.ciot}|${row.cnpj_responsavel ?? ''}|${row.cpf_responsavel ?? ''}`;
            if (seen.has(key)) return null;
            seen.add(key);
            return row;
          })
          .filter(Boolean);
        if (list.length === 0) {
          if (isTerceiro) {
            warnings.push(
              'ciot ausente — TAC/terceiro: gere CIOT AILOG (WebRouter) antes do MDF-e (SEFAZ 304)'
            );
          }
          return {};
        }
        return { ciot: list };
      })(),
      // Vale-Pedágio (Focus dispositivos_vale_pedagio) — próprio ou parceiro
      ...(() => {
        // Dedupe por IDVPO+fornecedora+pagador (OS irmãs na mesma viagem)
        const raw = input.dispositivosValePedagio ?? [];
        const seen = new Set<string>();
        const unique = raw.filter((d) => {
          const key = [
            String(d.numeroComprovante ?? '').replace(/\D/g, ''),
            digits(d.cnpjFornecedora),
            digits(d.cnpjPagador),
            digits(d.cpfPagador),
          ].join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const built = buildMdfeDispositivosValePedagio(
          unique,
          input.categoriaCombinacaoVeicular,
          warnings
        );
        return built ?? {};
      })(),
      // Contratante: SEFAZ 578 exige ≥1. SEFAZ 741: com prop do veículo,
      // contratante DEVE = emitente (Vectra). Sem prop → tomador/shipper OK.
      contratantes: [
        (() => {
          if (isTerceiro) {
            return { nome: vectra.nome.slice(0, 60), cnpj: digits(vectra.cnpj) };
          }
          const c = input.contratante;
          const cnpj = digits(c?.cnpj);
          const cpf = digits(c?.cpf);
          if (cnpj.length === 14) {
            return { nome: (c?.nome || vectra.nome).slice(0, 60), cnpj };
          }
          if (cpf.length === 11) {
            return { nome: (c?.nome || vectra.nome).slice(0, 60), cpf };
          }
          return { nome: vectra.nome.slice(0, 60), cnpj: digits(vectra.cnpj) };
        })(),
      ],
      ...(vehicle.plate_2
        ? {
            veiculos_reboque: [
              {
                placa: vehicle.plate_2.toUpperCase(),
                tara: vehicle.reboque_tara_kg ?? 0,
                capacidade_kg: vehicle.reboque_capacity_kg ?? 0,
                tipo_carroceria: vehicle.reboque_tipo_carroceria ?? '02',
                uf_licenciamento: vehicle.reboque_uf_licenciamento ?? vectra.uf,
              },
            ],
          }
        : {}),
    },

    // === municípios carregamento ===
    municipios_carregamento: municipiosCarregamento.map((m) => ({
      codigo: m.codigo,
      nome: cleanMunicipioNome(m.nome),
    })),

    // === documentos vinculados (CT-es agrupados por município descarga) ===
    municipios_descarregamento,

    // === totalizadores (tot) — chaves FLAT no root (Focus NFe) ===
    quantidade_total_cte: ctes.length,
    valor_total_carga: Number(vCarga.toFixed(2)),
    peso_bruto: Number(pesoBruto.toFixed(3)),
    codigo_unidade_medida_peso_bruto: '01', // 01 = KG, 02 = TON

    // === produto predominante (prodPred) — chaves FLAT no root ===
    tipo_carga: input.produtoPredominante?.tipoCarga ?? '05', // 05 = Carga Geral (obrigatório)
    descricao_produto: input.produtoPredominante?.descricao ?? 'CARGA GERAL',
    ...(input.produtoPredominante?.ncm
      ? { codigo_ncm_produto: digits(input.produtoPredominante.ncm).slice(0, 8) }
      : {}),
    ...(input.produtoPredominante?.cean
      ? { codigo_barras_produto: input.produtoPredominante.cean }
      : {}),

    // === infLotacao (SEFAZ 726) — CEP carrega/descarrega quando 1 DF-e ===
    ...(() => {
      const cepCar = digits(input.cepCarregamento).slice(0, 8);
      const cepDes = digits(input.cepDescarregamento).slice(0, 8);
      const needsLotacao = ctes.length === 1;
      if (needsLotacao && cepCar.length === 8 && cepDes.length === 8) {
        return { cep_carregamento: cepCar, cep_descarregamento: cepDes };
      }
      if (needsLotacao) {
        warnings.push(
          'infLotacao ausente (1 CT-e) — informe CEPs origem/destino na cotação (SEFAZ 726)'
        );
      }
      return {};
    })(),

    // === seguro da carga (RCTR-C / RC-DC) ===
    ...(input.seguros && input.seguros.length > 0 ? { seguros_carga: input.seguros } : {}),

    // Focus MDF-e: a obs do contribuinte é `informacao_complementar` (tag infCpl) —
    // diferente do CT-e (`informacoes_adicionais_contribuinte`).
    informacao_complementar: `MDF-e CFN — ${ctes.length} CT-e(s) agregados`,
  };
  if (!input.seguros || input.seguros.length === 0)
    warnings.push('seguros vazio — MDF-e sem apólice (RCTR-C/RC-DC). Verificar risk_policies.');

  return { ref, payload, warnings };
}

/**
 * Payload for MDF-e encerramento (após descarga).
 */
export interface EncerrarMdfeInput {
  protocolo: string; // protocolo da autorização do MDF-e
  uf: string; // UF onde foi encerrado
  municipio_descarga_ibge: number;
}

export function buildEncerramentoPayload(
  input: EncerrarMdfeInput & { nome_municipio: string }
): Record<string, unknown> {
  return {
    data: new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10),
    sigla_uf: input.uf,
    nome_municipio: input.nome_municipio,
  };
}
