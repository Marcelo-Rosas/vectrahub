/**
 * WebRouter / AILOG Bank — CIOT REST (módulo Emitir CIOT, gratuito).
 * Mesma chave `WEBROUTER_API_KEY` do cálculo de rota e do vale-pedágio.
 *
 * Docs: https://suporte.ailog.com.br/kb/pt-br/article/354860/emitir-ciot-requisicao-de-entrada
 * Prod:  https://way.webrouter.com.br/AilogBankService/api/ciot/*
 * Homolog: https://way-hml.webrouter.com.br/AilogBankService/api/ciot/*
 */

export type AilogCiotAmbiente = 'homologacao' | 'producao';

export type AilogCidade = {
  pais: string;
  uf: string;
  cidade: string;
  codigoIbge: number | string;
  label?: string;
};

export type AilogEndereco = {
  cidade: AilogCidade;
  logradouro: string;
  numero: string;
  complemento?: string;
  cep: string;
  bairro: string;
  latLng: { latitude: number; longitude: number };
};

export type AilogCiotEmitInput = {
  tipoViagem: 1 | 3;
  codigoCliente: string;
  veiculos: Array<{ placa: string; rntrc: string }>;
  documentoContratado: string;
  rntrcContratado: string;
  nomeContratado: string;
  documentoContratante: string;
  rntrcContratante: string;
  nomeContratante: string;
  enderecoContratante: AilogEndereco;
  documentoDestinatario: string;
  nomeDestinatario: string;
  rntrcDestinatario?: string;
  enderecoDestinatario: AilogEndereco;
  codigoNaturezaCarga?: string;
  cidadeOrigem: AilogCidade;
  cepOrigem: string;
  cidadeDestino: AilogCidade;
  cepDestino: string;
  dataInicioViagem: string;
  dataFimViagem: string;
  distanciaPercorrida: number;
  valorFrete: number;
  valorPedagio?: number;
  pesoCarga: number;
  tipoPagamento?: string;
  codigoBanco?: string;
  agencia?: string;
  numeroConta?: string;
  cpfProprietarioConta?: string;
};

export type AilogCiotResult = {
  ok: boolean;
  ciotNumber?: string;
  protocolo?: string;
  message?: string;
  raw?: Record<string, unknown>;
};

function getEnv(key: string): string | undefined {
  try {
    const deno = globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } };
    if (typeof deno.Deno?.env?.get === 'function') return deno.Deno.env.get(key);
  } catch {
    // ignore
  }
  return undefined;
}

