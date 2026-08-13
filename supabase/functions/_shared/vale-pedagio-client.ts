/**
 * WebRouter Vale Pedágio (AILOG) — consultarVeiculo + criarViagem.
 * Base: https://way.webrouter.com.br/valepedagio
 */

import { axesToCategoriaVeiculo, type TollPlaza } from './webrouter-client.ts';

const VPO_BASE = 'https://way.webrouter.com.br/valepedagio';
const VPO_EMISSORES = ['SEMPARAR', 'CONECTCAR', 'VELOE', 'MOVEMAIS', 'REPOM'] as const;
export type VpoEmissorCodigo = (typeof VPO_EMISSORES)[number];

function getEnv(key: string): string | undefined {
  try {
    const deno = globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } };
    if (typeof deno.Deno?.env?.get === 'function') return deno.Deno.env.get(key);
  } catch {
    // ignore
  }
  return undefined;
}

function digits(v: string | null | undefined): string {
  return String(v ?? '').replace(/\D/g, '');
}

/** SemParar recusa hífen (QJL-1771 → PLACA_INVALIDA). Só alfanumérico. */
export function formatPlateForVpo(plate: string): string {
  return String(plate || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** America/Sao_Paulo wall clock (UTC-3, sem DST). Deno Edge = UTC. */
function spParts(d: Date): {
  y: number;
  m: number;
  day: number;
  h: number;
  min: number;
  s: number;
} {
  const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    h: shifted.getUTCHours(),
    min: shifted.getUTCMinutes(),
    s: shifted.getUTCSeconds(),
  };
}

/** dd/MM/yyyy HH:mm:ss (horário Brasília) */
export function formatBrDateTime(d: Date): string {
  const p = spParts(d);
  return `${pad2(p.day)}/${pad2(p.m)}/${p.y} ${pad2(p.h)}:${pad2(p.min)}:${pad2(p.s)}`;
}

/** dd/MM/yyyy HH:mm (horário Brasília) */
export function formatBrDateMinute(d: Date): string {
  const p = spParts(d);
  return `${pad2(p.day)}/${pad2(p.m)}/${p.y} ${pad2(p.h)}:${pad2(p.min)}`;
}

/** SemParar recusa dataInicio no passado (DATA_INVALIDA). */
export function resolveVpoViagemWindow(opts: {
  pickup?: Date | null;
  eta?: Date | null;
  now?: Date;
}): { inicio: Date; fim: Date } {
  const now = opts.now ?? new Date();
  const startFloor = new Date(now.getTime() + 2 * 60 * 1000);
  let inicio =
    opts.pickup && !Number.isNaN(opts.pickup.getTime())
      ? new Date(opts.pickup.getTime())
      : new Date(startFloor);
  if (inicio.getTime() < startFloor.getTime()) inicio = new Date(startFloor);

  let fim =
    opts.eta && !Number.isNaN(opts.eta.getTime())
      ? new Date(opts.eta.getTime())
      : new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (fim.getTime() <= inicio.getTime() + 60 * 60 * 1000) {
    fim = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return { inicio, fim };
}

export function interpolatePassagem(start: Date, end: Date, index: number, total: number): string {
  if (total <= 1) return formatBrDateMinute(start);
  const t = Math.min(1, Math.max(0, index / Math.max(1, total - 1)));
  return formatBrDateMinute(new Date(start.getTime() + t * (end.getTime() - start.getTime())));
}

export type ConsultarVeiculoResult = {
  emissor: string;
  id: string | null;
  tag: string | null;
  placa: string | null;
  status: string;
  ativo: boolean;
  quantidadeEixos: number;
  nomeProprietario: string | null;
  descricao: string | null;
  idCategoria: string | null;
  mensagemErro: string | null;
};

export type CriarViagemResult = {
  status: string;
  mensagem: string | null;
  idViagemAILog: number;
  idViagemOSA: number;
  codigoViagem: string | null;
  placaVeiculo: string | null;
  numeroTag: string | null;
  idANTT: string | null;
  codigoCliente: string | null;
};

/** Recibo de compra VPO — GET getReciboViagem / POST emitirReciboViagem. Sem PDF binário. */
export type ReciboViagem = {
  id: number | null;
  emissor: string | null;
  idViagemOSA: number | null;
  codigoViagemOSA: string | null;
  descricaoCategoria: string | null;
  cnpjEmissor: string | null;
  nomeEmissor: string | null;
  cnpjTransportador: string | null;
  nomeTransportador: string | null;
  dataCompra: string | null;
  dataHoraExportacao: string | null;
  dataViagem: string | null;
  urlLogo: string | null;
  nomeRota: string | null;
  status: string | null;
  tipo: string | null;
  valorTotal: number | null;
};

export function parseReciboViagem(raw: unknown): ReciboViagem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
  const recibo: ReciboViagem = {
    id: num(o.id),
    emissor: str(o.emissor),
    idViagemOSA: num(o.idViagemOSA),
    codigoViagemOSA: str(o.codigoViagemOSA),
    descricaoCategoria: str(o.descricaoCategoria),
    cnpjEmissor: str(o.cnpjEmissor),
    nomeEmissor: str(o.nomeEmissor),
    cnpjTransportador: str(o.cnpjTransportador),
    nomeTransportador: str(o.nomeTransportador),
    dataCompra: str(o.dataCompra),
    dataHoraExportacao: str(o.dataHoraExportacao),
    dataViagem: str(o.dataViagem),
    urlLogo: str(o.urlLogo),
    nomeRota: str(o.nomeRota),
    status: str(o.status),
    tipo: str(o.tipo),
    valorTotal: num(o.valorTotal),
  };
  const hasSignal =
    recibo.status != null ||
    recibo.valorTotal != null ||
    recibo.id != null ||
    recibo.codigoViagemOSA != null ||
    recibo.dataCompra != null;
  return hasSignal ? recibo : null;
}

async function vpoPost<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) throw new Error('WEBROUTER_API_KEY not configured');

  const res = await fetch(`${VPO_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      chaveAcesso: apiKey,
      'User-Agent': 'vectra-hub/vpo',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`ValePedagio ${path} resposta inválida (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json && 'mensagem' in json
        ? String((json as { mensagem?: unknown }).mensagem || '')
        : text.slice(0, 200);
    throw new Error(msg || `ValePedagio HTTP ${res.status}`);
  }
  return json as T;
}

