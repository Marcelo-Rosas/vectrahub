/** Parser determinístico para orçamentos Konnen (PDF Clicksign). */

export type KonnenClientDraft = {
  document: string;
  name: string;
  zipCode: string;
  city: string;
  state: string;
  address: string;
  email: string;
};

export type KonnenLineDraft = {
  sku: string;
  quantity: number;
  /** Peso adicional/stack no nome PDF (ex. 134 = 295 lb). */
  stackWeightKg?: number;
};

export type KonnenParseResult = {
  client: KonnenClientDraft;
  cargoValue: number;
  lines: KonnenLineDraft[];
  orderNo: string;
};

const SKU_PREFIX_RE = /^([A-Z0-9][A-Z0-9.-]{0,28})\b/;

/** Padrões reais de SKU Konnen — evita palavras de descrição (BENCH, CURL, etc.). */
const KONNEN_SKU_RE =
  /^(?:IF[A-Z0-9]{2,}(?:-[A-Z0-9]+)*|IT\d+[A-Z0-9-]*|TM\d+[A-Z0-9-]*|TN\d+[A-Z0-9-]*|TB\d+[A-Z0-9-]*|E\d+[A-Z0-9-]*|ECE\d+|R\d+|PS\d+|HB\d+|HSR\d+|BRTW-\d+(?:\.\d+)?|RKC\d{2}[A-Z0-9-]+(?:-[A-Z0-9]+)*|P6111-\d{2}[A-Z]|AB\d+[A-Z0-9.,-]*|IFFT|IFCC)$/i;

function dedupeDoubledLine(line: string): string {
  const t = line.trim();
  if (t.length >= 4 && t.length % 2 === 0) {
    const half = t.length / 2;
    if (t.slice(0, half) === t.slice(half)) return t.slice(0, half);
  }
  return t;
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => dedupeDoubledLine(line))
    .map((line) => line.trim());
}

/** Remove páginas/rodapé Clicksign e blocos repetidos de cabeçalho Konnen. */
export function stripKonnenNoise(text: string): string {
  const markers = [
    /Condições Comerciais:/i,
    /Documento assinado com validade jurídica/i,
    /Documento número\s*#/i,
    /8144_[^\n]+\.pdf/i,
    /MEDIDA PROVISÓRIA No 2\.200-2/i,
  ];
  let end = text.length;
  for (const re of markers) {
    const idx = text.search(re);
    if (idx >= 0 && idx < end) end = idx;
  }
  let cleaned = text.slice(0, end).replace(/--- PAGE ---/g, '\n');

  const footerLine =
    /^(FOR FITNESS|PARA GINÁSTICA EM GERAL|15\.563\.385\/0001-72|Rod\. Jorge Lacerda|ITAJAÍ|CEP 88\.317-100|www\.konnenfitness\.com\.br|Tel:|E-E-|mail:|Consultor:|Clicksign\s+[0-9a-f-]{36})/i;

  cleaned = cleaned
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (footerLine.test(t)) return false;
      if (/Clicksign\s+[0-9a-f-]{36}/i.test(t)) return false;
      return true;
    })
    .join('\n');

  cleaned = cleaned.replace(/Clicksign\s+[0-9a-f-]{36}/gi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trimEnd() + '\n';
}

