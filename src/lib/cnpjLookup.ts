/**
 * Consulta de CNPJ via BrasilAPI (fallback minhareceita.org e publica.cnpj.ws).
 *
 * BrasilAPI retorna numa unica chamada todos os campos do cartao CNPJ + QSA
 * (https://brasilapi.com.br/api/cnpj/v1/{cnpj}). Esse modulo normaliza a
 * resposta para o shape interno usado em clients e shippers.
 */

export interface CnpjPartner {
  name: string;
  role: string | null;
  role_code: string | null;
  document: string | null;
  entry_date: string | null;
  country: string | null;
  age_range: string | null;
}

export interface CnpjCnaeSecondary {
  codigo: string;
  descricao: string;
}

export interface CnpjLookupResult {
  // Identificacao
  cnpj: string;
  name: string | null;
  trade_name: string | null;

  // Contato
  email: string | null;
  phone: string | null;

  // Endereco
  address: string | null; // logradouro
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;

  // Dados juridicos
  legal_nature: string | null;
  legal_nature_code: string | null;
  company_size: string | null;
  opening_date: string | null; // ISO date
  registration_status: string | null;
  registration_status_date: string | null;
  registration_status_reason: string | null;
  efr: string | null;

  // CNAE
  cnae_main_code: string | null;
  cnae_main_description: string | null;
  cnaes_secondary: CnpjCnaeSecondary[];

  // QSA
  share_capital: number | null;
  partners: CnpjPartner[];

  /** Optante pelo Simples Nacional (quando informado pela Receita). */
  simples_optant: boolean | null;
  /** Optante pelo MEI (quando informado pela Receita). */
  mei_optant: boolean | null;
}

const sanitizeCnpj = (v: string) => v.replace(/\D/g, '');

const safeStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

const safeNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n =
    typeof v === 'number'
      ? v
      : Number(
          String(v)
            .replace(/[^0-9.,-]/g, '')
            .replace(',', '.')
        );
  return Number.isFinite(n) ? n : null;
};

const safeBool = (v: unknown): boolean | null => {
  if (v === true || v === 'true' || v === 'S' || v === 'SIM') return true;
  if (v === false || v === 'false' || v === 'N' || v === 'NAO' || v === 'NÃO') return false;
  return null;
};

const ymd = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  // BrasilAPI retorna "YYYY-MM-DD"; reaproveita se ja esta no formato.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Fallback: tenta parsear DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};

interface BrasilApiCnpjPartner {
  nome_socio?: string;
  qualificacao_socio?: string;
  codigo_qualificacao_socio?: string | number;
  cnpj_cpf_do_socio?: string;
  data_entrada_sociedade?: string;
  pais?: string;
  faixa_etaria?: string;
}

interface BrasilApiCnpjCnaeSecundario {
  codigo?: string | number;
  descricao?: string;
}

interface BrasilApiCnpj {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  uf?: string;
  natureza_juridica?: string;
  codigo_natureza_juridica?: string | number;
  porte?: string;
  descricao_porte?: string;
  data_inicio_atividade?: string;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: string;
  ente_federativo_responsavel?: string;
  cnae_fiscal?: string | number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: BrasilApiCnpjCnaeSecundario[];
  capital_social?: number | string;
  qsa?: BrasilApiCnpjPartner[];
  opcao_pelo_simples?: boolean | string | null;
  opcao_pelo_mei?: boolean | string | null;
}

function mapPartner(p: BrasilApiCnpjPartner): CnpjPartner {
  return {
    name: safeStr(p.nome_socio) ?? '',
    role: safeStr(p.qualificacao_socio),
    role_code: safeStr(p.codigo_qualificacao_socio),
    document: safeStr(p.cnpj_cpf_do_socio),
    entry_date: ymd(p.data_entrada_sociedade),
    country: safeStr(p.pais),
    age_range: safeStr(p.faixa_etaria),
  };
}