export async function consultarVeiculo(params: {
  emissor: string;
  placa: string;
  embarcador: { documento: string; razaoSocial: string };
  transportador: { documento: string; rntrc: string; nome: string };
}): Promise<ConsultarVeiculoResult> {
  const raw = await vpoPost<ConsultarVeiculoResult>('/api/consultarVeiculo', {
    emissor: params.emissor,
    embarcador: params.embarcador,
    transportador: params.transportador,
    placa: formatPlateForVpo(params.placa),
  });
  return {
    emissor: String(raw.emissor || params.emissor),
    id: raw.id != null ? String(raw.id) : null,
    tag: raw.tag != null ? String(raw.tag) : null,
    placa: raw.placa != null ? String(raw.placa) : null,
    status: String(raw.status || ''),
    ativo: Boolean(raw.ativo),
    quantidadeEixos: Number(raw.quantidadeEixos) || 0,
    nomeProprietario: raw.nomeProprietario != null ? String(raw.nomeProprietario) : null,
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    idCategoria: raw.idCategoria != null ? String(raw.idCategoria) : null,
    mensagemErro: raw.mensagemErro != null ? String(raw.mensagemErro) : null,
  };
}

export async function consultarVeiculoEmissores(params: {
  placa: string;
  embarcador: { documento: string; razaoSocial: string };
  transportador: { documento: string; rntrc: string; nome: string };
}): Promise<{ match: ConsultarVeiculoResult | null; tentativas: string[] }> {
  const tentativas: string[] = [];
  const raw = formatPlateForVpo(params.placa);
  const hyphen = /^[A-Z]{3}\d{4}$/.test(raw) ? `${raw.slice(0, 3)}-${raw.slice(3)}` : null;
  const plates = hyphen && hyphen !== raw ? [raw, hyphen] : [raw];

  for (const placa of plates) {
    for (const emissor of VPO_EMISSORES) {
      try {
        const r = await consultarVeiculo({ ...params, emissor, placa });
        tentativas.push(`${emissor}/${placa}: ${r.status} ativo=${r.ativo}`);
        if (r.status === 'SUCESSO' && r.ativo) return { match: r, tentativas };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tentativas.push(`${emissor}/${placa}: EXC ${msg}`);
        console.warn(`[vale-pedagio] consultarVeiculo ${emissor} ${placa} failed:`, e);
      }
    }
  }
  return { match: null, tentativas };
}

