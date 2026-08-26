/**
 * Análise cobertura Medidas Buckler (Downloads) vs catálogo fixture.
 *
 *   npx tsx scripts/analyze-buckler-medidas-coverage.ts
 *   npx tsx scripts/analyze-buckler-medidas-coverage.ts "C:/Users/marce/Downloads/Medidas Buckler"
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { extractText, getDocumentProxy } from 'unpdf';
import { buildShipperProductCatalog } from '../src/lib/shipper-product-catalog.ts';
import {
  normalizeBucklerCatalogItemSku,
  resolveBucklerCatalogSku,
} from '../src/lib/buckler-catalog-sku.ts';
import fixture from '../src/lib/__tests__/fixtures/buckler-caixas-por-medida.json';
import type { ShipperCatalogRawRow } from '../src/lib/shipper-product-catalog.ts';

const root = process.cwd();
const sourceDir = process.argv[2] ?? 'C:/Users/marce/Downloads/Medidas Buckler';
const outDir = join(root, 'docs/homolog/_medidas-buckler');
mkdirSync(outDir, { recursive: true });

const SKU_RE =
  /^(6841TA|CE800\+|CR800\+|SBC900|CU800\+|RCT-\d+[A-Z]?|R11V4|B11V3|FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})/i;

const TAIL_RE = /\s+(\d+)\s+(\d+)\s+(\d+)\s+([\s\S]+?)\s+([\d.,]+)\s+([\d.,]+)\s*$/;

type ParsedProduct = {
  sku: string;
  catalogSku: string;
  name: string;
  qty: number;
  weightStacks: number;
  boxesTotal: number;
  machineBoxes: number;
  stackBoxes: number;
  grossKg: number;
  cbm: number;
  boxTypes: string[];
  source: string;
};

function parseNum(s: string): number {
  return Number(s.replace(/\./g, '').replace(',', '.'));
}

function parseDimBoxes(raw: string): { type: string; l: number; w: number; h: number }[] {
  const boxes: { type: string; l: number; w: number; h: number }[] = [];
  const labeled = [...raw.matchAll(/([A-D])[：:]\s*([^A-D]+?)(?=\s+[A-D][：:]|$)/gi)];
  if (labeled.length > 0) {
    for (const m of labeled) {
      const nums = [...m[2].matchAll(/(\d+(?:[.,]\d+)?)/g)].map((x) =>
        Number(x[1].replace(',', '.'))
      );
      if (nums.length >= 3) {
        let [l, w, h] = nums;
        if (/cm/i.test(m[2]) || (l < 400 && String(nums[0]).includes('.'))) {
          l *= 10;
          w *= 10;
          h *= 10;
        }
        boxes.push({
          type: m[1].toUpperCase(),
          l: Math.round(l),
          w: Math.round(w),
          h: Math.round(h),
        });
      }
    }
    return boxes;
  }
  const nums = [...raw.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((x) => Number(x[1].replace(',', '.')));
  if (nums.length >= 3) {
    let [l, w, h] = nums;
    if (/cm/i.test(raw) || (l < 400 && String(nums[0]).includes('.'))) {
      l *= 10;
      w *= 10;
      h *= 10;
    }
    boxes.push({ type: 'A', l: Math.round(l), w: Math.round(w), h: Math.round(h) });
  }
  return boxes;
}

function normalizeSheetText(text: string): string {
  return text
    .replace(/^pages=\d+\n/, '')
    .replace(/ITEM NOME DO PRODUTO[\s\S]*?PESO BRUTO CBM\n/i, '')
    .replace(/\nTOTAL:[\s\S]*/i, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, line) => {
      if (SKU_RE.test(line) || acc.length === 0) acc.push(line);
      else acc[acc.length - 1] += ' ' + line;
      return acc;
    }, [])
    .join('\n');
}

function parseLine(line: string, source: string): ParsedProduct | null {
  const tail = line.match(TAIL_RE);
  if (!tail) return null;
  const head = line.slice(0, line.length - tail[0].length).trim();
  const skuMatch = head.match(SKU_RE);
  if (!skuMatch) return null;
  const sku = skuMatch[1].toUpperCase();
  const name = head.slice(skuMatch[0].length).trim().replace(/\s+/g, ' ');
  const weightStacks = Number(tail[2]);
  const boxesTotal = Number(tail[3]);
  const boxTypes = parseDimBoxes(tail[4]).map((b) => b.type);
  const catalogSku = normalizeBucklerCatalogItemSku(sku, boxTypes);
  const stackBoxes = Math.max(0, boxesTotal - boxTypes.length);
  return {
    sku,
    catalogSku,
    name,
    qty: Number(tail[1]),
    weightStacks,
    boxesTotal,
    machineBoxes: boxTypes.length,
    stackBoxes: weightStacks > 0 ? stackBoxes : 0,
    grossKg: parseNum(tail[5]),
    cbm: parseNum(tail[6]),
    boxTypes,
    source,
  };
}

const STACK_LABELS = new Set(['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']);