function normalize(data: BrasilApiCnpj): CnpjLookupResult {
  const cnaes: CnpjCnaeSecondary[] = Array.isArray(data.cnaes_secundarios)
    ? data.cnaes_secundarios
        .map((c) => ({
          codigo: safeStr(c.codigo) ?? '',
          descricao: safeStr(c.descricao) ?? '',
        }))
        .filter((c) => c.codigo || c.descricao)
    : [];

  const partners: CnpjPartner[] = Array.isArray(data.qsa)
    ? data.qsa.map(mapPartner).filter((p) => p.name.length > 0)
    : [];

  return {
    cnpj: safeStr(data.cnpj) ?? '',
    name: safeStr(data.razao_social),
    trade_name: safeStr(data.nome_fantasia),

    email: safeStr(data.email),
    phone: safeStr(data.ddd_telefone_1) ?? safeStr(data.ddd_telefone_2),

    address: safeStr(data.logradouro),
    address_number: safeStr(data.numero),
    address_complement: safeStr(data.complemento),
    address_neighborhood: safeStr(data.bairro),
    zip_code: safeStr(data.cep),
    city: safeStr(data.municipio),
    state: (safeStr(data.uf) ?? '').toUpperCase().slice(0, 2) || null,

    legal_nature: safeStr(data.natureza_juridica),
    legal_nature_code: safeStr(data.codigo_natureza_juridica),
    company_size: safeStr(data.descricao_porte) ?? safeStr(data.porte),
    opening_date: ymd(data.data_inicio_atividade),
    registration_status: safeStr(data.descricao_situacao_cadastral),
    registration_status_date: ymd(data.data_situacao_cadastral),
    registration_status_reason: safeStr(data.motivo_situacao_cadastral),
    efr: safeStr(data.ente_federativo_responsavel),

    cnae_main_code: safeStr(data.cnae_fiscal),
    cnae_main_description: safeStr(data.cnae_fiscal_descricao),
    cnaes_secondary: cnaes,

    share_capital: safeNum(data.capital_social),
    partners,

    simples_optant: safeBool(data.opcao_pelo_simples),
    mei_optant: safeBool(data.opcao_pelo_mei),
  };
}

export interface TaxRegistrationSuggestion {
  state_registration: string | null;
  municipal_registration: string | null;
  /** Mensagem curta para o usuário (IE/IM não vêm na Receita Federal). */
  note: string;
}

/**
 * Sugestão conservadora de IE/IM a partir do cartão CNPJ (BrasilAPI).
 * A Receita não publica inscrições estadual/municipal — só preenchemos quando há
 * indício forte (ex.: MEI costuma usar "ISENTO" na IE em contratos).
 */
export function suggestTaxRegistrations(result: CnpjLookupResult): TaxRegistrationSuggestion {
  const note =
    'Inscrição Estadual e Municipal não constam na consulta CNPJ da Receita. Confira no portal da SEFAZ e da prefeitura.';

  if (result.mei_optant === true) {
    return {
      state_registration: 'ISENTO',
      municipal_registration: null,
      note: `${note} Para MEI, a IE costuma ser "ISENTO" — confirme com seu contador.`,
    };
  }

  return {
    state_registration: null,
    municipal_registration: null,
    note,
  };
}

export class CnpjLookupError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID' | 'NOT_FOUND' | 'NETWORK' | 'STATUS'
  ) {
    super(message);
    this.name = 'CnpjLookupError';
  }
}

const UA = { 'User-Agent': 'vectra-cargo (cnpj-lookup; +https://vectracargo.com.br)' };
const PROVIDER_TIMEOUT_MS = 5000; // resposta normal < 1 s; pior caso ~10 s com 2 provedores pendurados

/** Falha de um provedor: 'not_found' (404) ou 'unavailable' (rede, timeout, 5xx, 429…). */
class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly kind: 'not_found' | 'unavailable',
    detail: string
  ) {
    super(`${provider}: ${detail}`);
  }
}

