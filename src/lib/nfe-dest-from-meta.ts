/**
 * Paridade com supabase/functions/_shared/nfe-dest-from-meta.ts.
 * Destinatário da NF-e a partir de validation_metadata / XML.
 * Chave 44 dígitos sozinha NÃO tem dest — precisa XML, SEFAZ aninhado ou flatten.
 */

export type NfeDestParty = {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  state_registration: string | null;
  ie_indicator: number;
  ibge_code: number | null;
  address: string;
  address_number: string;
  address_complement: string | null;
  address_neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string | null;
};

function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

function isRec(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function tagIn(block: string, tag: string): string {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${tag}>`, 'i');
  return block.match(re)?.[1]?.trim() ?? '';
}

/** Extrai bloco <dest> (com namespace) e campos de endereço. */
export function extractDestFromNfeXml(xml: string): Record<string, string> {
  const destMatch = xml.match(/<(?:\w+:)?dest\b[\s\S]*?<\/(?:\w+:)?dest>/i);
  if (!destMatch) return {};
  const dest = destMatch[0];
  const ender = dest.match(/<(?:\w+:)?enderDest\b[\s\S]*?<\/(?:\w+:)?enderDest>/i)?.[0] ?? dest;
  const nome = tagIn(dest, 'xNome');
  const cnpj = digits(tagIn(dest, 'CNPJ'));
  const cpf = digits(tagIn(dest, 'CPF'));
  const ie = tagIn(dest, 'IE');
  const out: Record<string, string> = {};
  if (nome) out.destinatario_nome = nome;
  if (cnpj.length === 14) out.destinatario_cnpj = cnpj;
  if (cpf.length === 11) out.destinatario_cpf = cpf;
  if (ie) out.destinatario_ie = ie;
  const lgr = tagIn(ender, 'xLgr');
  const nro = tagIn(ender, 'nro');
  const bairro = tagIn(ender, 'xBairro');
  const mun = tagIn(ender, 'xMun');
  const uf = tagIn(ender, 'UF');
  const cep = digits(tagIn(ender, 'CEP'));
  const cmun = digits(tagIn(ender, 'cMun'));
  const fone = digits(tagIn(ender, 'fone') || tagIn(dest, 'fone'));
  if (lgr) out.endereco = lgr;
  if (nro) out.numero = nro;
  if (bairro) out.bairro = bairro;
  if (mun) out.cidade = mun;
  if (uf) out.uf = uf.toUpperCase();
  if (cep) out.cep = cep;
  if (cmun.length === 7) out.cmun = cmun;
  if (fone) out.telefone = fone;
  return out;
}

/**
 * Sobe dest de sefaz / xml_data / aliases para o topo do metadata.
 * Não inventa nome — só copia o que já existe.
 */
export function mergeNfeDestIntoMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const sefaz = isRec(meta.sefaz) ? meta.sefaz : {};
  const xmlData = isRec(meta.xml_data) ? meta.xml_data : {};
  const fromXml = typeof meta.xml === 'string' ? extractDestFromNfeXml(meta.xml) : {};

  const nome = firstNonEmpty(
    meta.destinatario_nome,
    meta.nome_destinatario,
    sefaz.destinatario_nome,
    sefaz.nome_destinatario,
    xmlData.destinatario_nome,
    fromXml.destinatario_nome
  );
  const cnpj = firstNonEmpty(
    meta.destinatario_cnpj,
    meta.cnpj_destinatario,
    sefaz.destinatario_cnpj,
    sefaz.cnpj_destinatario,
    xmlData.destinatario_cnpj,
    fromXml.destinatario_cnpj
  );
  const cpf = firstNonEmpty(
    meta.destinatario_cpf,
    meta.cpf_destinatario,
    sefaz.destinatario_cpf,
    xmlData.destinatario_cpf,
    fromXml.destinatario_cpf
  );

  const ie = firstNonEmpty(
    meta.destinatario_ie,
    sefaz.destinatario_ie,
    xmlData.destinatario_ie,
    fromXml.destinatario_ie
  );
  const endereco = firstNonEmpty(meta.endereco, sefaz.endereco, xmlData.endereco, fromXml.endereco);
  const numero = firstNonEmpty(meta.numero, xmlData.numero, fromXml.numero);
  const bairro = firstNonEmpty(meta.bairro, xmlData.bairro, fromXml.bairro);
  const cidade = firstNonEmpty(meta.cidade, sefaz.cidade, xmlData.cidade, fromXml.cidade);
  const uf = firstNonEmpty(meta.uf, sefaz.uf, xmlData.uf, fromXml.uf);
  const cep = firstNonEmpty(meta.cep, sefaz.cep, xmlData.cep, fromXml.cep);
  const cmun = firstNonEmpty(meta.cmun, xmlData.cmun, fromXml.cmun);
  const telefone = firstNonEmpty(meta.telefone, xmlData.telefone, fromXml.telefone);

  return {
    ...meta,
    ...(nome ? { destinatario_nome: nome } : {}),
    ...(cnpj ? { destinatario_cnpj: cnpj } : {}),
    ...(cpf ? { destinatario_cpf: cpf } : {}),
    ...(ie ? { destinatario_ie: ie } : {}),
    ...(endereco ? { endereco } : {}),
    ...(numero ? { numero } : {}),
    ...(bairro ? { bairro } : {}),
    ...(cidade ? { cidade } : {}),
    ...(uf ? { uf } : {}),
    ...(cep ? { cep } : {}),
    ...(cmun ? { cmun } : {}),
    ...(telefone ? { telefone } : {}),
  };
}

export function partyFromNfeMeta(
  meta: Record<string, unknown>,
  nfeKey: string
): NfeDestParty | null {
  const flat = mergeNfeDestIntoMetadata(meta);
  const name = String(flat.destinatario_nome ?? '').trim();
  if (!name) return null;
  const cnpj = digits(flat.destinatario_cnpj);
  const cpf = digits(flat.destinatario_cpf);
  const ieRaw = flat.destinatario_ie ? String(flat.destinatario_ie).trim() : '';
  const ieDigits = digits(ieRaw);
  let ieIndicator = Number(flat.destinatario_ie_indicator ?? 0);
  if (!ieIndicator) {
    if (ieDigits.length >= 8) ieIndicator = 1;
    else if (/^isento$/i.test(ieRaw)) ieIndicator = 2;
    else ieIndicator = 9;
  }
  return {
    id: `nfe-${nfeKey.slice(-12)}`,
    name,
    cnpj: cnpj.length === 14 ? cnpj : null,
    cpf: cpf.length === 11 ? cpf : null,
    state_registration: ieRaw || null,
    ie_indicator: ieIndicator,
    ibge_code: digits(flat.cmun).length === 7 ? Number(digits(flat.cmun)) : null,
    address: flat.endereco ? String(flat.endereco) : '',
    address_number: flat.numero ? String(flat.numero) : 'S/N',
    address_complement: flat.complemento ? String(flat.complemento) : null,
    address_neighborhood: flat.bairro ? String(flat.bairro) : '',
    city: flat.cidade ? String(flat.cidade) : '',
    state: flat.uf ? String(flat.uf).toUpperCase() : '',
    zip_code: digits(flat.cep),
    phone: digits(flat.telefone) || null,
  };
}
