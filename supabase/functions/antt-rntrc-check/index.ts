/// <reference path="../_shared/deno.d.ts" />
/**
 * antt-rntrc-check  v3.0.0
 * Consulta RNTRC (Por Transportador / Por Veículo), CIOT Agregado e VPO
 * via portal público ANTT. Baseado em mapeamento real do DOM (mai/2026).
 *
 * operations:
 *   rntrc   — Por Transportador (rbTipoConsulta=1); cpf_cnpj obrigatório
 *   veiculo — Por Veículo (rbTipoConsulta=3); vehicle_plate obrigatório
 *   ciot    — CIOT Agregado; rntrc + renavam obrigatórios
 *   vpo     — Vale-Pedágio Obrigatório; vehicle_plate obrigatório
 *
 * Sempre retorna HTTP 200 — nunca 500 — para não bloquear o wizard.
 * Timeout total: 25 s. Requer Deno.serve() (Edge Runtime 1.73+).
 */

// ─── URLs ────────────────────────────────────────────────────────────────────

const RNTRC_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaRNTRC.aspx';
const CIOT_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaCIOT.aspx';
const VPO_URL = 'https://consultapublica.antt.gov.br/Site/ConsultaVPO.aspx';
const ALTCHA_URL = 'https://captcha.srvs.antt.gov.br/altcha';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 25_000;
const ALTCHA_POW_ENABLED = true;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-api-key',
};

// SHA-256 sincrono — necessario para resolver o PoW do ALTCHA dentro do CPU
// budget de ~400ms do Supabase Edge Runtime. crypto.subtle.digest tem overhead
// async (~10us/call) que estoura o budget para maxnumber=100000.
import { sha256 } from 'https://esm.sh/js-sha256@0.11.0';

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface AnttRntrcCheckRequest {
  order_id: string;
  cpf_cnpj?: string;
  vehicle_plate?: string;
  rntrc?: string;
  renavam?: string;
  operation?: 'rntrc' | 'veiculo' | 'ciot' | 'vpo';
}

interface CiotResult {
  found: boolean;
  ciot?: string | null;
  status?: string | null;
  transportador?: string | null;
  embarcador?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  mensagem?: string;
}

interface AnttRntrcCheckResponse {
  situacao: 'regular' | 'irregular' | 'indeterminado';
  /** ATIVO / VENCIDO / CANCELADO / SUSPENSO conforme a tabela ANTT */
  situacao_raw?: string;
  /** Tipo registral RNTRC quando encontrado no retorno (TAC/ETC) */
  rntrc_registry_type?: 'TAC' | 'ETC' | null;
  rntrc?: string | null;
  transportador?: string;
  /** CPF/CNPJ mascarado retornado pelo portal (ex: XXX.465.204-XX) */
  cpf_cnpj_mask?: string;
  cadastrado_desde?: string;
  municipio_uf?: string;
  /** true se "apto a realizar transporte remunerado" (Corpo_lblMsg) */
  apto?: boolean;
  /** Apenas para operation='veiculo': veículo está na frota do transportador */
  veiculo_na_frota?: boolean;
  /** URL do comprovante/certidão de regularidade emitido pelo portal ANTT */
  comprovante_url?: string | null;
  /** Path no bucket antt-comprovantes apos download (auditoria) */
  comprovante_storage_path?: string | null;
  ciot?: CiotResult;
  message?: string;
  is_stub: boolean;
}

interface AltchaChallenge {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber?: number;
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), ms);
  return ac.signal;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── ASP.NET TOKEN EXTRACTION ────────────────────────────────────────────────

function extractHidden(html: string, id: string): string {
  const esc = id.replace(/[[\]$]/g, '\\$&');
  const m1 = html.match(new RegExp(`id="${esc}"[^>]*\\bvalue="([^"]*)"`, 'i'));
  if (m1) return m1[1];
  const m2 = html.match(new RegExp(`name="${esc}"[^>]*\\bvalue="([^"]*)"`, 'i'));
  if (m2) return m2[1];
  const m3 = html.match(new RegExp(`\\bvalue="([^"]*)"[^>]*\\bid="${esc}"`, 'i'));
  if (m3) return m3[1];
  return '';
}

