import type { ShipperCatalogRawRow } from '../../src/lib/shipper-product-catalog';

export type PackingSource = 'impulse-grid' | 'exoform-grid' | 'xmaster-grid' | 'rockit-grid';

const BOX_TYPES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function normalizeFileToken(name: string): string {
  return name
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseNum(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseMm(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function parseCartonSize(raw: unknown): [number, number, number] | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  const isMeters = /m/.test(s) && !/mm/.test(s);
  const cleaned = s.replace(/mm|m/g, '');
  const parts = cleaned.split(/[*x×X]/).map((p) => parseFloat(p.replace(',', '.')));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const scale = isMeters ? 1000 : 1;
  return parts.map((n) => Math.round(n * scale)) as [number, number, number];
}

function looksLikeSku(value: string): boolean {
  const s = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{2,}$/.test(s);
}

function headerIndex(row: unknown[], ...needles: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let c = 0; c < row.length; c++) {
    const cell = String(row[c] ?? '')
      .trim()
      .toLowerCase();
    if (!cell) continue;
    for (const n of needles) {
      if (cell.includes(n) && idx[n] === undefined) idx[n] = c;
    }
  }
  return idx;
}

function findHeaderRow(rows: unknown[][], needles: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] as unknown[];
    const joined = row.map((c) => String(c ?? '').toLowerCase()).join('|');
    if (needles.every((n) => joined.includes(n))) return i;
  }
  return -1;
}

function boxTypeLabel(index: number): string {
  return BOX_TYPES[index] ?? `Z${index}`;
}

function finalizeKit(
  sku: string,
  produto: string,
  boxes: Array<{ gw: number; l: number; w: number; h: number }>
): ShipperCatalogRawRow[] {
  if (!sku || boxes.length === 0) return [];
  const totalGw = boxes.reduce((s, b) => s + b.gw, 0);
  const boxesTotal = boxes.length;
  return boxes.map((b, i) => ({
    Item: sku,
    Produto: produto,
    'Qtd. Caixas Total': boxesTotal,
    'Tipo Caixa': boxTypeLabel(i),
    COMPRIMENTO: String(b.l),
    LARGURA: String(b.w),
    ALTURA: String(b.h),
    'Qtd. Tipos de Medida': boxesTotal,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': Math.round(totalGw * 1000) / 1000,
    'Peso Médio por Caixa (kg)': Math.round((totalGw / boxesTotal) * 1000) / 1000,
    'Peso Estimado do Grupo (kg)': Math.round(b.gw * 1000) / 1000,
  }));
}

function expandSlashSkus(rows: ShipperCatalogRawRow[]): ShipperCatalogRawRow[] {
  const out: ShipperCatalogRawRow[] = [];
  for (const row of rows) {
    const item = String(row.Item ?? '').trim();
    if (item.includes('/')) {
      for (const part of item
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean)) {
        out.push({ ...row, Item: part.toUpperCase() });
      }
    } else {
      out.push(row);
    }
  }
  return out;
}

/** Impulse cardio / IF / SL / IF93 grid (model + length(mm)). */
export function parseImpulseGrid(
  rows: unknown[][],
  opts: { modelColOffset?: number; splitSlashSkus?: boolean; defaultProduto?: string } = {}
): ShipperCatalogRawRow[] {
  const offset = opts.modelColOffset ?? 0;
  const headerAt = findHeaderRow(rows, ['model', 'length']);
  if (headerAt < 0) return [];

  const header = rows[headerAt] as unknown[];
  const h = headerIndex(header, 'model', 'description', 'ctn', 'box', 'gw', 'length');
  const modelCol = (h.model ?? 0) + offset;
  const descCol = h.description ?? modelCol + 1;
  const boxCol = h.ctn ?? h.box ?? descCol + 1;
  const gwCol = h.gw ?? boxCol + 2;
  const lenCol = h.length ?? gwCol + 2;

  const out: ShipperCatalogRawRow[] = [];
  let currentSku = '';
  let currentDesc = opts.defaultProduto ?? '';
  let currentBoxes: Array<{ gw: number; l: number; w: number; h: number }> = [];

  const flush = () => {
    out.push(...finalizeKit(currentSku, currentDesc, currentBoxes));
    currentBoxes = [];
  };

  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const modelRaw = String(row[modelCol] ?? '').trim();
    const l = parseMm(row[lenCol]);
    const w = parseMm(row[lenCol + 1]);
    const hMm = parseMm(row[lenCol + 2]);
    const gw = parseNum(row[gwCol]);
    if (l <= 0 || w <= 0 || hMm <= 0 || gw <= 0) continue;

    if (modelRaw) {
      if (currentSku) flush();
      currentSku = modelRaw.toUpperCase();
      currentDesc = String(row[descCol] ?? '').trim() || currentDesc || currentSku;
    }
    if (!currentSku) continue;
    currentBoxes.push({ gw, l, w, h: hMm });
  }
  if (currentSku) flush();

  return opts.splitSlashSkus === false ? out : expandSlashSkus(out);
}

/** EXOFORM / IT95 — model in column B (index 1). */
export function parseExoformGrid(rows: unknown[][]): ShipperCatalogRawRow[] {
  return parseImpulseGrid(rows, { modelColOffset: 0, splitSlashSkus: false });
}