export type CriarViagemInput = {
  emissor: string;
  tipoTag?: string;
  /** SemParar: ESTENDIDA | PLANEJADA | CUSTOMIZADA. Default ESTENDIDA. */
  tipoViagem?: string;
  dataInicio: Date;
  dataFim: Date;
  placa: string;
  tag: string | null;
  categoria: string;
  eixos: number;
  nomeProprietario: string;
  documentoProprietario: string;
  embarcador: { documento: string; razaoSocial: string };
  transportador: { documento: string; rntrc: string; nome: string };
  pedagios: TollPlaza[];
  enderecos: Array<{
    ordemPassagem: number;
    cidade: { pais: string; uf: string; cidade: string; codigoIbge: string };
    latLng: { latitude: number; longitude: number };
  }>;
  idRota: number | null;
  distanciaKm: number;
  codigoRota: string;
  numeroCte?: string;
};

function codigoPracaOperador(emissor: string, p: TollPlaza): string {
  if (p.codigo) return p.codigo;
  if (emissor === 'SEMPARAR') return p.idSemParar || '';
  if (emissor === 'CONECTCAR') return p.idConectcar || '';
  if (emissor === 'VELOE') return p.idVeloe || '';
  if (emissor === 'MOVEMAIS') return p.idMoveMais || '';
  if (emissor === 'REPOM') return p.idRepom || '';
  return '';
}