async function fetchJson(provider: string, url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  let res: Response;
  try {
    // BrasilAPI bloqueia o User-Agent default do undici (Node fetch) com 403.
    // No browser este header nao tem efeito (forbidden header).
    res = await fetch(url, { headers: UA, signal: ctrl.signal });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'AbortError';
    throw new ProviderError(provider, 'unavailable', timedOut ? 'timeout' : String(e));
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) throw new ProviderError(provider, 'not_found', 'status 404');
  if (!res.ok) throw new ProviderError(provider, 'unavailable', `status ${res.status}`);
  return res.json();
}

interface CnpjWsNamed {
  id?: string | number;
  descricao?: string;
  nome?: string;
  sigla?: string;
}

interface CnpjWs {
  razao_social?: string;
  capital_social?: string | number;
  responsavel_federativo?: string;
  porte?: CnpjWsNamed | null;
  natureza_juridica?: CnpjWsNamed | null;
  simples?: { simples?: string | null; mei?: string | null } | null;
  socios?: {
    nome?: string;
    cpf_cnpj_socio?: string;
    data_entrada?: string;
    faixa_etaria?: string;
    qualificacao_socio?: CnpjWsNamed | null;
    pais?: CnpjWsNamed | null;
  }[];
  estabelecimento?: {
    cnpj?: string;
    nome_fantasia?: string;
    email?: string;
    ddd1?: string;
    telefone1?: string;
    ddd2?: string;
    telefone2?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    cidade?: CnpjWsNamed | null;
    estado?: CnpjWsNamed | null;
    situacao_cadastral?: string;
    data_situacao_cadastral?: string;
    data_inicio_atividade?: string;
    motivo_situacao_cadastral?: CnpjWsNamed | null;
    atividade_principal?: CnpjWsNamed | null;
    atividades_secundarias?: CnpjWsNamed[];
  } | null;
}

const simNao = (v: unknown): boolean | null =>
  v === 'Sim' ? true : v === 'Não' || v === 'Nao' ? false : null;

/** Converte publica.cnpj.ws para o shape BrasilAPI (mesmo normalize). */
export function cnpjWsToBrasilApi(d: CnpjWs): BrasilApiCnpj {
  const e = d.estabelecimento ?? {};
  const phone = (ddd?: string, tel?: string) => (tel ? `${ddd ?? ''}${tel}` : undefined);
  const street = [e.tipo_logradouro, e.logradouro].filter(Boolean).join(' ');
  return {
    cnpj: e.cnpj,
    razao_social: d.razao_social,
    nome_fantasia: e.nome_fantasia,
    email: e.email,
    ddd_telefone_1: phone(e.ddd1, e.telefone1),
    ddd_telefone_2: phone(e.ddd2, e.telefone2),
    logradouro: street || undefined,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cep: e.cep,
    municipio: e.cidade?.nome,
    uf: e.estado?.sigla,
    natureza_juridica: d.natureza_juridica?.descricao,
    codigo_natureza_juridica: d.natureza_juridica?.id,
    descricao_porte: d.porte?.descricao,
    data_inicio_atividade: e.data_inicio_atividade,
    descricao_situacao_cadastral: e.situacao_cadastral,
    data_situacao_cadastral: e.data_situacao_cadastral,
    motivo_situacao_cadastral: e.motivo_situacao_cadastral?.descricao,
    ente_federativo_responsavel: d.responsavel_federativo,
    cnae_fiscal: e.atividade_principal?.id,
    cnae_fiscal_descricao: e.atividade_principal?.descricao,
    cnaes_secundarios: (e.atividades_secundarias ?? []).map((a) => ({
      codigo: a.id,
      descricao: a.descricao,
    })),
    capital_social: d.capital_social,
    qsa: (d.socios ?? []).map((s) => ({
      nome_socio: s.nome,
      qualificacao_socio: s.qualificacao_socio?.descricao?.trim(),
      codigo_qualificacao_socio: s.qualificacao_socio?.id,
      cnpj_cpf_do_socio: s.cpf_cnpj_socio,
      data_entrada_sociedade: s.data_entrada,
      pais: s.pais?.nome,
      faixa_etaria: s.faixa_etaria,
    })),
    opcao_pelo_simples: simNao(d.simples?.simples),
    opcao_pelo_mei: simNao(d.simples?.mei),
  };
}