export function digits(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function formatPlateForCiot(plate: string): string {
  return String(plate || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 7);
}

export function formatCepBr(cep: string): string {
  const d = digits(cep).slice(0, 8);
  if (d.length !== 8) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** dd/MM/yyyy */
export function formatCiotDate(d: Date): string {
  const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const year = shifted.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function parseCityUfLabel(label: string): { cidade: string; uf: string } {
  const m = String(label ?? '').match(/^(.+?)\s*[-,]\s*([A-Za-z]{2})\s*$/);
  if (m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: String(label ?? '').trim(), uf: '' };
}

export function ailogCidade(opts: {
  cidade: string;
  uf: string;
  ibge?: number | string | null;
}): AilogCidade {
  const uf = String(opts.uf || '')
    .toUpperCase()
    .slice(0, 2);
  const cidade = String(opts.cidade || '').trim();
  return {
    pais: 'Brasil',
    uf,
    cidade,
    codigoIbge: Number(opts.ibge) || 0,
    label: cidade && uf ? `${cidade}, ${uf}` : cidade,
  };
}

export function ailogCiotBaseUrl(ambiente: AilogCiotAmbiente): string {
  const override = getEnv('AILOG_CIOT_BASE_URL');
  if (override) return override.replace(/\/$/, '');
  return ambiente === 'producao'
    ? 'https://way.webrouter.com.br/AilogBankService'
    : 'https://way-hml.webrouter.com.br/AilogBankService';
}

export function resolveAilogCiotAmbiente(): AilogCiotAmbiente {
  const explicit = (getEnv('CIOT_AMBIENTE') || '').toLowerCase();
  if (explicit === 'producao' || explicit === 'prod') return 'producao';
  if (explicit === 'homologacao' || explicit === 'homolog') return 'homologacao';
  const focus = (getEnv('FOCUS_NFE_AMBIENTE') || '').toLowerCase();
  if (focus === 'producao' || focus === 'production') return 'producao';
  return 'homologacao';
}

export function parseAilogCiotResponse(json: unknown): AilogCiotResult {
  const obj = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const nested =
    obj.resultado && typeof obj.resultado === 'object'
      ? (obj.resultado as Record<string, unknown>)
      : obj;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = nested[k] ?? obj[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  const ciot = digits(pick('numeroCiot', 'numero_ciot', 'ciot', 'CIOT')).slice(0, 16);
  const protocolo = pick('numeroProtocoloCiot', 'protocolo', 'numeroProtocolo');
  const mensagem = pick('mensagem', 'message', 'erro', 'error');
  const status = pick('status', 'situacao').toUpperCase();
  const failed =
    status.includes('ERRO') || status.includes('FALHA') || /erro|fail|invalid/i.test(mensagem);
  if (ciot && !failed) {
    return { ok: true, ciotNumber: ciot, protocolo: protocolo || undefined, raw: obj };
  }
  if (protocolo && !failed && !mensagem) {
    return { ok: true, protocolo, raw: obj };
  }
  return {
    ok: false,
    ciotNumber: ciot || undefined,
    protocolo: protocolo || undefined,
    message: mensagem || 'AILOG CIOT sem número na resposta',
    raw: obj,
  };
}

export function buildAilogEmitBody(input: AilogCiotEmitInput): Record<string, unknown> {
  return {
    tipoViagem: input.tipoViagem,
    codigoCliente: input.codigoCliente,
    veiculos: input.veiculos.map((v) => ({
      placa: formatPlateForCiot(v.placa),
      rntrc: digits(v.rntrc),
    })),
    documentoContratado: digits(input.documentoContratado),
    rntrcContratado: digits(input.rntrcContratado),
    nomeContratado: input.nomeContratado,
    documentoContratante: digits(input.documentoContratante),
    rntrcContratante: digits(input.rntrcContratante),
    nomeContratante: input.nomeContratante,
    enderecoContratante: input.enderecoContratante,
    documentoDestinatario: digits(input.documentoDestinatario),
    nomeDestinatario: input.nomeDestinatario,
    rntrcDestinatario: digits(input.rntrcDestinatario || ''),
    enderecoDestinatario: input.enderecoDestinatario,
    codigoNaturezaCarga: input.codigoNaturezaCarga || '0001',
    cidadeOrigem: input.cidadeOrigem,
    cepOrigem: formatCepBr(input.cepOrigem),
    cidadeDestino: input.cidadeDestino,
    cepDestino: formatCepBr(input.cepDestino),
    cepRetorno: '',
    distanciaRetorno: 0,
    freteRetorno: false,
    dataInicioViagem: input.dataInicioViagem,
    dataFimViagem: input.dataFimViagem,
    distanciaPercorrida: Number(input.distanciaPercorrida) || 0,
    veiculoAltoDesempenho: false,
    valorFrete: Number(input.valorFrete) || 0,
    valorPedagio: Number(input.valorPedagio) || 0,
    valorCombustivel: 0,
    valorTarifas: 0,
    valorImpostos: 0,
    quantidadeTarifas: 0,
    pesoCarga: Number(input.pesoCarga) || 0,
    tipoPagamento: input.tipoPagamento || 'OUTROS',
    codigoBanco: input.codigoBanco || '',
    agencia: input.agencia || '',
    numeroConta: input.numeroConta || '',
    cpfProprietarioConta: digits(input.cpfProprietarioConta || ''),
  };
}

async function ailogPost(
  path: string,
  body: unknown,
  ambiente: AilogCiotAmbiente
): Promise<{
  status: number;
  json: unknown;
}> {
  const apiKey = getEnv('WEBROUTER_API_KEY');
  if (!apiKey) throw new Error('WEBROUTER_API_KEY not configured');
  const url = `${ailogCiotBaseUrl(ambiente)}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      chaveAcesso: apiKey,
      'User-Agent': 'vectra-hub/ciot-ailog',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `AILOG CIOT ${path} resposta inválida (HTTP ${res.status}): ${text.slice(0, 180)}`
    );
  }
  return { status: res.status, json };
}

export async function emitirCiotAilog(
  input: AilogCiotEmitInput,
  ambiente: AilogCiotAmbiente = resolveAilogCiotAmbiente()
): Promise<AilogCiotResult> {
  const { status, json } = await ailogPost('/api/ciot/emitir', buildAilogEmitBody(input), ambiente);
  const parsed = parseAilogCiotResponse(json);
  if (status >= 400 && parsed.ok) {
    return { ...parsed, ok: false, message: parsed.message || `AILOG HTTP ${status}` };
  }
  if (status >= 400) {
    return {
      ok: false,
      message: parsed.message || `AILOG CIOT HTTP ${status}`,
      raw: parsed.raw,
    };
  }
  return parsed;
}

export async function cancelarCiotAilog(opts: {
  numeroProtocoloCiot: string;
  motivo: string;
  ambiente?: AilogCiotAmbiente;
}): Promise<AilogCiotResult> {
  const ambiente = opts.ambiente ?? resolveAilogCiotAmbiente();
  const { status, json } = await ailogPost(
    '/api/ciot/cancelar',
    { numeroProtocoloCiot: opts.numeroProtocoloCiot, motivo: opts.motivo },
    ambiente
  );
  const parsed = parseAilogCiotResponse(json);
  if (status >= 400) {
    return {
      ok: false,
      message: parsed.message || `AILOG cancelar HTTP ${status}`,
      raw: parsed.raw,
    };
  }
  return { ...parsed, ok: parsed.ok || status < 300 };
}
