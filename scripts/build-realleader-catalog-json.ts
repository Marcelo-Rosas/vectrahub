/**
 * Curadoria catálogo Realleader (2015 + 2025) → JSON estruturado.
 *
 *   npx tsx scripts/build-realleader-catalog-json.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();

type CatalogSource = {
  id: 'realleader_2025' | 'realleader_2015';
  title: string;
  sourceUrl: string;
  edition?: string;
  markdownPath: string;
};

type RealleaderProduct = {
  sku: string;
  name: string;
  line: string;
  category:
    | 'cardio'
    | 'plate_loaded'
    | 'pin_loaded'
    | 'dual_function'
    | 'functional'
    | 'benches_racks'
    | 'accessories'
    | 'other';
  specs: Record<string, string | number | null>;
  dimensions: {
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
    length_in: number | null;
    width_in: number | null;
    height_in: number | null;
  };
  weights: {
    net_kg: number | null;
    net_lb: number | null;
    gross_kg: number | null;
    gross_lb: number | null;
    stack_kg: number | null;
    stack_lb: number | null;
  };
  rawText: string;
};

type RealleaderCatalogExport = {
  schemaVersion: 1;
  generatedAt: string;
  catalogs: Array<{
    source: CatalogSource['id'];
    title: string;
    sourceUrl: string;
    edition?: string;
    lines: Array<{
      line: string;
      category: string;
      productCount: number;
      products: RealleaderProduct[];
    }>;
    summary: { totalProducts: number; lines: string[] };
  }>;
};

const SOURCES: CatalogSource[] = [
  {
    id: 'realleader_2025',
    title: 'Realleader Catalog 2025',
    sourceUrl:
      'https://iprorwxhjinjlq5q.ldycdn.com/Catalog_Realleader_2025-aidnlBpnKrjRllSiknkrklpi.pdf?dp=GvUApKfKKUAU',
    markdownPath: join(
      root,
      '../.cursor/projects/c-Users-marce-vectra-hub/uploads/Catalog_Realleader_2025-aidnlBpnKrjRllSiknkrklpi.pdf-0.md'
    ),
  },
  {
    id: 'realleader_2015',
    title: 'Realleader Catalog 2015',
    sourceUrl:
      'https://jmrorwxhjinjlq5q.ldycdn.com/Realleader_2015-aidnrBpnKrjRllSiknklklri.pdf?dp=GvUApKfKKUAU',
    edition: '2005 Edition',
    markdownPath: join(
      root,
      '../.cursor/projects/c-Users-marce-vectra-hub/uploads/Realleader_2015-aidnrBpnKrjRllSiknklklri.pdf-1.md'
    ),
  },
];

const LINE_HEADERS = new Set([
  'CARDIO LINE',
  'CARDIO',
  'LD LINE',
  'M7PRO LINE',
  'M3 LINE',
  'M2 LINE',
  'M2-LINE',
  'PF LINE',
  'RS LINE',
  'FM LINE',
  'FW LINE',
  'FW: LINE',
  'FW-LINE',
  'ACCESSORIES',
  'LINES',
]);

const SKU_RE =
  /^(?:#\s*)?((?:M7PRO|M3|M2|LD|PF|FM|FW|RCT|RSB|RS|RE|CE800\+|CR800\+|CU800\+|SBC900|S\d{2,4})[-:]?\d[\dA-Z]*(?:[A-Z])?)(?:\s+(.*))?$/i;

const LINE_FROM_SKU: Record<string, { line: string; category: RealleaderProduct['category'] }> = {
  RCT: { line: 'CARDIO', category: 'cardio' },
  RS: { line: 'CARDIO', category: 'cardio' },
  RSB: { line: 'CARDIO', category: 'cardio' },
  RE: { line: 'CARDIO', category: 'cardio' },
  CE: { line: 'CARDIO', category: 'cardio' },
  CR: { line: 'CARDIO', category: 'cardio' },
  CU: { line: 'CARDIO', category: 'cardio' },
  SBC: { line: 'CARDIO', category: 'cardio' },
  S: { line: 'CARDIO', category: 'cardio' },
  LD: { line: 'LD', category: 'plate_loaded' },
  M7PRO: { line: 'M7PRO', category: 'pin_loaded' },
  M3: { line: 'M3', category: 'pin_loaded' },
  M2: { line: 'M2', category: 'pin_loaded' },
  PF: { line: 'PF', category: 'dual_function' },
  FM: { line: 'FM', category: 'functional' },
  FW: { line: 'FW', category: 'benches_racks' },
  OK: { line: 'ACCESSORIES', category: 'accessories' },
  GL: { line: 'ACCESSORIES', category: 'accessories' },
};

function normalizeSku(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^M2-+/, 'M2-')
    .replace(/^LD:/, 'LD-')
    .replace(/^FW:/, 'FW-');
}

function skuPrefix(sku: string): string {
  if (sku.startsWith('M7PRO-')) return 'M7PRO';
  if (sku.startsWith('RSB-')) return 'RSB';
  if (/^S\d/.test(sku)) return 'S';
  const m = sku.match(/^([A-Z0-9]+)-/);
  return m?.[1]?.replace(/\d.*/, '') ?? sku.split('-')[0]!;
}

