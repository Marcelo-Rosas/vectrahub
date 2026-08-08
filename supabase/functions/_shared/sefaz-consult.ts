/**
 * Consulta situação de NF-e / CT-e / MDF-e na SEFAZ.
 *
 * Providers (ordem de prioridade):
 * 1. SEFAZ_PROXY_URL — proxy local/cloud com certificado A1 (SOAP oficial)
 * 2. FOCUS_NFE_TOKEN — API Focus NFe (nfes_recebidas / ctes_recebidas)
 */

export interface SefazConsultMetadata {
  c_stat: string;
  x_motivo: string;
  protocolo?: string | null;
  data_autorizacao?: string | null;
  source: 'proxy' | 'focus';
  consulted_at: string;
  emitente_cnpj?: string | null;
  emitente_nome?: string | null;
  destinatario_cnpj?: string | null;
  destinatario_nome?: string | null;
}

export interface SefazConsultResult {
  ok: boolean;
  chave: string;
  document_type: 'nfe' | 'cte' | 'mdfe' | 'unknown';
  metadata?: SefazConsultMetadata;
  error?: string;
  http_status?: number;
}

const FOCUS_BASE = 'https://api.focusnfe.com.br/v2';
const DEFAULT_TIMEOUT_MS = 25_000;

const MODELO_TYPE: Record<string, SefazConsultResult['document_type']> = {
  '55': 'nfe',
  '57': 'cte',
  '58': 'mdfe',
  '65': 'nfe',
};

function modelFromChave(chave: string): string {
  return chave.replace(/\D/g, '').substring(20, 22);
}

function documentTypeFromChave(chave: string): SefazConsultResult['document_type'] {
  return MODELO_TYPE[modelFromChave(chave)] ?? 'unknown';
}

function mapCStatToValidationStatus(
  cStat: string
): 'sefaz_authorized' | 'sefaz_cancelled' | 'invalid' | 'pending' {
  if (cStat === '100') return 'sefaz_authorized';
  if (cStat === '101' || cStat === '135' || cStat === '151' || cStat === '155')
    return 'sefaz_cancelled';
  if (cStat === '110' || cStat === '301' || cStat === '302') return 'invalid';
  if (cStat === '217' || cStat === '236') return 'pending';
  return 'invalid';
}

export function mapSefazStatusToValidationStatus(
  cStat: string
): ReturnType<typeof mapCStatToValidationStatus> {
  return mapCStatToValidationStatus(cStat);
}

function parseXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
  const m = xml.match(re);
  return m?.[1]?.trim() ?? null;
}

function mapFocusSituacao(situacao: string | null | undefined): {
  c_stat: string;
  x_motivo: string;
} {
  const s = (situacao ?? '').toLowerCase();
  if (s.includes('autoriz'))
    return { c_stat: '100', x_motivo: 'Autorizado o uso do documento (Focus)' };
  if (s.includes('cancel')) return { c_stat: '101', x_motivo: 'Cancelamento homologado (Focus)' };
  if (s.includes('deneg')) return { c_stat: '110', x_motivo: 'Uso denegado (Focus)' };
  return {
    c_stat: '000',
    x_motivo: situacao ? `Situação Focus: ${situacao}` : 'Situação desconhecida (Focus)',
  };
}