/**
 * Cadeia de provedores. BrasilAPI e minhareceita.org compartilham a mesma base
 * (BrasilAPI faz proxy do minhareceita) — quando um cai, o outro costuma cair junto.
 * publica.cnpj.ws é base independente (CORS liberado; limite 3 req/min por IP).
 */
const PROVIDERS: { name: string; fetch: (cnpj: string) => Promise<BrasilApiCnpj> }[] = [
  {
    name: 'BrasilAPI',
    fetch: async (cnpj) =>
      (await fetchJson(
        'BrasilAPI',
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
      )) as BrasilApiCnpj,
  },
  {
    name: 'minhareceita',
    fetch: async (cnpj) =>
      (await fetchJson('minhareceita', `https://minhareceita.org/${cnpj}`)) as BrasilApiCnpj,
  },
  {
    name: 'CNPJ.ws',
    fetch: async (cnpj) =>
      cnpjWsToBrasilApi(
        (await fetchJson('CNPJ.ws', `https://publica.cnpj.ws/cnpj/${cnpj}`)) as CnpjWs
      ),
  },
];

/**
 * Consulta CNPJ (BrasilAPI → minhareceita.org → publica.cnpj.ws) e retorna o shape normalizado.
 * Cai para o próximo provedor em rede/timeout/5xx/429/404.
 * @throws CnpjLookupError NOT_FOUND só se todo provedor que respondeu disse 404.
 */
export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult> {
  const cnpj = sanitizeCnpj(rawCnpj);
  if (cnpj.length !== 14) {
    throw new CnpjLookupError('CNPJ deve ter 14 digitos', 'INVALID');
  }

  const failures: ProviderError[] = [];
  for (const provider of PROVIDERS) {
    try {
      return normalize(await provider.fetch(cnpj));
    } catch (e) {
      failures.push(
        e instanceof ProviderError ? e : new ProviderError(provider.name, 'unavailable', String(e))
      );
    }
  }

  const answered = failures.filter((f) => f.kind === 'not_found');
  if (answered.length > 0 && answered.length === failures.length) {
    throw new CnpjLookupError('CNPJ nao encontrado na base da Receita Federal', 'NOT_FOUND');
  }
  if (answered.length > 0) {
    throw new CnpjLookupError(
      `CNPJ nao encontrado (${failures.map((f) => f.message).join('; ')})`,
      'NOT_FOUND'
    );
  }
  throw new CnpjLookupError(
    `Serviços de consulta CNPJ indisponíveis no momento — preencha manualmente ou tente em alguns minutos (${failures
      .map((f) => f.message)
      .join('; ')})`,
    'NETWORK'
  );
}

/**
 * Identifica o socio mais provavel para ser representante legal:
 * preferencia para qualificacoes que contenham "Administrador" / "Diretor" / "Socio".
 * Se houver multiplos, retorna o primeiro.
 */
export function pickLegalRepresentative(partners: CnpjPartner[]): CnpjPartner | null {
  if (!partners.length) return null;

  const adminPatterns = [/administrador/i, /diretor/i, /presidente/i];
  const partnerPatterns = [/s[oó]cio/i];

  for (const patterns of [adminPatterns, partnerPatterns]) {
    const found = partners.find((p) => p.role && patterns.some((rx) => rx.test(p.role!)));
    if (found) return found;
  }
  return partners[0] ?? null;
}
