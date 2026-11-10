/**
 * Cliente HTTP da API CIOT Online (https://ciotonline.com.br/docs).
 * Puro: sem DB, sem Deno.env no topo — token/fetch injetáveis (testável no Vitest).
 * Spec: docs/superpowers/specs/2026-11-10-ciot-online-provider-design.md
 */

export const CIOTONLINE_DEFAULT_BASE_URL = 'https://ciotonline.com.br/api/v1';

export type CiotOnlineError = {
  code: string;
  message: string;
  httpStatus: number;
  anttStatus?: string;
  anttResponse?: unknown;
};

export type CiotOnlineResult<T> =
  { ok: true; data: T; httpStatus: number } | { ok: false; error: CiotOnlineError; raw: unknown };

export type CiotOnlineEmitData = {
  id: number;
  numero_ciot: string;
  protocolo: string;
  status: string;
  em_contingencia?: boolean;
  creditos_debitados?: number;
  saldo_restante?: number;
  antt_response?: unknown;
};

export type CiotOnlineListItem = {
  id: number;
  numero_ciot: string;
  protocolo: string;
  codigo_cliente: string;
  status: string;
};

export type CiotOnlinePlateData = {
  vinculo_valido: boolean;
  mensagem?: string | null;
  transportador?: unknown;
  veiculo?: unknown;
};

export type CiotOnlinePisoData = {
  piso_minimo: number;
  eixos_utilizado?: number;
  tabela?: string;
  detalhe?: unknown;
};

type GetEnv = (key: string) => string | undefined;

const defaultGetEnv: GetEnv = (key) =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(key);

export type CiotOnlineClientOptions = {
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  getEnv?: GetEnv;
};

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function extractAnttStatus(error: Record<string, unknown>, data: unknown): string | undefined {
  if (typeof error.antt_status === 'string') return error.antt_status;
  const ar = (data as { antt_response?: { status?: unknown } } | null)?.antt_response;
  if (ar && typeof ar.status === 'string') return ar.status;
  const er = error.antt_response as { status?: unknown } | undefined;
  if (er && typeof er.status === 'string') return er.status;
  return undefined;
}

export function createCiotOnlineClient(opts: CiotOnlineClientOptions = {}) {
  const getEnv = opts.getEnv ?? defaultGetEnv;
  const token = (opts.token || getEnv('CIOTONLINE_TOKEN') || '').trim();
  if (!token) throw new Error('CIOTONLINE_TOKEN not configured');
  const baseUrl = (opts.baseUrl || getEnv('CIOTONLINE_BASE_URL') || CIOTONLINE_DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30000;

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<CiotOnlineResult<T>> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return {
        ok: false,
        error: { code: 'network_error', message: String(err), httpStatus: 0 },
        raw: null,
      };
    }

    const text = await res.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      return {
        ok: false,
        error: {
          code: 'resposta_invalida',
          message: `Resposta inválida do CIOT Online (HTTP ${res.status}): ${text.slice(0, 160)}`,
          httpStatus: res.status,
        },
        raw: text,
      };
    }

    if (res.ok && parsed.ok !== false) {
      return { ok: true, data: parsed.data as T, httpStatus: res.status };
    }

    const err = (parsed.error ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      error: {
        code: typeof err.code === 'string' ? err.code : `http_${res.status}`,
        message: typeof err.message === 'string' ? err.message : `HTTP ${res.status}`,
        httpStatus: res.status,
        anttStatus: extractAnttStatus(err, parsed.data),
        anttResponse:
          err.antt_response ?? (parsed.data as { antt_response?: unknown } | null)?.antt_response,
      },
      raw: parsed,
    };
  }

  return {
    emitir: (payload: Record<string, unknown>) =>
      request<CiotOnlineEmitData>('POST', '/ciots', payload),
    consultar: (id: number) => request<CiotOnlineEmitData>('GET', `/ciots/${id}`),
    listar: (q: { status?: string; page?: number; limit?: number } = {}) =>
      request<{ items?: CiotOnlineListItem[]; data?: CiotOnlineListItem[]; page?: number }>(
        'GET',
        `/ciots${qs(q)}`
      ),
    cancelar: (id: number, motivo: string) =>
      request<{ id: number; status: string; antt_response?: unknown }>(
        'POST',
        `/ciots/${id}/cancelar`,
        { motivo }
      ),
    encerrar: (id: number, body: { peso_carga_total?: number } = {}) =>
      request<{ id: number; status: string; antt_response?: unknown }>(
        'POST',
        `/ciots/${id}/encerrar`,
        body
      ),
    pisoFrete: (q: { distancia_km: number; eixos?: number; tipo_carga?: number }) =>
      request<CiotOnlinePisoData>('GET', `/piso-frete${qs(q)}`),
    validarPlaca: (q: { placa: string; rntrc?: string; cnpj?: string }) =>
      request<CiotOnlinePlateData>('GET', `/antt/veiculo${qs(q)}`),
    saldo: () => request<{ creditos?: number; saldo?: number }>('GET', '/saldo'),
  };
}

export type CiotOnlineClient = ReturnType<typeof createCiotOnlineClient>;