function extractCookies(res: Response): string {
  const getCookies =
    typeof (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
  return getCookies.map((c: string) => c.split(';')[0]).join('; ');
}

/** Merges fresh Set-Cookie values into an existing cookie string (fresh overrides existing). */
function mergeCookies(existing: string, fresh: string): string {
  const map = new Map<string, string>();
  for (const raw of (existing + '; ' + fresh).split(';')) {
    const pair = raw.trim();
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const name = eq >= 0 ? pair.slice(0, eq).trim() : pair.trim();
    if (name) map.set(name, pair);
  }
  return [...map.values()].join('; ');
}

// ─── ALTCHA PROOF-OF-WORK ────────────────────────────────────────────────────
// SHA-256 SINCRONO via js-sha256 (JS puro, sem WASM, sem promises).
// crypto.subtle.digest async tinha overhead de microtasks que estourava o CPU
// budget do Supabase Edge Runtime (~400ms) com maxnumber=100000. js-sha256
// roda em ~1us/hash → 50_000 hashes = ~50ms, cabe folgado.

const POW_DEADLINE_MS = 8_000;

async function solvePoW(
  salt: string,
  target: string,
  maxnumber = 1_000_000,
  signal?: AbortSignal
): Promise<number | null> {
  const cap = Math.min(maxnumber, 1_000_000);
  const deadline = Date.now() + POW_DEADLINE_MS;
  const targetLower = target.toLowerCase();

  // Loop sincrono — sha256() retorna hex, comparacao de string. Check de
  // abort/deadline a cada 2048 iteracoes (bitmask) reduz overhead.
  for (let n = 0; n <= cap; n++) {
    if ((n & 0x7ff) === 0) {
      if (signal?.aborted) return null;
      if (Date.now() > deadline) {
        console.warn('[antt] PoW deadline at n=', n);
        return null;
      }
    }
    if (sha256(salt + n) === targetLower) {
      return n;
    }
  }
  return null;
}

function buildAltchaPayload(ch: AltchaChallenge, number: number): string {
  return btoa(
    JSON.stringify({
      algorithm: ch.algorithm,
      challenge: ch.challenge,
      number,
      salt: ch.salt,
      signature: ch.signature,
    })
  );
}

// Returns null (instead of throwing) when the challenge can't be fetched or PoW
// times out — the caller must handle a missing token gracefully.
async function fetchAltchaAndSolve(referer: string, signal: AbortSignal): Promise<string | null> {
  if (!ALTCHA_POW_ENABLED) {
    return null;
  }
  try {
    console.log('[antt] altcha: fetching challenge');
    const res = await fetch(ALTCHA_URL, {
      headers: { 'User-Agent': UA, Referer: referer },
      signal,
    });
    if (!res.ok) {
      console.warn('[antt] altcha fetch failed:', res.status);
      return null;
    }
    const ch: AltchaChallenge = await res.json();
    console.log('[antt] altcha challenge maxnumber=', ch.maxnumber);
    const t1 = Date.now();
    const n = await solvePoW(ch.salt, ch.challenge, ch.maxnumber, signal);
    if (n === null) {
      console.warn('[antt] altcha PoW failed after', Date.now() - t1, 'ms');
      return null;
    }
    console.log('[antt] altcha PoW solved n=', n, 'in', Date.now() - t1, 'ms');
    return buildAltchaPayload(ch, n);
  } catch (e) {
    console.error('[antt] altcha error:', String(e));
    return null;
  }
}

// ─── UPDATE PANEL DELTA PARSER (REGEX-BASED) ─────────────────────────────────
// Reescrito porque o parser por length quebra com chars Unicode (length em
// UTF-16 code units, JS string lê em code points → off-by-N em respostas com
// acentos como "Pública", "Veículo", "Não"). Regex ignora o length e busca
// os campos diretamente — VIEWSTATE/EVENTVALIDATION são base64 (sem |), então
// a delimitação por pipe é segura.

interface DeltaResult {
  panels: Record<string, string>;
  hiddenFields: Record<string, string>;
}

const DELTA_NEXT =
  '\\|\\d+\\|(?:updatePanel|hiddenField|scriptBlock|pageRedirect|asyncPostBackControlIDs|postBackControlIDs|updatePanelIDs|childUpdatePanelIDs|panelsToRefreshIDs|asyncPostBackTimeout|formAction|dataItem|dataItemJson|arrayDeclaration|expandoAttribute|onSubmit|focus|scriptStartupBlock|scriptDispose)\\|';

function parseDeltaFull(delta: string): DeltaResult {
  const panels: Record<string, string> = {};
  const hiddenFields: Record<string, string> = {};

  for (const m of delta.matchAll(/\|hiddenField\|(__[A-Z]+)\|([^|]*)/g)) {
    hiddenFields[m[1]] = m[2];
  }

  // Captura updatePanel até o próximo registro OU fim do delta (último painel).
  const PANEL_RE = new RegExp(`\\|updatePanel\\|([^|]+)\\|([\\s\\S]*?)(?=${DELTA_NEXT}|$)`, 'g');
  for (const m of delta.matchAll(PANEL_RE)) {
    panels[m[1]] = m[2];
  }

  return { panels, hiddenFields };
}

function parseDelta(delta: string): Record<string, string> {
  return parseDeltaFull(delta).panels;
}

/** Extracts UpdatePanel HTML or falls back to raw response. */
function extractPanelHtml(responseText: string, ct: string): string {
  const isDelta =
    ct.includes('text/plain') ||
    /^\d+\|/.test(responseText) ||
    responseText.includes('|updatePanel|');
  if (!isDelta) return responseText;
  const panels = parseDelta(responseText);
  const ids = Object.keys(panels);
  if (ids.length === 0) return responseText;

  // Prefer painel com resultado da grade; evita ficar só no Corpo_updPnlTipoConsulta.
  const withResult = ids.find((id) =>
    /gvResultadoPesquisa|lblMsg|Resultado/i.test(panels[id] ?? '')
  );
  if (withResult) return panels[withResult];

  // Junta todos — parser de resultado ainda vasculha raw se preciso
  return ids.map((id) => panels[id]).join('\n');
}

/** HTML efetivo p/ parse: painéis + fallback no delta cru (grade pode estar fora do painel preferido). */
function htmlForRntrcParse(responseText: string, ct: string): string {
  const fromPanels = extractPanelHtml(responseText, ct);
  if (/Corpo_gvResultadoPesquisa|gvResultadoPesquisa/i.test(fromPanels)) return fromPanels;
  if (/Corpo_gvResultadoPesquisa|gvResultadoPesquisa/i.test(responseText)) return responseText;
  return fromPanels || responseText;
}

// ─── COMPROVANTE URL EXTRACTOR ────────────────────────────────────────────────
/**
 * Procura um link de certidão/comprovante na página de resultado.
 * O portal ANTT pode gerar links do tipo:
 *   <a href="CertidaoRNTRC.aspx?...">Emitir Certidão</a>
 *   window.open('...CertidaoRNTRC...')
 * Retorna a URL absoluta ou null se não encontrar.
 */
function extractComprovanteUrl(html: string): string | null {
  const BASE = 'https://consultapublica.antt.gov.br/Site/';

  // Padrão 1: <a href="..."> com texto ou href contendo palavras-chave
  const anchorMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of anchorMatches) {
    const href = m[1];
    const text = stripTags(m[2]);
    const isCert =
      /certidao|comprovante|emitir|regularidade/i.test(text) ||
      /certidao|comprovante|regularidade/i.test(href);
    if (isCert && !/javascript:/i.test(href)) {
      return href.startsWith('http') ? href : BASE + href.replace(/^\/+/, '');
    }
  }

  // Padrão 2: window.open('URL') com palavra-chave
  const winOpen = html.match(/window\.open\(['"]([^'"]*(?:certidao|comprovante)[^'"]*)['"]/i);
  if (winOpen) {
    const url = winOpen[1];
    return url.startsWith('http') ? url : BASE + url.replace(/^\/+/, '');
  }

  return null;
}

// ─── RNTRC RESULT PARSER ─────────────────────────────────────────────────────
/**
 * Parses Corpo_gvResultadoPesquisa (6 cols) + Corpo_lblMsg.
 * Used for both Por Transportador (rbTipoConsulta=1) and Por Veículo (3).
 *
 * Table columns: [0]Transportador [1]CPF/CNPJ [2]RNTRC [3]Situação RNTRC [4]Cadastrado desde [5]Município/UF
 *
 * Situação values confirmed: ATIVO, VENCIDO (e.g. Correios), CANCELADO.
 * veiculoNaFrota discrimination: Corpo_lblMsg contains <u><b>NÃO</b></u> when negative.
 */
function extractRntrcResult(
  html: string,
  isVeiculo: boolean
): Omit<AnttRntrcCheckResponse, 'is_stub'> {
  // ── 1. Table ──────────────────────────────────────────────────────────────
  const tblIdx = html.indexOf('Corpo_gvResultadoPesquisa');
  if (tblIdx !== -1) {
    const tblEnd = html.indexOf('</table>', tblIdx);
    const tblHtml = html.slice(tblIdx, tblEnd !== -1 ? tblEnd + 8 : tblIdx + 6000);

    // Second <tr> = data row (first is header)
    const rows = [...tblHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const dataRow = rows[1]?.[1] ?? '';
    const cells = [...dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => stripTags(m[1]));

    if (cells.length >= 4) {
      const [transportador, cpfCnpjMask, rntrc, situacaoRaw, cadastradoDesde, municipioUf] = cells;

      // Map raw situacao → canonical
      const situRaw = (situacaoRaw ?? '').trim().toUpperCase();
      const registryTypeCell = cells
        .find((c) => /^(TAC|ETC)$/i.test(c.trim()))
        ?.trim()
        .toUpperCase();
      // Coluna Transportador costuma vir "ETC - Razão Social" / "TAC - Nome"
      const fromTransportador = (transportador ?? '').match(/^\s*(TAC|ETC)\s*[-–—]/i)?.[1];
      const rntrcRegistryType = (registryTypeCell ||
        (fromTransportador ? fromTransportador.toUpperCase() : null) ||
        null) as 'TAC' | 'ETC' | null;
      let situacao: 'regular' | 'irregular';
      if (/^ATIVO$/.test(situRaw)) {
        situacao = 'regular';
      } else {
        // VENCIDO, CANCELADO, SUSPENSO, IMPEDIDO, INATIVO → irregular
        situacao = 'irregular';
      }

      // ── 2. Corpo_lblMsg ────────────────────────────────────────────────
      const lblRaw = html.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? '';
      const lblText = stripTags(lblRaw);

      const apto = /apto a realizar o transporte remunerado/i.test(lblRaw);

      // veiculoNaFrota: negative when lblMsg contains <b>NÃO</b> or "não está cadastrado"
      let veiculoNaFrota: boolean | undefined;
      if (isVeiculo) {
        const negativo =
          /<u[^>]*>\s*<b[^>]*>\s*N[AÃ]O\s*<\/b>/i.test(lblRaw) ||
          /n[aã]o\s+est[aá]\s+cadastrad/i.test(lblText);
        veiculoNaFrota = !negativo;
      }

      // Extrai URL de certidão/comprovante se o portal gerar link na página de resultado
      const comprovanteUrl = extractComprovanteUrl(html);

      return {
        situacao,
        situacao_raw: situRaw || undefined,
        rntrc_registry_type: rntrcRegistryType,
        rntrc: rntrc || null,
        transportador: transportador || undefined,
        cpf_cnpj_mask: cpfCnpjMask || undefined,
        cadastrado_desde: cadastradoDesde || undefined,
        municipio_uf: municipioUf || undefined,
        apto,
        veiculo_na_frota: veiculoNaFrota,
        comprovante_url: comprovanteUrl,
      };
    }
  }

  // ── Fallback: no table found ──────────────────────────────────────────────
  const noResult = /não foram encontrados transportadores|nenhum.*encontrad|sem.*resultado/i.test(
    html
  );
  if (noResult) return { situacao: 'irregular', rntrc: null };

  const isRegular = /\b(regular|ativo|habilitado)\b/i.test(html);
  const isIrregular = /\b(irregular|inativo|cancelado|suspenso|impedido|vencido)\b/i.test(html);
  const lblMsg = stripTags(
    html.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? ''
  );

  if (isRegular && !isIrregular) return { situacao: 'regular', rntrc: null, message: lblMsg };
  if (isIrregular) return { situacao: 'irregular', rntrc: null, message: lblMsg };
  return {
    situacao: 'indeterminado',
    rntrc: null,
    message: `preview=${html.slice(0, 300)}`,
  };
}

// ─── CIOT RESULT PARSER ──────────────────────────────────────────────────────
/**
 * Negative result lives in modal: #MessageBox_LabelMensagem
 * "Não existem registros de Operações de Transporte (CIOT) vigentes..."
 *
 * Positive result: to be confirmed — parseCiotTable returns [] until captured.
 */
function extractCiotResult(html: string): CiotResult {
  // Modal message (present in both positive and negative responses)
  const modalMsg = stripTags(
    html.match(/id="MessageBox_LabelMensagem"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
  );

  const noResult =
    /n[aã]o existem registros/i.test(modalMsg) ||
    /nenhum|n[aã]o.*encontrad|sem.*resultado|0.*registro|n[aã]o.*localizado/i.test(html);

  if (noResult) {
    return { found: false, mensagem: modalMsg || 'Sem registros CIOT' };
  }

  // Try to parse a results table (ID TBD — placeholder until positive result captured)
  const tblMatch = html.match(/id="(?:Corpo_gv[^"]*|gvCIOT[^"]*)"[\s\S]*?<\/table>/i);
  if (tblMatch) {
    const rows = [...tblMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rows.length >= 2) {
      const dataRow = rows[1][1];
      const cells = [...dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        stripTags(m[1])
      );
      const ciotCode = cells.find((c) => /^\d{14,}$/.test(c)) ?? null;
      const dates = cells.filter((c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c));
      const statusCell = cells.find((c) =>
        /\b(ativo|vigente|encerrado|cancelado|irregular)\b/i.test(c)
      );
      const names = cells.filter(
        (c) => c.length > 5 && !/^\d/.test(c) && !/^\d{2}\/\d{2}\/\d{4}$/.test(c)
      );
      return {
        found: true,
        ciot: ciotCode,
        status: statusCell ?? null,
        transportador: names[0] ?? null,
        embarcador: names[1] ?? null,
        data_inicio: dates[0] ?? null,
        data_fim: dates[1] ?? null,
        mensagem: modalMsg || undefined,
      };
    }
  }

  // Fallback: any 14-digit number in HTML = CIOT code
  const ciotMatch = html.match(/\b(\d{14,})\b/);
  const isActive = /\b(ativo|vigente)\b/i.test(html);

  if (ciotMatch || isActive || modalMsg) {
    return {
      found: true,
      ciot: ciotMatch?.[1] ?? null,
      status: isActive ? 'ativo' : null,
      mensagem: modalMsg || undefined,
    };
  }

  return { found: false, mensagem: 'Indeterminado' };
}

// ─── PAGE FETCHER ─────────────────────────────────────────────────────────────

interface PageTokens {
  viewState: string;
  viewStateGen: string;
  eventValidation: string;
  altchaUrl: string;
  cookies: string;
}

async function fetchPage(url: string, signal: AbortSignal): Promise<PageTokens> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    signal,
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const html = await res.text();

  return {
    viewState: extractHidden(html, '__VIEWSTATE'),
    viewStateGen: extractHidden(html, '__VIEWSTATEGENERATOR'),
    eventValidation: extractHidden(html, '__EVENTVALIDATION'),
    altchaUrl:
      extractHidden(html, 'ctl00$Corpo$hfAltchaUrl') ||
      extractHidden(html, 'Corpo_hfAltchaUrl') ||
      ALTCHA_URL,
    cookies: extractCookies(res),
  };
}

// ─── CONSULTATION FLOWS ──────────────────────────────────────────────────────

/**
 * Modo-switch intermediário para rbTipoConsulta.
 *
 * Radio indices (DOM): $0 = Por Transportador (1), $2 = Por Veículo (3).
 * O portal renderiza campos condicionalmente; sem autopostback o
 * __EVENTVALIDATION rejeita o POST final ("Invalid postback").
 */
async function switchRntrcMode(
  tokens: PageTokens,
  tipoConsulta: '1' | '3',
  signal: AbortSignal
): Promise<PageTokens> {
  const radioIdx = tipoConsulta === '3' ? '2' : '0';
  console.log('[antt] autopostback rbTipoConsulta=$' + radioIdx + ' (tipo=' + tipoConsulta + ')');

  const selBody = new URLSearchParams();
  selBody.append(
    'ctl00$ScriptManagerMain',
    `ctl00$ScriptManagerMain|ctl00$Corpo$rbTipoConsulta$${radioIdx}`
  );
  selBody.append('__EVENTTARGET', `ctl00$Corpo$rbTipoConsulta$${radioIdx}`);
  selBody.append('__EVENTARGUMENT', '');
  selBody.append('__LASTFOCUS', '');
  selBody.append('__VIEWSTATE', tokens.viewState);
  selBody.append('__VIEWSTATEGENERATOR', tokens.viewStateGen);
  selBody.append('__EVENTVALIDATION', tokens.eventValidation);
  selBody.append('ctl00$bMostraAlerta', 'true');
  selBody.append('ctl00$Corpo$hfPnlConsulta', '1');
  selBody.append('ctl00$Corpo$hfAltchaUrl', tokens.altchaUrl);
  selBody.append('ctl00$Corpo$rbTipoConsulta', tipoConsulta);
  // NÃO enviar txtPlaca no switch — só existe após tipo=3 ativo.
  selBody.append('ctl00$Corpo$txtRNTRC', '');
  selBody.append('ctl00$Corpo$txtCpfCnpj', '');
  selBody.append('__ASYNCPOST', 'true');

  try {
    const res = await fetch(RNTRC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': UA,
        Referer: RNTRC_URL,
        Cookie: tokens.cookies,
        'X-MicrosoftAjax': 'Delta=true',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
        'Cache-Control': 'no-cache',
      },
      body: selBody.toString(),
      redirect: 'follow',
      signal,
    });
    const text = await res.text();
    const freshCookies = extractCookies(res);
    const mergedCookies = freshCookies
      ? mergeCookies(tokens.cookies, freshCookies)
      : tokens.cookies;

    if (/\d+\|error\|/i.test(text)) {
      console.error('[antt] autopostback rejeitado:', text.slice(0, 300));
      throw new Error('autopostback delta error');
    }

    const { hiddenFields } = parseDeltaFull(text);

    const vs = hiddenFields['__VIEWSTATE'];
    const ev = hiddenFields['__EVENTVALIDATION'];
    const vsg = hiddenFields['__VIEWSTATEGENERATOR'];

    if (!vs || !ev) {
      throw new Error(
        `autopostback: tokens ausentes (vs=${!!vs}, ev=${!!ev}). Delta preview: ${text.slice(0, 200)}`
      );
    }

    console.log('[antt] autopostback OK, vs.len=', vs.length, 'ev.len=', ev.length);
    return {
      ...tokens,
      viewState: vs,
      viewStateGen: vsg || tokens.viewStateGen,
      eventValidation: ev,
      cookies: mergedCookies,
    };
  } catch (e) {
    console.error('[antt] switchRntrcMode FALHOU:', String(e));
    throw e;
  }
}

/** Returns true when the delta response is an ASP.NET event-validation rejection. */
function isEventValidationError(text: string): boolean {
  return /\d+\|error\|500\|Invalid postback/i.test(text);
}

async function consultaRntrc(
  cpfCnpj: string,
  plate: string,
  rntrc: string | undefined,
  tipoConsulta: '1' | '3',
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  // Retry loop: EventValidation errors on tipo=3 happen when the autopostback
  // fails to update tokens. A fresh GET+autopostback on the second attempt
  // resolves the mismatch.
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) console.warn('[antt] retry', attempt, 'após EventValidation rejection');

    let tokens = await fetchPage(RNTRC_URL, signal);
    if (!tokens.viewState) throw new Error('RNTRC ViewState não encontrado');

    // Sempre sincroniza o radio com o tipo desejado antes do POST de consulta.
    tokens = await switchRntrcMode(tokens, tipoConsulta, signal);

    let altchaPayload = await fetchAltchaAndSolve(RNTRC_URL, signal);
    if (!altchaPayload && attempt < 2) {
      console.warn('[antt] altcha vazio — retry attempt');
      continue;
    }
    if (!altchaPayload) {
      return {
        situacao: 'indeterminado',
        rntrc: null,
        is_stub: false,
        message: 'Captcha ANTT (ALTCHA) indisponível — tente de novo em alguns segundos',
      };
    }

    console.log(
      '[antt] POST RNTRC tipo=',
      tipoConsulta,
      'attempt=',
      attempt,
      'plate=',
      plate || '(none)'
    );
    const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = tokens;
    const formBody = new URLSearchParams({
      ctl00$ScriptManagerMain: 'ctl00$ScriptManagerMain|ctl00$Corpo$btnConsulta',
      __EVENTTARGET: '',
      __EVENTARGUMENT: '',
      __LASTFOCUS: '',
      __VIEWSTATE: viewState,
      __VIEWSTATEGENERATOR: viewStateGen,
      __EVENTVALIDATION: eventValidation,
      ctl00$bMostraAlerta: 'true',
      ctl00$Corpo$hfPnlConsulta: '1',
      ctl00$Corpo$hfAltchaUrl: altchaUrl,
      ctl00$Corpo$rbTipoConsulta: tipoConsulta,
      ctl00$Corpo$txtRNTRC: rntrc ?? '',
      ctl00$Corpo$txtCpfCnpj: cpfCnpj,
      altcha: altchaPayload,
      ctl00$Corpo$btnConsulta: 'Consultar',
      __ASYNCPOST: 'true',
    });
    // txtPlaca só existe no DOM/EVENTVALIDATION quando tipo=3.
    if (tipoConsulta === '3') {
      formBody.set('ctl00$Corpo$txtPlaca', plate);
    }
    const postRes = await fetch(RNTRC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': UA,
        Referer: RNTRC_URL,
        Cookie: cookies,
        'X-MicrosoftAjax': 'Delta=true',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: '*/*',
      },
      body: formBody.toString(),
      redirect: 'follow',
      signal,
    });
    if (!postRes.ok) throw new Error(`RNTRC POST ${postRes.status}`);

    const responseText = await postRes.text();
    const ct = postRes.headers.get('content-type') ?? '';
    console.log('[antt] RNTRC ct=', ct, 'response.len=', responseText.length);
    const panelIds = Array.from(responseText.matchAll(/updatePanel\|([^|]+)\|/g)).map((m) => m[1]);
    console.log('[antt] RNTRC delta updatePanel ids=', panelIds.join(','));
    console.log('[antt] RNTRC response[:500]=', responseText.slice(0, 500));
    console.log('[antt] RNTRC response[1500:3000]=', responseText.slice(1500, 3000));
    console.log('[antt] RNTRC response[-500:]=', responseText.slice(-500));

    if (attempt < 2 && isEventValidationError(responseText)) {
      console.warn('[antt] EventValidation rejection detectada — retrying');
      continue;
    }

    // Só painel de tipo (sem grade) = postback não consultou — retry fresco
    const onlyTipoPanel =
      panelIds.length > 0 &&
      panelIds.every((id) => /TipoConsulta|Panel1/i.test(id)) &&
      !/gvResultadoPesquisa/i.test(responseText);
    if (onlyTipoPanel && attempt < 2) {
      console.warn('[antt] delta só TipoConsulta sem grade — retry');
      continue;
    }

    const resultHtml = htmlForRntrcParse(responseText, ct);
    console.log('[antt] RNTRC resultHtml[:500]=', resultHtml.slice(0, 500));

    const parsed = extractRntrcResult(resultHtml, tipoConsulta === '3');
    // Segunda chance: parse no delta cru
    const parsed2 =
      parsed.situacao === 'indeterminado'
        ? extractRntrcResult(responseText, tipoConsulta === '3')
        : parsed;
    const finalParsed = parsed2.situacao !== 'indeterminado' ? parsed2 : parsed;
    console.log('[antt] RNTRC parsed=', JSON.stringify(finalParsed));

    if (finalParsed.situacao === 'indeterminado') {
      finalParsed.message = onlyTipoPanel
        ? 'Portal ANTT não retornou grade (só painel de tipo). Tente de novo.'
        : `ct=${ct}; panels=${panelIds.join(',') || 'none'}; preview=${responseText.slice(0, 180)}`;
    }

    return { ...finalParsed, is_stub: false };
  }

  // Should never reach here (loop always returns or throws)
  return {
    situacao: 'indeterminado',
    rntrc: null,
    is_stub: false,
    message: 'max retries exceeded',
  };
}