function isAccessorySku(sku: string): boolean {
  return /^OK[\w,.-]+$/i.test(sku);
}

function category(sku: string): string {
  const u = sku.toUpperCase();
  if (isAccessorySku(u)) return 'Acessórios (OK*)';
  if (/^M7Pro-/.test(u)) return 'M7 Pro';
  if (/^M2-/.test(u)) return 'M2 (selectorized / pilhas)';
  if (/^LD-/.test(u)) return 'LD (plate loaded)';
  if (/^FM-/.test(u)) return 'FM (functional)';
  if (/^FW-/.test(u)) return 'FW (free weight racks/benches)';
  if (/^PF-/.test(u)) return 'PF';
  if (/^GL-/.test(u)) return 'GL (legado)';
  if (/^RS-/.test(u)) return 'RS (cardio/stations)';
  if (/^6841|^CE800|^CR800|^CU800|^SBC|^RCT|^R11|^B11|^S\d/.test(u)) return 'Cardio';
  return 'Outros';
}

async function pdfText(path: string): Promise<string> {
  const buf = readFileSync(path);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === 'string' ? text : (text as string[]).join('\n');
}

const catalog = buildShipperProductCatalog(fixture as ShipperCatalogRawRow[]);
const catalogSkus = new Set([...catalog.keys()]);
const stackBoxSkus = new Set(
  (fixture as ShipperCatalogRawRow[])
    .filter((r) => STACK_LABELS.has(String(r['Tipo Caixa'])))
    .map((r) => String(r.Item).toUpperCase())
);
const accessoryInFixture = [...catalogSkus].filter((s) => isAccessorySku(s)).length;

const bySku = new Map<string, ParsedProduct>();
const allParsed: ParsedProduct[] = [];

for (const pdf of readdirSync(sourceDir).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
  const text = await pdfText(join(sourceDir, pdf));
  writeFileSync(join(outDir, pdf.replace(/[^\w.\-() ]+/g, '_') + '.txt'), text, 'utf8');
  for (const line of normalizeSheetText(text).split('\n')) {
    const p = parseLine(line, pdf);
    if (!p) continue;
    allParsed.push(p);
    const prev = bySku.get(p.catalogSku);
    if (!prev || p.boxTypes.length > prev.boxTypes.length) bySku.set(p.catalogSku, p);
  }
}

type Row = {
  sku: string;
  catalogSku: string;
  category: string;
  name: string;
  inFixture: boolean;
  weightStacks: number;
  machineBoxes: number;
  stackBoxes: number;
  boxesTotal: number;
  grossKg: number;
  cbm: number;
  kitGap: string;
  source: string;
};

const items: Row[] = [...bySku.values()]
  .map((p) => {
    const inFixture = resolveBucklerCatalogSku(p.catalogSku, catalogSkus) != null;
    const entry = catalog.get(p.catalogSku);
    const fixtureStacks = entry ? 'n/a' : '';
    let kitGap = 'OK';
    if (p.weightStacks > 0) {
      if (p.stackBoxes === 0) kitGap = 'PILHAS>0 mas stackBoxes=0 — falta modelar caixas pilha';
      else if (!inFixture)
        kitGap = `Precisa kit M2: ${p.machineBoxes} caixas máq + ${p.stackBoxes} pilhas`;
      else
        kitGap = `Konnen-style: máq ${p.machineBoxes} + pilhas ${p.stackBoxes} (${p.weightStacks} placas)`;
    } else if (!inFixture) {
      kitGap = 'Sem medida no fixture';
    }
    return {
      sku: p.sku,
      catalogSku: p.catalogSku,
      category: category(p.catalogSku),
      name: p.name,
      inFixture,
      weightStacks: p.weightStacks,
      machineBoxes: p.machineBoxes,
      stackBoxes: p.stackBoxes,
      boxesTotal: p.boxesTotal,
      grossKg: p.grossKg,
      cbm: p.cbm,
      kitGap,
      source: p.source,
    };
  })
  .sort((a, b) => a.category.localeCompare(b.category) || a.catalogSku.localeCompare(b.catalogSku));

const categories = [...new Set(items.map((i) => i.category))].sort();
const categorySummary = categories.map((cat) => {
  const rows = items.filter((i) => i.category === cat);
  const inFix = rows.filter((r) => r.inFixture).length;
  const withStacks = rows.filter((r) => r.weightStacks > 0).length;
  const needKit = rows.filter((r) => r.weightStacks > 0 && r.stackBoxes > 0).length;
  const fixtureStackBoxes = rows.filter(
    (r) => r.inFixture && stackBoxSkus.has(r.catalogSku)
  ).length;
  return {
    category: cat,
    total: rows.length,
    inFixture: inFix,
    missing: rows.length - inFix,
    coveragePct: rows.length ? Math.round((inFix / rows.length) * 100) : 100,
    withWeightStacks: withStacks,
    needKonnenStyleKit: needKit,
    fixtureWithStackBoxes: fixtureStackBoxes,
  };
});