/** Junta SKU partido por hífen no fim da linha (ex.: RKC01UDB- + S780). */
export function joinHyphenSplitLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    if (prev && prev.endsWith('-')) {
      const head = line.split(/\s+/)[0] ?? '';
      if (/^\d[\d,]*M?$/i.test(head) && /^AB\d/i.test(prev)) {
        out[out.length - 1] = prev + head;
        const rest = line.slice(head.length).trim();
        if (rest) out.push(rest);
        continue;
      }
      if (/^[A-Z0-9][A-Z0-9-]*$/i.test(line) && line.length <= 12) {
        out[out.length - 1] = prev + line;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

function parseBrazilianMoney(value: string): number | null {
  const m = value.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!m) return null;
  const normalized = m[1].replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function parseKonnenOrderNo(text: string): string {
  const m = text.match(/ORÇAMENTO Nº\s*([\d.]+)/i);
  if (!m) return '';
  let raw = m[1];
  if (raw.length >= 4 && raw.length % 2 === 0) {
    const half = raw.length / 2;
    if (raw.slice(0, half) === raw.slice(half)) raw = raw.slice(0, half);
  }
  return digitsOnly(raw);
}

export function parseKonnenClient(text: string): KonnenClientDraft {
  const flat = normalizeLines(stripKonnenNoise(text)).join('\n');

  const name = flat.match(/Razão Social:\s*(.+?)(?:\n|Nome Fantasia)/i)?.[1]?.trim() ?? '';

  const docZip = flat.match(/CNPJ\s*\/\s*CPF:\s*([0-9./-]+)\s*\/\s*CEP:\s*([0-9-]+)/i) ?? [];
  const document = digitsOnly(docZip[1] ?? '');
  const zipCode = digitsOnly(docZip[2] ?? '');

  const address = flat.match(/Endereço:\s*(.+?)(?:\n|Bairro)/i)?.[1]?.trim() ?? '';

  const cityState = flat.match(/Cidade\s*\/\s*Estado:\s*(.+?)\s*\/\s*([A-Z]{2})/i) ?? [];
  const city = cityState[1]?.trim() ?? '';
  const state = (cityState[2] ?? '').trim().toUpperCase();

  const email =
    flat
      .match(/E-mail:\s*(\S+@\S+)/i)?.[1]
      ?.trim()
      .toLowerCase() ?? '';

  return { document, name, zipCode, city, state, address, email };
}

export function parseKonnenCargoValue(text: string): number {
  const cleaned = stripKonnenNoise(text);
  const m = cleaned.match(/Total do Orçamento:[\s\S]{0,80}?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (m) {
    const v = parseBrazilianMoney(m[1]);
    if (v != null) return v;
  }
  const fallback = cleaned.match(/Total dos produtos[\s\S]{0,120}?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (fallback) {
    const v = parseBrazilianMoney(fallback[1]);
    if (v != null) return v;
  }
  return 0;
}

function isValidSku(sku: string): boolean {
  const s = sku.trim().toUpperCase();
  if (s.length < 2 || s.length > 30) return false;
  if (s.endsWith('-')) return false;
  if (/^[0-9a-f]{8,}$/i.test(s)) return false;
  if (/^(CLICKSIGN|CONSULTOR|MAIL|TEL|ITAJA|FOR|CEP|WWW|OBSERVA|CONDI)/i.test(s)) {
    return false;
  }
  return KONNEN_SKU_RE.test(s);
}

const HEADER_LINE_RE =
  /^(Código|Nome|Imagem|Prazo|entrega|Valor Unit|QTD|Desconto|Subtotal|DADOS DO CLIENTE|ORÇAMENTO|DATA DE FECHAMENTO|Razão Social|Nome Fantasia|CNPJ|Endereço|Bairro|Telefone|E-mail|Telefone)/i;

function extractSkuFromProductBlock(block: string): string | null {
  const chunk = block
    .replace(/FOR FITNESS[\s\S]*/gi, '')
    .replace(/Consultor:[\s\S]*/gi, '')
    .replace(/Clicksign[\s\S]*/gi, '')
    .trim();
  if (!chunk) return null;

  const lines = joinHyphenSplitLines(normalizeLines(chunk)).filter(
    (l) => l.length > 0 && !HEADER_LINE_RE.test(l)
  );

  for (const line of lines) {
    const first = line.split(/\s+/)[0]?.toUpperCase() ?? '';
    if (first && first.includes(',') && isValidSku(first)) return first;

    const prefix = line.match(SKU_PREFIX_RE)?.[1]?.toUpperCase();
    if (prefix && isValidSku(prefix)) return prefix;
  }

  for (const line of lines) {
    const token = line.trim().toUpperCase();
    if (isValidSku(token)) return token;
  }

  return null;
}

/** Com "Pronta/Pronte entrega": desconto em % ou cadeia R$ (8144 antigo). */
const KONNEN_ITEM_PRONTE_RE =
  /([\s\S]*?)Pront[eoa]\s*entrega\s+R\$\s*[\d.,]+\s+(\d+)\s+(?:(?:[\d.,]+%(?:\s+R\$\s*[\d.,]+)?)|(?:R\$\s*[\d.,]+(?:\s+R\$\s*[\d.,]+)*))/gi;

/** Sem prazo na linha (10119+): exige % para não pegar bloco de pagamento. */
const KONNEN_ITEM_DIRECT_RE = /([\s\S]*?)R\$\s*[\d.,]+\s+(\d+)\s+[\d.,]+%(?:\s+R\$\s*[\d.,]+)?/gi;

function parseStackWeightKgFromBlock(block: string): number | null {
  const m = block.match(/-\s*(\d{2,3})\s*kg\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 70 || n > 300) return null;
  return n;
}

function collectKonnenLineMatches(
  joined: string,
  re: RegExp,
  bySku: Map<string, KonnenLineDraft>,
  skipIfPronteInBlock = false
): void {
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(joined)) !== null) {
    const block = match[1] ?? '';
    if (skipIfPronteInBlock && /Pront[eoa]\s*entrega/i.test(block)) continue;
    const sku = extractSkuFromProductBlock(block);
    const qty = Number(match[2]);
    if (!sku || !Number.isFinite(qty) || qty <= 0) continue;
    const stackWeightKg = parseStackWeightKgFromBlock(block) ?? undefined;
    const prev = bySku.get(sku);
    bySku.set(sku, {
      sku,
      quantity: (prev?.quantity ?? 0) + qty,
      stackWeightKg: stackWeightKg ?? prev?.stackWeightKg,
    });
  }
}

export function parseKonnenLines(text: string): KonnenLineDraft[] {
  const cleaned = stripKonnenNoise(text);
  const joined = joinHyphenSplitLines(normalizeLines(cleaned)).join('\n');

  const bySku = new Map<string, KonnenLineDraft>();
  collectKonnenLineMatches(joined, KONNEN_ITEM_PRONTE_RE, bySku);
  collectKonnenLineMatches(joined, KONNEN_ITEM_DIRECT_RE, bySku, true);

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

export function parseKonnenOrderText(text: string): KonnenParseResult {
  return {
    client: parseKonnenClient(text),
    cargoValue: parseKonnenCargoValue(text),
    lines: parseKonnenLines(text),
    orderNo: parseKonnenOrderNo(text),
  };
}

export type MatchOrderLinesResult = {
  lines: { sku: string; quantity: number; name?: string; stackWeightKg?: number }[];
  unmatched: { rawSku: string; quantity: number; hint: string }[];
};

/** Casa SKUs parseados com catálogo feira.products (uppercase). */
export function matchOrderLinesToCatalog(
  parsed: KonnenLineDraft[],
  catalogSkus: Set<string>,
  nameBySku?: Map<string, string>,
  resolveSku?: (rawSku: string, catalogSkus: Set<string>) => string | null
): MatchOrderLinesResult {
  const lines: MatchOrderLinesResult['lines'] = [];
  const unmatched: MatchOrderLinesResult['unmatched'] = [];

  for (const row of parsed) {
    const sku = row.sku.trim().toUpperCase();
    const resolved =
      (catalogSkus.has(sku) ? sku : null) ??
      (() => {
        const alt = sku.replace(/\s+/g, '');
        return alt !== sku && catalogSkus.has(alt) ? alt : null;
      })() ??
      resolveSku?.(sku, catalogSkus) ??
      null;

    if (resolved) {
      lines.push({
        sku: resolved,
        quantity: row.quantity,
        name: nameBySku?.get(resolved),
        stackWeightKg: row.stackWeightKg,
      });
      continue;
    }

    unmatched.push({
      rawSku: sku,
      quantity: row.quantity,
      hint: 'SKU não encontrado em feira.products',
    });
  }

  return { lines, unmatched };
}