function parseSkuLine(line: string): { sku: string; nameTail: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '---') return null;
  const m = trimmed.match(SKU_RE);
  if (!m) return null;
  const sku = normalizeSku(m[1]!);
  if (LINE_HEADERS.has(sku) || LINE_HEADERS.has(`${sku} LINE`)) return null;
  return { sku, nameTail: (m[2] ?? '').trim() };
}

function parseDualMeasure(line: string): { primary: string; secondary?: string } {
  const parts = line.split('/').map((p) => p.trim());
  return { primary: parts[0] ?? line, secondary: parts[1] };
}

function extractNumbers(text: string): number[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => Number(m[1]!.replace(',', '.')));
}

function parseDimensionTriple(line: string): { mm?: number[]; in?: number[] } {
  const lower = line.toLowerCase();
  const nums = extractNumbers(line);
  if (nums.length < 3) return {};
  const triple = nums.slice(0, 3);
  if (lower.includes('mm') || triple[0]! > 400) return { mm: triple };
  if (lower.includes('in')) return { in: triple };
  if (triple[0]! < 400) return { in: triple };
  return { mm: triple };
}

function parseWeightPair(line: string): Partial<RealleaderProduct['weights']> {
  const out: Partial<RealleaderProduct['weights']> = {};
  const lower = line.toLowerCase();

  const stack = line.match(/weight\s*stack\s*:?\s*([^/\n]+(?:\/[^/\n]+)?)/i);
  if (stack) {
    const nums = extractNumbers(stack[1]!);
    if (stack[1]!.toLowerCase().includes('kg')) {
      out.stack_kg = nums[0] ?? null;
      out.stack_lb = nums[1] ?? null;
    } else {
      out.stack_lb = nums[0] ?? null;
      out.stack_kg = nums[1] ?? null;
    }
  }

  const nwGw =
    line.match(/N\.?\s*W\.?\s*:?\s*([^/G]+)(?:\/\s*G\.?\s*W\.?\s*:?\s*(.+))?/i) ??
    line.match(/N\.?\s*W\.?\s*\/\s*G\.?\s*W\.?\s*:?\s*(.+)/i);
  if (nwGw) {
    const chunk = nwGw[0];
    const nums = extractNumbers(chunk);
    if (chunk.toLowerCase().includes('kg')) {
      out.net_kg = nums[0] ?? null;
      out.gross_kg = nums[1] ?? nums[0] ?? null;
      out.net_lb = nums[2] ?? null;
      out.gross_lb = nums[3] ?? null;
    } else {
      out.net_lb = nums[0] ?? null;
      out.gross_lb = nums[1] ?? nums[0] ?? null;
      out.net_kg = nums[2] ?? null;
      out.gross_kg = nums[3] ?? null;
    }
  }

  if (lower.includes('g.w') && !nwGw) {
    const nums = extractNumbers(line);
    if (lower.includes('kg')) {
      out.gross_kg = nums[0] ?? null;
      out.net_kg = nums[1] ?? null;
    }
  }

  return out;
}