const fixtureOnly = [...catalogSkus].filter(
  (s) =>
    !items.some(
      (i) =>
        i.catalogSku === s ||
        resolveBucklerCatalogSku(s, new Set(items.map((x) => x.catalogSku))) != null
    )
);

const m2StackAnalysis = items
  .filter((i) => i.category.startsWith('M2') && i.weightStacks > 0)
  .map((i) => ({
    sku: i.catalogSku,
    name: i.name,
    pilhas: i.weightStacks,
    caixasMaquina: i.machineBoxes,
    caixasPilha: i.stackBoxes,
    caixasTotal: i.boxesTotal,
    pesoKg: i.grossKg,
    cbm: i.cbm,
    inFixture: i.inFixture,
    hasStackBoxesInFixture: stackBoxSkus.has(i.catalogSku),
    propostaKonnen: `M2 base (${i.machineBoxes} box) + pilhas (${i.stackBoxes || '?'} box, ${i.weightStacks} placas)`,
  }));

const report = {
  generatedAt: new Date().toISOString(),
  sourceDir,
  pdfs: readdirSync(sourceDir).filter((f) => f.endsWith('.pdf')),
  uniqueSkus: items.length,
  fixtureSkus: catalogSkus.size,
  accessoryInFixture,
  stackBoxSkusInFixture: stackBoxSkus.size,
  categorySummary,
  items,
  m2StackAnalysis,
  fixtureNotInMedidas: fixtureOnly.sort(),
  rawLineCount: allParsed.length,
};

writeFileSync(join(outDir, 'coverage-report.json'), JSON.stringify(report, null, 2));

// Markdown table
let md = `# Buckler Medidas — Cobertura (pós-import)\n\n`;
md += `Fonte PDFs: \`${sourceDir}\`\n\n`;
md += `Fixture/DB: **${catalogSkus.size} SKUs**, **${(fixture as ShipperCatalogRawRow[]).length} linhas caixa**, **${accessoryInFixture} acessórios OK\\***, **${stackBoxSkus.size} SKUs c/ caixas pilha (P–Z)**\n\n`;
md += `## Resumo por categoria\n\n`;
md += `| Categoria | Itens PDF | No fixture | Faltando | Cobertura | c/ pilhas | c/ caixa pilha no fixture |\n`;
md += `|-----------|----------:|-----------:|---------:|----------:|----------:|--------------------------:|\n`;
for (const c of categorySummary) {
  md += `| ${c.category} | ${c.total} | ${c.inFixture} | ${c.missing} | ${c.coveragePct}% | ${c.withWeightStacks} | ${c.fixtureWithStackBoxes} |\n`;
}
md += `\n## M2 — bateria de peso (kit máquina + caixas pilha)\n\n`;
md += `| SKU | Pilhas | Caixas máq | Caixas pilha | Total | Peso kg | CBM | Fixture | Modelo proposto |\n`;
md += `|-----|-------:|-----------:|-------------:|------:|--------:|----:|---------|-----------------|\n`;
for (const m of m2StackAnalysis) {
  md += `| ${m.sku} | ${m.pilhas} | ${m.caixasMaquina} | ${m.caixasPilha} | ${m.caixasTotal} | ${m.pesoKg} | ${m.cbm} | ${m.inFixture ? '✓' : '✗'} | ${m.propostaKonnen} |\n`;
}
md += `\n## Itens por categoria (detalhe)\n\n`;
for (const cat of categories) {
  md += `### ${cat}\n\n`;
  md += `| SKU | Nome | Fixture | Pilhas | Caixas | Peso | CBM | Gap |\n`;
  md += `|-----|------|---------|-------:|-------:|-----:|----:|-----|\n`;
  for (const i of items.filter((x) => x.category === cat)) {
    md += `| ${i.catalogSku} | ${i.name.slice(0, 40)} | ${i.inFixture ? '✓' : '✗'} | ${i.weightStacks} | ${i.boxesTotal} | ${i.grossKg} | ${i.cbm} | ${i.kitGap} |\n`;
  }
  md += `\n`;
}
if (fixtureOnly.length) {
  md += `## No fixture mas ausente em Medidas Buckler (${fixtureOnly.length})\n\n`;
  md += fixtureOnly.map((s) => `- ${s}`).join('\n') + '\n';
}
writeFileSync(join(outDir, 'coverage-report.md'), md, 'utf8');

console.log('[coverage] unique SKUs', items.length, 'fixture', catalogSkus.size);
for (const c of categorySummary) {
  console.log(
    `  ${c.category}: ${c.inFixture}/${c.total} (${c.coveragePct}%) pilhas=${c.withWeightStacks} stackFixture=${c.fixtureWithStackBoxes}`
  );
}
console.log(
  '[coverage] fixture SKUs',
  catalogSkus.size,
  'acessórios',
  accessoryInFixture,
  'c/ caixa pilha',
  stackBoxSkus.size
);
console.log('[coverage] M2 stack machines', m2StackAnalysis.length);
console.log('[coverage] wrote', join(outDir, 'coverage-report.md'));