async function consultViaProxy(
  chave: string,
  proxyUrl: string,
  secret: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SefazConsultResult> {
  const base = proxyUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/v1/consult`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sefaz-Proxy-Secret': secret,
      },
      body: JSON.stringify({ chave }),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail =
        typeof body?.error === 'string'
          ? body.error
          : typeof body?.message === 'string'
            ? body.message
            : '';
      // Cloudflare 530 = origin unreachable (proxy Worker up, SEFAZ/cert host down)
      const base =
        res.status === 530
          ? 'Proxy SEFAZ HTTP 530 (origem do proxy inacessível)'
          : `Proxy SEFAZ HTTP ${res.status}`;
      return {
        ok: false,
        chave,
        document_type: documentTypeFromChave(chave),
        error: detail ? `${base}: ${detail}` : base,
        http_status: res.status,
      };
    }

    const cStat = String(body.status_sefaz ?? body.c_stat ?? '');
    return {
      ok: cStat === '100',
      chave,
      document_type:
        (body.tipo as SefazConsultResult['document_type']) ?? documentTypeFromChave(chave),
      metadata: {
        c_stat: cStat,
        x_motivo: String(body.status_descricao ?? body.x_motivo ?? ''),
        protocolo: body.protocolo ?? null,
        data_autorizacao: body.data_autorizacao ?? null,
        source: 'proxy',
        consulted_at: new Date().toISOString(),
        emitente_cnpj: body.emitente?.cnpj ?? null,
        emitente_nome: body.emitente?.nome ?? null,
        destinatario_cnpj: body.destinatario?.cnpj ?? null,
        destinatario_nome: body.destinatario?.nome ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      chave,
      document_type: documentTypeFromChave(chave),
      error: msg.includes('abort')
        ? 'Timeout na consulta SEFAZ (proxy)'
        : `Erro no proxy SEFAZ: ${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function consultViaFocus(
  chave: string,
  token: string,
  cnpj?: string | null,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SefazConsultResult> {
  const modelo = modelFromChave(chave);
  const docType = documentTypeFromChave(chave);
  const path =
    modelo === '57'
      ? `ctes_recebidas/${chave}`
      : modelo === '58'
        ? `mdfes_recebidas/${chave}`
        : `nfes_recebidas/${chave}`;

  const url = new URL(`${FOCUS_BASE}/${path}`);
  url.searchParams.set('completa', '1');
  if (cnpj) url.searchParams.set('cnpj', cnpj.replace(/\D/g, ''));

  const auth = btoa(`${token}:`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return {
        ok: false,
        chave,
        document_type: docType,
        error:
          'Documento não encontrado na base Focus (habilite distribuição DFe ou use proxy SEFAZ)',
        http_status: 404,
      };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        chave,
        document_type: docType,
        error: `Focus NFe HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        http_status: res.status,
      };
    }

    const data = await res.json();
    const situacao =
      data.situacao ??
      data.status ??
      data.status_sefaz ??
      data.requisicao_nota_fiscal?.status ??
      null;
    const mapped = mapFocusSituacao(
      typeof situacao === 'string' ? situacao : String(situacao ?? '')
    );

    return {
      ok: mapped.c_stat === '100',
      chave,
      document_type: docType,
      metadata: {
        c_stat: mapped.c_stat,
        x_motivo: mapped.x_motivo,
        protocolo: data.protocolo ?? data.numero_protocolo ?? null,
        data_autorizacao: data.data_emissao ?? data.data_autorizacao ?? null,
        source: 'focus',
        consulted_at: new Date().toISOString(),
        emitente_cnpj: data.cnpj_emitente ?? data.emitente?.cnpj ?? null,
        emitente_nome: data.nome_emitente ?? data.emitente?.nome ?? null,
        destinatario_cnpj: data.cnpj_destinatario ?? data.destinatario?.cnpj ?? null,
        destinatario_nome: data.nome_destinatario ?? data.destinatario?.nome ?? null,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      chave,
      document_type: docType,
      error: msg.includes('abort') ? 'Timeout na consulta Focus NFe' : `Erro Focus NFe: ${msg}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface ConsultSefazOptions {
  proxyUrl?: string | null;
  proxySecret?: string | null;
  focusToken?: string | null;
  vectraCnpj?: string | null;
  timeoutMs?: number;
}

export async function consultSefaz(
  chave: string,
  options: ConsultSefazOptions
): Promise<SefazConsultResult> {
  const clean = chave.replace(/\D/g, '');
  if (clean.length !== 44) {
    return {
      ok: false,
      chave: clean,
      document_type: 'unknown',
      error: 'Chave inválida para consulta SEFAZ',
    };
  }

  if (options.proxyUrl && options.proxySecret) {
    const viaProxy = await consultViaProxy(
      clean,
      options.proxyUrl,
      options.proxySecret,
      options.timeoutMs
    );
    if (viaProxy.metadata) return viaProxy;
    if (!options.focusToken) return viaProxy;
  }

  if (options.focusToken) {
    return consultViaFocus(clean, options.focusToken, options.vectraCnpj, options.timeoutMs);
  }

  if (options.proxyUrl && !options.proxySecret) {
    return {
      ok: false,
      chave: clean,
      document_type: documentTypeFromChave(clean),
      error: 'SEFAZ_PROXY_SECRET não configurado no Supabase',
    };
  }

  return {
    ok: false,
    chave: clean,
    document_type: documentTypeFromChave(clean),
    error:
      'Consulta SEFAZ não configurada. Defina SEFAZ_PROXY_URL + SEFAZ_PROXY_SECRET (proxy com certificado A1) ou FOCUS_NFE_TOKEN.',
  };
}

/** Extrai cStat/xMotivo de retorno SOAP bruto (fallback). */
export function parseSefazSoapResponse(soapXml: string): {
  c_stat: string;
  x_motivo: string;
  protocolo?: string;
} {
  const c_stat = parseXmlTag(soapXml, 'cStat') ?? '000';
  const x_motivo = parseXmlTag(soapXml, 'xMotivo') ?? '';
  const protocolo = parseXmlTag(soapXml, 'nProt') ?? undefined;
  return { c_stat, x_motivo, protocolo };
}