export async function criarViagem(input: CriarViagemInput): Promise<CriarViagemResult> {
  const categoria = input.categoria || axesToCategoriaVeiculo(input.eixos);
  const emissor = String(input.emissor || '').toUpperCase();
  const pedagios = input.pedagios
    .slice()
    .sort((a, b) => (a.ordemPassagem || 0) - (b.ordemPassagem || 0))
    .map((p, i) => ({
      ordemPassagem: p.ordemPassagem || i + 1,
      idAilog: p.idAilog || 0,
      idCNP: p.idCNP || '',
      codigo: codigoPracaOperador(emissor, p),
      nome: p.nome,
      dataPrevisaoPassagem: interpolatePassagem(
        input.dataInicio,
        input.dataFim,
        i,
        input.pedagios.length
      ),
      valorManual: Number(p.valor) || 0,
      valorTag: Number(p.valorTag) || Number(p.valor) || 0,
      numeroEixos: input.eixos,
      categoriaVeiculo: categoria,
    }));

  const placaFmt = formatPlateForVpo(input.placa);
  const tipoViagem =
    String(input.tipoViagem || 'ESTENDIDA')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '') || 'ESTENDIDA';
  const dataInicioFmt = formatBrDateTime(input.dataInicio);
  const dataFimFmt = formatBrDateTime(input.dataFim);
  const payload = {
    emissor: input.emissor,
    tipoTag: input.tipoTag || 'INDEFINIDO',
    tipoViagem,
    tipo: tipoViagem,
    dataInicio: dataInicioFmt,
    dataFim: dataFimFmt,
    dataInicioViagem: dataInicioFmt,
    dataFimViagem: dataFimFmt,
    dataExpiracao: dataFimFmt,
    emissaoAutomaticaVPO: true,
    placa: placaFmt,
    rota: {
      id: input.idRota || 0,
      indiceAlternativa: 0,
      distanciaPercorridaKM: input.distanciaKm,
      tipoCombustivel: 'DIESEL',
    },
    veiculo: {
      placa: placaFmt,
      placaPrimeiroReboque: '',
      placaSegundoReboque: '',
      categoria,
      tag: input.tag || '',
      nomeProprietario: input.nomeProprietario,
      cnpjProprietario: digits(input.documentoProprietario),
      kmLitro: 0,
      numeroDocumentoProprietario: digits(input.documentoProprietario),
    },
    embarcador: {
      documento: digits(input.embarcador.documento),
      razaoSocial: input.embarcador.razaoSocial,
    },
    informacoes: { numeroCTE: input.numeroCte || '' },
    transportador: {
      documento: digits(input.transportador.documento),
      rntrc: String(input.transportador.rntrc || '').replace(/\D/g, ''),
      nome: input.transportador.nome,
    },
    pedagios,
    enderecos: input.enderecos.map((e) => ({
      ordemPassagem: e.ordemPassagem,
      cidade: {
        pais: e.cidade.pais || 'Brasil',
        uf: e.cidade.uf,
        cidade: e.cidade.cidade,
        codigoIbge: e.cidade.codigoIbge || '',
      },
      latLng: {
        latitude: e.latLng.latitude || 0,
        longitude: e.latLng.longitude || 0,
      },
    })),
    codigo: input.codigoRota,
    observacoes: `VPO OS ${input.codigoRota}`,
    codigoRota: input.codigoRota,
  };

  const raw = await vpoPost<CriarViagemResult>('/api/criarViagem', payload);
  return {
    status: String(raw.status || ''),
    mensagem: raw.mensagem != null ? String(raw.mensagem) : null,
    idViagemAILog: Number(raw.idViagemAILog) || 0,
    idViagemOSA: Number(raw.idViagemOSA) || 0,
    codigoViagem: raw.codigoViagem != null ? String(raw.codigoViagem) : null,
    placaVeiculo: raw.placaVeiculo != null ? String(raw.placaVeiculo) : null,
    numeroTag: raw.numeroTag != null ? String(raw.numeroTag) : null,
    idANTT: raw.idANTT != null && String(raw.idANTT).trim() ? String(raw.idANTT).trim() : null,
    codigoCliente: raw.codigoCliente != null ? String(raw.codigoCliente) : null,
  };
}

export async function getReciboViagem(idViagemAILog: number): Promise<ReciboViagem | null> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) throw new Error('WEBROUTER_API_KEY not configured');
  if (!idViagemAILog) throw new Error('idViagemAILog obrigatório');

  const res = await fetch(`${VPO_BASE}/api/getReciboViagem/${idViagemAILog}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      chaveAcesso: apiKey,
      'User-Agent': 'vectra-hub/vpo',
    },
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`ValePedagio getReciboViagem resposta inválida (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json && 'mensagem' in json
        ? String((json as { mensagem?: unknown }).mensagem || '')
        : text.slice(0, 200);
    throw new Error(msg || `ValePedagio getReciboViagem HTTP ${res.status}`);
  }
  return parseReciboViagem(json);
}

export async function emitirReciboViagem(params: {
  emissor: string;
  idViagem: number;
  idViagemAILog: number;
  embarcador: { documento: string; razaoSocial: string };
}): Promise<ReciboViagem | null> {
  const raw = await vpoPost<unknown>('/api/emitirReciboViagem', {
    emissor: params.emissor,
    idViagem: params.idViagem,
    idViagemAILog: params.idViagemAILog,
    embarcador: {
      documento: digits(params.embarcador.documento),
      razaoSocial: params.embarcador.razaoSocial,
    },
  });
  return parseReciboViagem(raw);
}

export { VPO_EMISSORES };