function parseSpecsBlock(lines: string[]): Omit<RealleaderProduct, 'sku' | 'line' | 'category'> {
  const nameParts: string[] = [];
  const specs: Record<string, string | number | null> = {};
  const dimensions = {
    length_mm: null as number | null,
    width_mm: null as number | null,
    height_mm: null as number | null,
    length_in: null as number | null,
    width_in: null as number | null,
    height_in: null as number | null,
  };
  const weights: RealleaderProduct['weights'] = {
    net_kg: null,
    net_lb: null,
    gross_kg: null,
    gross_lb: null,
    stack_kg: null,
    stack_lb: null,
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }

    const keyVal = line.match(/^([^:]{3,80}):\s*(.+)$/);
    if (keyVal && !/^dimensions?$/i.test(keyVal[1]!)) {
      const key = keyVal[1]!
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      specs[key] = keyVal[2]!.trim();
      i++;
      continue;
    }

    if (/^dimensions?:?\s+/i.test(line)) {
      const inline = line.replace(/^dimensions?:?\s+/i, '').trim();
      if (inline) {
        const parsed = parseDimensionTriple(inline);
        if (parsed.in) {
          dimensions.length_in = parsed.in[0] ?? dimensions.length_in;
          dimensions.width_in = parsed.in[1] ?? dimensions.width_in;
          dimensions.height_in = parsed.in[2] ?? dimensions.height_in;
        }
        if (parsed.mm) {
          dimensions.length_mm = parsed.mm[0] ?? dimensions.length_mm;
          dimensions.width_mm = parsed.mm[1] ?? dimensions.width_mm;
          dimensions.height_mm = parsed.mm[2] ?? dimensions.height_mm;
        }
      }
      i++;
      continue;
    }

    if (/^dimensions?:?$/i.test(line)) {
      i++;
      const dimLines: string[] = [];
      while (i < lines.length && lines[i]!.trim() && !lines[i]!.includes(':')) {
        dimLines.push(lines[i]!.trim());
        i++;
      }
      for (const dl of dimLines) {
        const parsed = parseDimensionTriple(dl);
        if (parsed.in) {
          dimensions.length_in = parsed.in[0] ?? dimensions.length_in;
          dimensions.width_in = parsed.in[1] ?? dimensions.width_in;
          dimensions.height_in = parsed.in[2] ?? dimensions.height_in;
        }
        if (parsed.mm) {
          dimensions.length_mm = parsed.mm[0] ?? dimensions.length_mm;
          dimensions.width_mm = parsed.mm[1] ?? dimensions.width_mm;
          dimensions.height_mm = parsed.mm[2] ?? dimensions.height_mm;
        }
      }
      continue;
    }

    if (/^dimension:?/i.test(line)) {
      const rest = line.replace(/^dimension:?/i, '').trim();
      if (rest) {
        const parsed = parseDimensionTriple(rest);
        if (parsed.mm) {
          dimensions.length_mm = parsed.mm[0] ?? null;
          dimensions.width_mm = parsed.mm[1] ?? null;
          dimensions.height_mm = parsed.mm[2] ?? null;
        }
      }
      i++;
      if (i < lines.length) {
        const parsed = parseDimensionTriple(lines[i]!);
        if (parsed.in) {
          dimensions.length_in = parsed.in[0] ?? null;
          dimensions.width_in = parsed.in[1] ?? null;
          dimensions.height_in = parsed.in[2] ?? null;
        }
      }
      i++;
      continue;
    }

    if (/^N\.?\s*W|^G\.?\s*W|weight\s*stack|N\.W\/G\.W/i.test(line)) {
      Object.assign(weights, parseWeightPair(line));
      if (/^N\.?\s*W\.?\s*:?\s*[\d.,]+\s*lbs/i.test(line) && !weights.net_lb) {
        weights.net_lb = extractNumbers(line)[0] ?? null;
      }
      if (/G\.?\s*W\.?\s*:?\s*[\d.,]+\s*lbs/i.test(line) || /^G\.?\s*W\s+\d/i.test(line)) {
        const nums = extractNumbers(line);
        weights.gross_lb = nums[nums.length > 1 ? 1 : 0] ?? weights.gross_lb;
      }
      i++;
      continue;
    }

    if (/^(COMMERCIAL|TREADMILL|STAIR|BIKE|SPINNING|RECUMBENT|UPRIGHT|ELLIPTICAL)/i.test(line)) {
      nameParts.push(line);
      i++;
      continue;
    }

    if (!/^[0-9/]/.test(line) && line.length < 80 && !line.includes(':')) {
      nameParts.push(line);
    } else if (line.includes(':')) {
      const kv = line.match(/^([^:]{3,60}):\s*(.+)$/);
      if (kv) {
        const key = kv[1]!
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
        specs[key] = kv[2]!.trim();
      }
    }

    i++;
  }

  const name = nameParts
    .filter((p) => !/^(Manual P|self-defined|which have|5 program)/i.test(p))
    .slice(0, 4)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    name: name || nameParts[0] || '',
    specs,
    dimensions,
    weights,
    rawText: lines.join('\n').trim(),
  };
}