async function consultaCIOT(
  rntrc: string,
  renavam: string,
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  console.log('[antt] GET CIOT page rntrc=', rntrc, 'renavam=', renavam);
  const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = await fetchPage(
    CIOT_URL,
    signal
  );

  if (!viewState) throw new Error('CIOT ViewState não encontrado');

  const altchaPayload = await fetchAltchaAndSolve(CIOT_URL, signal);

  console.log('[antt] POST CIOT');
  const formBody = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen || '64C8F81D',
    __EVENTVALIDATION: eventValidation,
    ctl00$bMostraAlerta: 'true',
    ctl00$Corpo$hfPnlConsultaCIOT: '1',
    ctl00$Corpo$hfAltchaUrl: altchaUrl,
    ctl00$Corpo$rbTipoConsultaCIOT: '1',
    ctl00$Corpo$txtRntrc: rntrc,
    ctl00$Corpo$txtRenavam: renavam,
    ...(altchaPayload ? { altcha: altchaPayload } : {}),
    // Confirmed button name from portal DOM mapping (mai/2026)
    ctl00$Corpo$btnConsultar: 'Consultar',
  });

  // CIOT result arrives in a modal (MessageBox_LabelMensagem), not UpdatePanel.
  // Use regular POST headers — no X-MicrosoftAjax.
  const postRes = await fetch(CIOT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: CIOT_URL,
      Cookie: cookies,
      Accept: 'text/html,application/xhtml+xml',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`CIOT POST ${postRes.status}`);

  const responseText = await postRes.text();
  const ct = postRes.headers.get('content-type') ?? '';
  console.log('[antt] CIOT ct=', ct, 'response[:300]=', responseText.slice(0, 300));

  // Handle both full HTML and delta (defensive)
  const resultHtml = extractPanelHtml(responseText, ct);
  console.log('[antt] CIOT resultHtml[:500]=', resultHtml.slice(0, 500));

  const ciot = extractCiotResult(resultHtml);
  console.log('[antt] CIOT result=', JSON.stringify(ciot));

  return {
    situacao: ciot.found ? 'regular' : 'irregular',
    ciot,
    is_stub: false,
  };
}