/** XMASTER accessories — SKU in Detail column, carton L*W*H. */
export function parseXmasterGrid(rows: unknown[][]): ShipperCatalogRawRow[] {
  let headerAt = findHeaderRow(rows, ['detail', 'carton']);
  if (headerAt < 0) headerAt = findHeaderRow(rows, ['detail', 'packaging']);
  if (headerAt < 0) headerAt = findHeaderRow(rows, ['packaging', 'gross']);
  if (headerAt < 0) return [];
  return parseXmasterAt(rows, headerAt);
}

function parseXmasterAt(rows: unknown[][], headerAt: number): ShipperCatalogRawRow[] {
  const header = rows[headerAt] as unknown[];
  let skuCol = -1;
  let nameCol = -1;
  let sizeCol = -1;
  let cartonCol = -1;
  let qtyCol = -1;
  let gwCol = -1;
  for (let c = 0; c < header.length; c++) {
    const cell = String(header[c] ?? '').toLowerCase();
    if (cell.includes('detail') && cell.includes('sku')) skuCol = c;
    else if (cell.includes('product name') || (cell.includes('store') && cell.includes('ability')))
      nameCol = c;
    else if (cell.includes('size') && cell.includes('kg')) sizeCol = c;
    else if (cell.includes('qty') && cell.includes('carton')) qtyCol = c;
    else if (cell.includes('carton size') || cell.includes('packaging size')) cartonCol = c;
    else if (cell.includes('gross weight')) gwCol = c;
  }
  if (cartonCol < 0) return [];
  if (skuCol < 0 && nameCol < 0) nameCol = 0;

  const out: ShipperCatalogRawRow[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    let sku =
      skuCol >= 0
        ? String(row[skuCol] ?? '')
            .trim()
            .toUpperCase()
        : '';
    const name = String(row[nameCol] ?? '').trim();
    if (!looksLikeSku(sku)) {
      if (looksLikeSku(name)) sku = name.toUpperCase();
      else if (name) {
        sku = `XMR-${name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}`;
      } else continue;
    }
    const dims = parseCartonSize(row[cartonCol]);
    if (!dims) continue;
    const displayName = name || sku;
    const sizeKg = sizeCol >= 0 ? parseNum(row[sizeCol]) : 0;
    const qtyRaw = qtyCol >= 0 ? String(row[qtyCol] ?? '') : '1';
    const qtyMatch = qtyRaw.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]!, 10) : 1;
    let gw = gwCol >= 0 ? parseNum(row[gwCol]) : 0;
    if (gw <= 0 && sizeKg > 0) gw = Math.round(sizeKg * qty * 1000) / 1000;
    if (gw <= 0) gw = 1;
    const [l, w, h] = dims;
    out.push(...finalizeKit(sku, displayName, [{ gw, l, w, h }]));
  }
  return out;
}

/** Rockit urethane dumbbells etc. */
export function parseRockitGrid(rows: unknown[][]): ShipperCatalogRawRow[] {
  const headerAt = findHeaderRow(rows, ['item', 'length']);
  if (headerAt < 0) return [];
  const header = rows[headerAt] as unknown[];
  const h = headerIndex(
    header,
    'item',
    'product',
    'length',
    'width',
    'heigth',
    'height',
    'g.w',
    'n.w'
  );
  const itemCol = h.item ?? 0;
  const prodCol = h.product ?? 1;
  const lenCol = h.length ?? 3;
  const gwCol = h['g.w'] ?? 9;

  const out: ShipperCatalogRawRow[] = [];
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const sku = String(row[itemCol] ?? '')
      .trim()
      .toUpperCase();
    const l = parseMm(row[lenCol]);
    const w = parseMm(row[lenCol + 1]);
    const hMm = parseMm(row[lenCol + 2]);
    const gw = parseNum(row[gwCol]);
    if (!sku || l <= 0 || w <= 0 || hMm <= 0) continue;
    const name = String(row[prodCol] ?? '').trim() || sku;
    out.push(...finalizeKit(sku, name, [{ gw: gw > 0 ? gw : 1, l, w, h: hMm }]));
  }
  return out;
}

export function mergeCatalogRows(
  base: ShipperCatalogRawRow[],
  overlay: ShipperCatalogRawRow[]
): ShipperCatalogRawRow[] {
  const overlaySkus = new Set(overlay.map((r) => String(r.Item).toUpperCase()));
  const kept = base.filter((r) => !overlaySkus.has(String(r.Item).toUpperCase()));
  return [...kept, ...overlay];
}

export function assertNoSkuCollisions(
  chunks: Array<{ label: string; rows: ShipperCatalogRawRow[] }>
): void {
  const seen = new Map<string, string>();
  for (const chunk of chunks) {
    const skus = new Set(chunk.rows.map((r) => String(r.Item).toUpperCase()));
    for (const sku of skus) {
      const prev = seen.get(sku);
      if (prev && prev !== chunk.label) {
        throw new Error(`SKU collision ${sku}: ${prev} vs ${chunk.label}`);
      }
      seen.set(sku, chunk.label);
    }
  }
}

export function skuCount(rows: ShipperCatalogRawRow[]): number {
  return new Set(rows.map((r) => String(r.Item).toUpperCase())).size;
}