function detectLineFromHeader(line: string): string | null {
  const norm = line
    .replace(/^#+\s*/, '')
    .replace(':', '')
    .trim()
    .toUpperCase();
  if (LINE_HEADERS.has(norm)) {
    return norm.replace(' LINE', '').replace('-LINE', '').replace(':', '').trim();
  }
  if (/^(CARDIO|LD|M7PRO|M3|M2|PF|RS|FM|FW|ACCESSORIES)\s*LINE$/i.test(norm)) {
    return norm.replace(/\s*LINE$/i, '').trim();
  }
  return null;
}

function parseCatalogMarkdown(text: string, sourceId: CatalogSource['id']): RealleaderProduct[] {
  const lines = text.split(/\r?\n/);
  const products: RealleaderProduct[] = [];
  let currentLine = 'OTHER';
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const headerLine = detectLineFromHeader(raw.trim());
    if (headerLine) {
      currentLine = headerLine;
      i++;
      continue;
    }

    const skuHit = parseSkuLine(raw);
    if (!skuHit) {
      i++;
      continue;
    }

    const block: string[] = [];
    if (skuHit.nameTail) block.push(skuHit.nameTail);
    i++;

    while (i < lines.length) {
      const next = lines[i]!;
      if (next.trim() === '---') break;
      if (detectLineFromHeader(next.trim())) break;
      if (parseSkuLine(next)) break;
      block.push(next);
      i++;
    }

    const parsed = parseSpecsBlock(block);
    const prefix = skuPrefix(skuHit.sku);
    const mapping = LINE_FROM_SKU[prefix] ?? { line: currentLine, category: 'other' as const };
    const line = mapping.line === 'CARDIO' && currentLine !== 'CARDIO' ? currentLine : mapping.line;
    const category = currentLine === 'ACCESSORIES' ? 'accessories' : mapping.category;

    products.push({
      sku: skuHit.sku,
      line: line || currentLine,
      category,
      ...parsed,
      name: parsed.name || skuHit.nameTail || skuHit.sku,
    });
  }

  // dedupe by sku — keep richer entry
  const bySku = new Map<string, RealleaderProduct>();
  for (const p of products) {
    const prev = bySku.get(p.sku);
    if (!prev || p.rawText.length > prev.rawText.length) bySku.set(p.sku, p);
  }

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

function groupByLine(products: RealleaderProduct[]) {
  const map = new Map<string, RealleaderProduct[]>();
  for (const p of products) {
    const key = p.line;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([line, prods]) => ({
      line,
      category: prods[0]?.category ?? 'other',
      productCount: prods.length,
      products: prods.sort((a, b) => a.sku.localeCompare(b.sku)),
    }));
}

function main() {
  const catalogs: RealleaderCatalogExport['catalogs'] = [];

  for (const src of SOURCES) {
    const text = readFileSync(src.markdownPath, 'utf8');
    const products = parseCatalogMarkdown(text, src.id);
    const lines = groupByLine(products);
    catalogs.push({
      source: src.id,
      title: src.title,
      sourceUrl: src.sourceUrl,
      edition: src.edition,
      lines,
      summary: {
        totalProducts: products.length,
        lines: lines.map((l) => l.line),
      },
    });
    console.log(
      `${src.id}: ${products.length} produtos, linhas: ${lines.map((l) => `${l.line}(${l.productCount})`).join(', ')}`
    );
  }

  const payload: RealleaderCatalogExport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    catalogs,
  };

  const outPath = join(root, 'docs/homolog/realleader-catalog-curated.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log('wrote', outPath);
}

main();
