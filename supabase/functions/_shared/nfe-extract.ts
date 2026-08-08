/**
 * Extrai NCM / produto predominante de XML NF-e (ou texto DANFE PDF).
 * Usado por validate-document e emit-mdfe (SEFAZ 301 — carga lotação).
 */

export interface NfeProductLine {
  ncm: string;
  descricao: string;
  valor: number;
}

export interface NfePredominante {
  ncm: string;
  descricao: string;
  valor: number;
  itens: NfeProductLine[];
}

function digits(s: string): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Parse itens det/prod do XML NF-e; predominante = maior vProd. */
export function extractNcmFromNfeXml(xmlContent: string): NfePredominante | null {
  const itens: NfeProductLine[] = [];
  const detRe = /<det\b[^>]*>[\s\S]*?<\/det>/gi;
  let detMatch: RegExpExecArray | null;
  while ((detMatch = detRe.exec(xmlContent)) !== null) {
    const block = detMatch[0];
    const ncm = digits(block.match(/<NCM>([^<]+)<\/NCM>/i)?.[1] ?? '').slice(0, 8);
    if (ncm.length !== 8) continue;
    const descricao = (block.match(/<xProd>([^<]+)<\/xProd>/i)?.[1] ?? 'PRODUTO').trim();
    const valor = Number(block.match(/<vProd>([\d.]+)<\/vProd>/i)?.[1] ?? 0);
    itens.push({ ncm, descricao: descricao.slice(0, 120), valor });
  }

  // Fallback: tags soltas (XML minificado sem det bem formado)
  if (itens.length === 0) {
    const ncmMatches = [...xmlContent.matchAll(/<NCM>(\d{8})<\/NCM>/gi)];
    const xProdMatches = [...xmlContent.matchAll(/<xProd>([^<]+)<\/xProd>/gi)];
    const vProdMatches = [...xmlContent.matchAll(/<vProd>([\d.]+)<\/vProd>/gi)];
    for (let i = 0; i < ncmMatches.length; i++) {
      itens.push({
        ncm: ncmMatches[i][1],
        descricao: (xProdMatches[i]?.[1] ?? 'PRODUTO').trim().slice(0, 120),
        valor: Number(vProdMatches[i]?.[1] ?? 0),
      });
    }
  }

  if (itens.length === 0) return null;

  // Agrupa por NCM (soma valores) — produto predominante da carga
  const byNcm = new Map<string, { descricao: string; valor: number }>();
  for (const it of itens) {
    const prev = byNcm.get(it.ncm);
    if (!prev) {
      byNcm.set(it.ncm, { descricao: it.descricao, valor: it.valor });
    } else {
      prev.valor += it.valor;
      if (it.valor > 0 && it.descricao.length > prev.descricao.length) {
        prev.descricao = it.descricao;
      }
    }
  }

  let bestNcm = '';
  let bestDesc = '';
  let bestVal = -1;
  for (const [ncm, meta] of byNcm) {
    if (meta.valor > bestVal) {
      bestVal = meta.valor;
      bestNcm = ncm;
      bestDesc = meta.descricao;
    }
  }

  if (bestNcm.length !== 8) return null;
  return {
    ncm: bestNcm,
    descricao: bestDesc || 'CARGA GERAL',
    valor: bestVal,
    itens,
  };
}

/**
 * Heurística DANFE PDF (texto no stream): procura "NCM" próximo de 8 dígitos
 * ou códigos NCM isolados no padrão fiscal.
 */
export function extractNcmFromPdfBytes(bytes: Uint8Array): NfePredominante | null {
  const raw = new TextDecoder('latin1').decode(bytes);
  const candidates: string[] = [];

  const labeled = [...raw.matchAll(/NCM[:\s]*(\d{4}\.?\d{2}\.?\d{2}|\d{8})/gi)];
  for (const m of labeled) {
    const ncm = digits(m[1]).slice(0, 8);
    if (ncm.length === 8) candidates.push(ncm);
  }

  // DANFE às vezes embute NCM sem label em blocos de produto — evita chave 44 digitos
  if (candidates.length === 0) {
    const compact = raw.replace(/[.\s]/g, '');
    const re8 = /\d{8}/g;
    let m: RegExpExecArray | null;
    while ((m = re8.exec(compact)) !== null) {
      const ncm = m[0];
      // ignora trechos de chave (44) / CNPJ (14) — só aceita se contexto próximo tem "NCM"
      const start = Math.max(0, m.index - 40);
      const window = compact.slice(start, m.index + 8);
      if (/NCM/i.test(window)) candidates.push(ncm);
    }
  }

  if (candidates.length === 0) return null;

  // Conta frequência — NCM mais comum no DANFE
  const freq = new Map<string, number>();
  for (const n of candidates) freq.set(n, (freq.get(n) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  for (const [n, c] of freq) {
    if (c > bestCount) {
      best = n;
      bestCount = c;
    }
  }
  if (best.length !== 8) return null;
  return {
    ncm: best,
    descricao: 'CARGA GERAL',
    valor: 0,
    itens: [{ ncm: best, descricao: 'CARGA GERAL', valor: 0 }],
  };
}

export function resolveFocusNfeToken(): string | null {
  const direct = Deno.env.get('FOCUS_NFE_TOKEN');
  if (direct) return direct;
  const ambiente = (Deno.env.get('FOCUS_NFE_AMBIENTE') ?? 'homolog').toLowerCase();
  if (ambiente === 'prod' || ambiente === 'producao' || ambiente === 'production') {
    return Deno.env.get('FOCUS_NFE_TOKEN_PROD') ?? null;
  }
  return Deno.env.get('FOCUS_NFE_TOKEN_HOMOLOG') ?? Deno.env.get('FOCUS_NFE_TOKEN_PROD') ?? null;
}