async function consultaVPO(
  plate: string,
  cpfCnpj: string,
  signal: AbortSignal
): Promise<AnttRntrcCheckResponse> {
  console.log('[antt] GET VPO page plate=', plate);
  const { viewState, viewStateGen, eventValidation, altchaUrl, cookies } = await fetchPage(
    VPO_URL,
    signal
  );

  if (!viewState) throw new Error('VPO ViewState não encontrado');

  const altchaPayload = await fetchAltchaAndSolve(VPO_URL, signal);

  console.log('[antt] POST VPO');
  const formBody = new URLSearchParams({
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGen || 'F4FFBDCA',
    __EVENTVALIDATION: eventValidation,
    ctl00$bMostraAlerta: 'true',
    ctl00$Corpo$hfAltchaUrl: altchaUrl,
    ctl00$Corpo$txtPlaca: plate,
    ctl00$Corpo$txtCpfCnpj: cpfCnpj,
    ...(altchaPayload ? { altcha: altchaPayload } : {}),
    ctl00$Corpo$btnConsultar: 'Consultar',
  });

  const postRes = await fetch(VPO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': UA,
      Referer: VPO_URL,
      Cookie: cookies,
      Accept: 'text/html,application/xhtml+xml',
    },
    body: formBody.toString(),
    redirect: 'follow',
    signal,
  });
  if (!postRes.ok) throw new Error(`VPO POST ${postRes.status}`);

  const responseText = await postRes.text();
  const ct = postRes.headers.get('content-type') ?? '';
  console.log('[antt] VPO ct=', ct, 'response[:300]=', responseText.slice(0, 300));

  const resultHtml = extractPanelHtml(responseText, ct);

  // VPO result: modal or lblMsg
  const modalMsg = stripTags(
    resultHtml.match(/id="MessageBox_LabelMensagem"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
  );
  const lblMsg = stripTags(
    resultHtml.match(/id="Corpo_lblMsg"[^>]*>([\s\S]*?)<\/(?:span|div|td)>/i)?.[1] ?? ''
  );
  const mensagem = modalMsg || lblMsg;
  const found =
    !/n[aã]o foram encontrados|n[aã]o existem|sem registros/i.test(mensagem) && mensagem.length > 0;

  return {
    situacao: found ? 'regular' : 'irregular',
    message: mensagem || undefined,
    is_stub: false,
  };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
// ─── COMPROVANTE STORAGE (Plano B) ───────────────────────────────────────────
/**
 * Baixa o comprovante (PDF/HTML) do portal ANTT e persiste no bucket privado
 * antt-comprovantes via Supabase Storage REST API. Retorna o storage_path ou
 * null em caso de falha. NUNCA throw — falha de download nao deve quebrar a
 * resposta principal da consulta.
 */
async function downloadAndStoreComprovante(
  url: string,
  orderId: string,
  rntrc: string
): Promise<string | null> {
  const supaUrl = (
    globalThis as unknown as { Deno?: { env?: { get?: (k: string) => string | undefined } } }
  ).Deno?.env?.get?.('SUPABASE_URL');
  const serviceKey = (
    globalThis as unknown as { Deno?: { env?: { get?: (k: string) => string | undefined } } }
  ).Deno?.env?.get?.('SUPABASE_SERVICE_ROLE_KEY');
  if (!supaUrl || !serviceKey) {
    console.warn('[antt] storage skip — env SUPABASE_URL/SERVICE_ROLE_KEY ausentes');
    return null;
  }

  // 1. Download do comprovante. O portal pode redirecionar; segue.
  const downloadRes = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/pdf, text/html, */*' },
    redirect: 'follow',
  });
  if (!downloadRes.ok) {
    console.warn('[antt] download comprovante falhou:', downloadRes.status);
    return null;
  }
  const ct = downloadRes.headers.get('content-type') ?? 'application/pdf';
  const buf = new Uint8Array(await downloadRes.arrayBuffer());

  // 2. Define extensao baseada no content-type
  const ext = /pdf/i.test(ct) ? 'pdf' : /html/i.test(ct) ? 'html' : /png/i.test(ct) ? 'png' : 'bin';
  const storagePath = `${orderId}/${rntrc}-${Date.now()}.${ext}`;

  // 3. Upload via Storage REST (service_role bypassa RLS)
  const uploadUrl = `${supaUrl}/storage/v1/object/antt-comprovantes/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': ct,
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '');
    console.warn('[antt] upload comprovante falhou:', uploadRes.status, body.slice(0, 200));
    return null;
  }
  return storagePath;
}

const edgeServe = (
  globalThis as unknown as {
    Deno?: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };
  }
).Deno?.serve;

if (!edgeServe) {
  throw new Error('Deno.serve is not available in this runtime');
}

edgeServe(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: CORS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: AnttRntrcCheckRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (!body.order_id) {
    return new Response(JSON.stringify({ error: 'Campo obrigatório: order_id' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const operation = body.operation ?? 'rntrc';
  const cpfCnpj = onlyDigits(body.cpf_cnpj ?? '');
  const plate = normalizePlate(body.vehicle_plate ?? '');
  const rntrcNorm = body.rntrc ? onlyDigits(String(body.rntrc)) : undefined;

  // Validate required fields per operation
  if (operation === 'rntrc') {
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return new Response(
        JSON.stringify({ error: 'operation=rntrc requer cpf_cnpj (11 ou 14 dígitos)' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  }
  // Por Transportador (rntrc/tipo=1) não exige placa — cadastro Owner/CNPJ.
  // Por Veículo / VPO exigem placa.
  if (operation === 'veiculo' || operation === 'vpo') {
    if (!plate || plate.length < 7) {
      return new Response(JSON.stringify({ error: 'Placa do veículo inválida' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }
  if (operation === 'ciot') {
    const renavamNorm = onlyDigits(String(body.renavam ?? ''));
    if (!rntrcNorm || !renavamNorm) {
      return new Response(JSON.stringify({ error: 'operation=ciot requer rntrc e renavam' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  console.log('[antt] operation=', operation, 'order_id=', body.order_id);

  try {
    const signal = timeoutSignal(FETCH_TIMEOUT_MS);
    let result: AnttRntrcCheckResponse;

    switch (operation) {
      case 'veiculo':
        result = await consultaRntrc(cpfCnpj, plate, rntrcNorm, '3', signal);
        // Plano A — enriquece com 2a consulta tipo=1 quando regular + temos
        // CNPJ do proprietario. "Por Veiculo" devolve so o essencial; "Por
        // Transportador" traz cpf_cnpj_mask, cadastrado_desde, municipio_uf,
        // comprovante_url completos.
        if (result.situacao === 'regular' && cpfCnpj && cpfCnpj.length >= 11) {
          try {
            console.log('[antt] enriching tipo=3 with tipo=1 cpfCnpj.len=', cpfCnpj.length);
            const enriched = await consultaRntrc(cpfCnpj, plate, rntrcNorm, '1', signal);
            if (enriched.situacao === 'regular') {
              result = {
                ...result,
                cpf_cnpj_mask: result.cpf_cnpj_mask || enriched.cpf_cnpj_mask,
                cadastrado_desde: result.cadastrado_desde || enriched.cadastrado_desde,
                municipio_uf: result.municipio_uf || enriched.municipio_uf,
                comprovante_url: result.comprovante_url || enriched.comprovante_url,
                rntrc_registry_type: result.rntrc_registry_type || enriched.rntrc_registry_type,
              };
              console.log('[antt] enrich OK — fields filled');
            } else {
              console.warn('[antt] enrich tipo=1 nao retornou regular:', enriched.situacao);
            }
          } catch (e) {
            console.warn('[antt] enrich tipo=1 falhou:', String(e));
          }
        }
        break;
      case 'ciot':
        result = await consultaCIOT(rntrcNorm!, onlyDigits(String(body.renavam)), signal);
        break;
      case 'vpo':
        result = await consultaVPO(plate, cpfCnpj, signal);
        break;
      default:
        result = await consultaRntrc(cpfCnpj, plate, rntrcNorm, '1', signal);
        break;
    }

    // Plano B — baixa o PDF do comprovante e persiste no bucket privado
    // antt-comprovantes (prova auditavel mesmo se URL do portal expirar).
    if (result.comprovante_url && body.order_id) {
      try {
        const storagePath = await downloadAndStoreComprovante(
          result.comprovante_url,
          body.order_id,
          result.rntrc ?? 'unknown'
        );
        if (storagePath) {
          result = { ...result, comprovante_storage_path: storagePath };
          console.log('[antt] comprovante salvo:', storagePath);
        }
      } catch (e) {
        console.warn('[antt] download/store comprovante falhou:', String(e));
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[antt] error:', message);
    const fallback: AnttRntrcCheckResponse = {
      situacao: 'indeterminado',
      rntrc: null,
      message: `Consulta indisponível: ${message}`,
      is_stub: false,
    };
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
