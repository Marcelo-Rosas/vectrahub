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

/** dd/MM/yyyy HH:mm:ss */
export function formatBrDateTime(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** dd/MM/yyyy HH:mm */
export function formatBrDateMinute(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  const payload = {
    emissor: input.emissor,
    tipoTag: input.tipoTag || 'INDEFINIDO',
    dataInicio: formatBrDateTime(input.dataInicio),
    dataFim: formatBrDateTime(input.dataFim),
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

export { VPO_EMISSORES };
