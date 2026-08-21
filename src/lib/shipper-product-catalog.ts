/**
 * Catálogo embarcador — planilha Buckler "Caixas por Medida".
 * SKU + qtd → peso/volume/caixas para cotação feira (sem caminhão/tabela na UI).
 */

import { bucklerCatalogGroupFallback } from './buckler-web-catalog';

/** Linha bruta (JSON export Base / Caixas por Medida). */
export type ShipperCatalogRawRow = {
  Item: string;
  Produto: string;
  'Qtd. Caixas Total': number;
  'Tipo Caixa': string;
  COMPRIMENTO: string | number;
  LARGURA: string | number;
  ALTURA: string | number;
  'Qtd. Tipos de Medida'?: number;
  'Qtd. Caixas por Medida': number;
  'Peso Bruto Total (kg)': string | number;
  'Peso Médio por Caixa (kg)'?: string | number;
  'Peso Estimado do Grupo (kg)': string | number;
  /** Legado CSV: "1630*1590*330" */
  'Dimensão da Caixa'?: string;
};

export type ShipperProductBoxType = {
  boxType: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  boxesPerUnit: number;
  groupWeightKg: number;
  volumeM3: number;
};

export type ShipperProductCatalogEntry = {
  sku: string;
  name: string;
  boxesTotal: number;
  boxTypesCount: number;
  weightKgPerUnit: number;
  volumeM3PerUnit: number;
  boxTypes: ShipperProductBoxType[];
  /** Chip feira Rotha/outros — ex. KITS, ANILHA. */
  catalogGroup?: string;
  productKind?: 'kit' | 'individual';
};

export type ShipperProductCatalog = Map<string, ShipperProductCatalogEntry>;

export type CatalogQuoteLine = {
  sku: string;
  quantity: number;
  /** Tipos caixa incluídos (ex. ['A','C']). Vazio = kit completo. */
  selectedBoxTypes?: string[];
  /** Peso stack no PDF Konnen (ex. 134 → 295 lb). */
  stackWeightKg?: number;
};

export type CatalogQuoteLineResolved = CatalogQuoteLine & {
  name: string;
  weightKg: number;
  volumeM3: number;
  boxesCount: number;
  isPartialKit: boolean;
};

/** Dimensões mm → label compacta (cm). */
export function formatBoxDimensionsCm(lengthMm: number, widthMm: number, heightMm: number): string {
  const cm = (mm: number) => Math.round(mm / 10);
  return `${cm(lengthMm)}×${cm(widthMm)}×${cm(heightMm)} cm`;
}

/** Todos os tipos caixa do produto (kit completo). */
export function fullKitBoxTypes(entry: ShipperProductCatalogEntry): string[] {
  return entry.boxTypes.map((b) => b.boxType);
}

/** Tipos efetivamente selecionados na linha. */
export function resolveSelectedBoxTypes(
  entry: ShipperProductCatalogEntry,
  line: Pick<CatalogQuoteLine, 'selectedBoxTypes'>
): string[] {
  const all = fullKitBoxTypes(entry);
  const picked = line.selectedBoxTypes?.filter((t) => all.includes(t)) ?? [];
  return picked.length > 0 ? picked : all;
}

/** Agrega uma linha de cotação a partir do produto e volumes selecionados. */
export function aggregateLineFromProduct(
  product: ShipperProductCatalogEntry,
  sku: string,
  quantity: number,
  selectedBoxTypes?: string[]
): Omit<CatalogQuoteLineResolved, 'sku' | 'quantity'> & {
  sku: string;
  quantity: number;
} {
  const types = resolveSelectedBoxTypes(product, { selectedBoxTypes });
  const boxes = product.boxTypes.filter((b) => types.includes(b.boxType));
  const allTypes = fullKitBoxTypes(product);
  const isPartialKit = types.length < allTypes.length || types.some((t, i) => t !== allTypes[i]);

  if (!isPartialKit) {
    return {
      sku,
      quantity,
      selectedBoxTypes: undefined,
      name: product.name,
      weightKg: product.weightKgPerUnit * quantity,
      volumeM3: product.volumeM3PerUnit * quantity,
      boxesCount: product.boxesTotal * quantity,
      isPartialKit: false,
    };
  }

  const unitWeight = boxes.reduce((s, b) => s + b.groupWeightKg, 0);
  const unitVolume = boxes.reduce((s, b) => s + b.volumeM3, 0);
  const unitBoxes = boxes.reduce((s, b) => s + b.boxesPerUnit, 0);

  return {
    sku,
    quantity,
    selectedBoxTypes: types,
    name: product.name,
    weightKg: unitWeight * quantity,
    volumeM3: unitVolume * quantity,
    boxesCount: unitBoxes * quantity,
    isPartialKit: true,
  };
}

export type CatalogQuoteAggregate = {
  lines: CatalogQuoteLineResolved[];
  weightKg: number;
  volumeM3: number;
  boxesCount: number;
  equipmentCount: number;
  unknownSkus: string[];
};

const MM3_TO_M3 = 1e9;

/** Número BR: "321,25" | 321.25 | "2,00" */
export function parseBrDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function parseDimensionMm(value: string | number): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  const digits = String(value).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** Legado: "1630*1590*330" → [C, L, A] mm */
export function parseLegacyBoxDimension(raw: string): [number, number, number] | null {
  const parts = raw.split('*').map((p) => parseDimensionMm(p));
  if (parts.length !== 3 || parts.some((n) => n <= 0)) return null;
  return parts as [number, number, number];
}

export function boxVolumeM3(
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  boxesCount: number
): number {
  if (lengthMm <= 0 || widthMm <= 0 || heightMm <= 0 || boxesCount <= 0) return 0;
  return (lengthMm * widthMm * heightMm * boxesCount) / MM3_TO_M3;
}

function resolveBoxDims(row: ShipperCatalogRawRow): [number, number, number] {
  const legacy = row['Dimensão da Caixa'];
  if (legacy) {
    const parsed = parseLegacyBoxDimension(legacy);
    if (parsed) return parsed;
  }
  return [
    parseDimensionMm(row.COMPRIMENTO),
    parseDimensionMm(row.LARGURA),
    parseDimensionMm(row.ALTURA),
  ];
}

/** Agrupa linhas planilha → catálogo por SKU. */
export function buildShipperProductCatalog(rows: ShipperCatalogRawRow[]): ShipperProductCatalog {
  const bySku = new Map<string, ShipperCatalogRawRow[]>();
  for (const row of rows) {
    const sku = String(row.Item ?? '')
      .trim()
      .toUpperCase();
    if (!sku) continue;
    const list = bySku.get(sku) ?? [];
    list.push(row);
    bySku.set(sku, list);
  }

  const catalog: ShipperProductCatalog = new Map();

  for (const [sku, skuRows] of bySku) {
    const first = skuRows[0]!;
    const name = String(first.Produto ?? '').trim();
    const boxesTotal = Number(first['Qtd. Caixas Total']) || 0;
    const boxTypesCount = Number(first['Qtd. Tipos de Medida']) || skuRows.length;
    const weightKgPerUnit = parseBrDecimal(first['Peso Bruto Total (kg)']);

    const boxTypes: ShipperProductBoxType[] = skuRows.map((row) => {
      const [lengthMm, widthMm, heightMm] = resolveBoxDims(row);
      const boxesPerUnit = parseBrDecimal(row['Qtd. Caixas por Medida']) || 1;
      const groupWeightKg = parseBrDecimal(row['Peso Estimado do Grupo (kg)']);
      const volumeM3 = boxVolumeM3(lengthMm, widthMm, heightMm, boxesPerUnit);
      return {
        boxType: String(row['Tipo Caixa'] ?? '').trim(),
        lengthMm,
        widthMm,
        heightMm,
        boxesPerUnit,
        groupWeightKg,
        volumeM3,
      };
    });

    const volumeM3PerUnit = boxTypes.reduce((sum, b) => sum + b.volumeM3, 0);

    catalog.set(sku, {
      sku,
      name,
      boxesTotal,
      boxTypesCount,
      weightKgPerUnit,
      volumeM3PerUnit,
      boxTypes,
    });
  }

  return catalog;
}

/** Soma peso bruto dos grupos — deve bater Peso Bruto Total (validação import). */
export function sumGroupWeightsKg(entry: ShipperProductCatalogEntry): number {
  return entry.boxTypes.reduce((sum, b) => sum + b.groupWeightKg, 0);
}

export type CatalogWeightValidation = {
  sku: string;
  weightBrutoKg: number;
  sumGruposKg: number;
  deltaKg: number;
  ok: boolean;
};

export function validateCatalogWeights(
  catalog: ShipperProductCatalog,
  toleranceKg = 0.05
): CatalogWeightValidation[] {
  const out: CatalogWeightValidation[] = [];
  for (const entry of catalog.values()) {
    const sumGruposKg = sumGroupWeightsKg(entry);
    const deltaKg = Math.abs(entry.weightKgPerUnit - sumGruposKg);
    out.push({
      sku: entry.sku,
      weightBrutoKg: entry.weightKgPerUnit,
      sumGruposKg,
      deltaKg,
      ok: deltaKg <= toleranceKg,
    });
  }
  return out.sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Linhas comerciais Buckler (prefixo SKU). */
export const BUCKLER_PRODUCT_LINES = ['FM', 'PF', 'LD', 'FW', 'M2', 'GL'] as const;
export type BucklerProductLine = (typeof BUCKLER_PRODUCT_LINES)[number];

const BUCKLER_LINE_RE = /^(FM|PF|LD|FW|M2|GL)-/;

/** Modo chips catálogo feira — Konnen/Buckler/Rotha(grupo)/demais prefixo SKU. */
export type CatalogLineMode = 'konnen' | 'buckler' | 'rotha' | 'shipper';

export function catalogLineModeForTenantSlug(slug: string | undefined): CatalogLineMode {
  if (slug === 'buckler') return 'buckler';
  if (slug === 'konnen') return 'konnen';
  if (slug === 'rotha') return 'rotha';
  return 'shipper';
}

const ROTHA_GROUP_ORDER = [
  'DUMBBELLS',
  'ANILHAS',
  'BARRAS MONTADAS',
  'BARRAS',
  'PUXADORES',
  'SUPORTES',
  'FUNCIONAL',
];
const KONNEN_PREFERRED_LINE_ORDER = [
  'IMPULSE',
  'XMASTER',
  'ROCKIT',
  'FM',
  'PF',
  'LD',
  'FW',
  'M2',
  'GL',
];
/** Chips feira Buckler — categorias do site (não prefixo SKU). */
const BUCKLER_PREFERRED_LINE_ORDER = [
  'PIN LOADED',
  'CARDIO',
  'BENCHES & RACKS',
  'PLATE LOADED',
  'CABLE CROSS',
  'ACESSORIOS',
  'OUTROS',
];

function skuProductLineBuckler(sku: string): string {
  return skuProductLineBucklerLegacyChip(sku);
}

/** Fallback chip Buckler quando feira.products.catalog_group ausente. */
function skuProductLineBucklerLegacyChip(sku: string, name = ''): string {
  return bucklerCatalogGroupFallback(sku, name);
}

function skuProductLineShipper(sku: string): string {
  const u = String(sku).trim().toUpperCase();
  const prefix = u.match(/^([A-Z][A-Z0-9]*)-/);
  return prefix?.[1] ?? 'OUTROS';
}

function skuProductLineKonnen(sku: string): string {
  const u = String(sku).trim().toUpperCase();
  if (u.startsWith('XMT')) return 'XMASTER';
  if (u.startsWith('RKC')) return 'ROCKIT';
  const buckler = u.match(BUCKLER_LINE_RE);
  if (buckler) return buckler[1]!;
  return 'IMPULSE';
}

/** IT95 packing repeats the same WEIGHT PLATE kits already as FEWS-*. */
const WEIGHT_PLATE_ALIAS_RE = /^IT95WS-(.+)$/;

const EQUIPMENT_WS_RULES = [
  {
    test: (sku: string) => /^FE97[A-Z0-9]+$/.test(sku) && !sku.startsWith('FEWS'),
    wsPrefix: 'FEWS',
  },
  {
    test: (sku: string) => /^IF93[A-Z0-9]+$/.test(sku) && !sku.includes('WS-'),
    wsPrefix: 'IF93WS',
  },
  { test: (sku: string) => /^IT95\d/.test(sku) && !sku.includes('WS-'), wsPrefix: 'IT95WS' },
] as const;

const STACK_LBS_BY_PDF_KG = [
  { lbs: '160', kg: 72.6 },
  { lbs: '200', kg: 90.7 },
  { lbs: '235', kg: 106.6 },
  { lbs: '295', kg: 133.8 },
] as const;

const BOX_TYPE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** PDF Konnen: "-134KG" no nome = stack 295 lb (~133,8 kg). */
export function stackLbsFromPdfWeightKg(kg: number): string | null {
  let best: { lbs: string; delta: number } | null = null;
  for (const target of STACK_LBS_BY_PDF_KG) {
    const delta = Math.abs(kg - target.kg);
    if (delta <= 4 && (!best || delta < best.delta)) {
      best = { lbs: target.lbs, delta };
    }
  }
  return best?.lbs ?? null;
}

export function defaultStackLbsForEquipment(sku: string): string | null {
  return EQUIPMENT_WS_RULES.some((r) => r.test(sku)) ? '295' : null;
}

function wsSkuForEquipment(sku: string, stackLbs: string): string | null {
  const rule = EQUIPMENT_WS_RULES.find((r) => r.test(sku));
  return rule ? `${rule.wsPrefix}-${stackLbs}` : null;
}

/** Equipamento + weight stack (runtime, ex. IF9302 + IF93WS-295). */
export function composeEquipmentWithWeightStack(
  catalog: ShipperProductCatalog,
  sku: string,
  stackLbs: string
): ShipperProductCatalogEntry | null {
  const equip = catalog.get(sku);
  if (!equip) return null;
  const wsSku = wsSkuForEquipment(sku, stackLbs);
  if (!wsSku) return equip;
  const ws = catalog.get(wsSku);
  if (!ws) return equip;

  const relabel = (boxes: ShipperProductBoxType[], offset: number): ShipperProductBoxType[] =>
    boxes.map((b, i) => ({
      ...b,
      boxType: BOX_TYPE_LABELS[offset + i] ?? `Z${offset + i}`,
    }));

  const boxTypes = [...equip.boxTypes, ...relabel(ws.boxTypes, equip.boxTypes.length)];
  return {
    sku: equip.sku,
    name: equip.name,
    boxesTotal: boxTypes.length,
    boxTypesCount: boxTypes.length,
    weightKgPerUnit: equip.weightKgPerUnit + ws.weightKgPerUnit,
    volumeM3PerUnit: equip.volumeM3PerUnit + ws.volumeM3PerUnit,
    boxTypes,
  };
}

function resolveProductForQuoteLine(
  catalog: ShipperProductCatalog,
  line: CatalogQuoteLine
): ShipperProductCatalogEntry | null {
  const sku = String(line.sku ?? '')
    .trim()
    .toUpperCase();
  const base = catalog.get(sku);
  if (!base) return null;

  const stackLbs =
    line.stackWeightKg != null
      ? stackLbsFromPdfWeightKg(line.stackWeightKg)
      : defaultStackLbsForEquipment(sku);
  if (!stackLbs) return base;

  return composeEquipmentWithWeightStack(catalog, sku, stackLbs) ?? base;
}

export function catalogEntryLine(
  entry: ShipperProductCatalogEntry,
  mode: CatalogLineMode = 'konnen'
): string {
  if (mode === 'rotha') {
    if (entry.catalogGroup) return entry.catalogGroup.toUpperCase();
    if (entry.productKind === 'kit' || entry.sku.toUpperCase().startsWith('ROTHA-KIT-')) {
      return 'KITS';
    }
    return 'OUTROS';
  }
  if (mode === 'buckler') {
    if (entry.catalogGroup) return entry.catalogGroup.toUpperCase();
    return skuProductLineBucklerLegacyChip(entry.sku, entry.name);
  }
  return skuProductLine(entry.sku, mode);
}

export function skuProductLine(sku: string, mode: CatalogLineMode = 'konnen'): string {
  if (mode === 'buckler') return skuProductLineBuckler(sku);
  if (mode === 'shipper') return skuProductLineShipper(sku);
  return skuProductLineKonnen(sku);
}

/** Label do chip (XMT→XMASTER já vem do id da linha). */
export function catalogLineLabel(line: string): string {
  return line.trim().toUpperCase();
}

/**
 * Remove IT95WS-* se FEWS-* do mesmo peso já está no catálogo (mesmo WEIGHT PLATE).
 */
export function pruneAliasWeightPlates(catalog: ShipperProductCatalog): ShipperProductCatalog {
  const next: ShipperProductCatalog = new Map();
  for (const [sku, entry] of catalog) {
    const alias = sku.toUpperCase().match(WEIGHT_PLATE_ALIAS_RE);
    if (alias && catalog.has(`FEWS-${alias[1]}`)) continue;
    next.set(sku, entry);
  }
  return next;
}

export function catalogEntriesByLine(
  catalog: ShipperProductCatalog,
  line: string,
  mode: CatalogLineMode = 'konnen'
): ShipperProductCatalogEntry[] {
  const prefix = line.trim().toUpperCase();
  const hits: ShipperProductCatalogEntry[] = [];
  for (const entry of catalog.values()) {
    if (catalogEntryLine(entry, mode) === prefix) hits.push(entry);
  }
  return hits.sort((a, b) => a.sku.localeCompare(b.sku));
}

export function catalogLineCounts(
  catalog: ShipperProductCatalog,
  mode: CatalogLineMode = 'konnen'
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of catalog.values()) {
    const line = catalogEntryLine(entry, mode);
    counts[line] = (counts[line] ?? 0) + 1;
  }
  return counts;
}

/** Catálogos pequenos (Rotha, PlayFit): listar tudo sem chip. */
export const FAIR_SMALL_CATALOG_SKUS = 20;

/** Todas entradas ordenadas por SKU (catálogo compacto). */
export function catalogAllEntries(catalog: ShipperProductCatalog): ShipperProductCatalogEntry[] {
  return [...catalog.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Prefixos/clusters presentes no catálogo do tenant. */
export function catalogProductLines(
  catalog: ShipperProductCatalog,
  limit = 16,
  mode: CatalogLineMode = 'konnen'
): string[] {
  const counts = catalogLineCounts(catalog, mode);
  const preferred =
    mode === 'buckler'
      ? BUCKLER_PREFERRED_LINE_ORDER
      : mode === 'rotha'
        ? ROTHA_GROUP_ORDER
        : KONNEN_PREFERRED_LINE_ORDER;
  const rank = (line: string) => {
    const i = preferred.indexOf(line);
    return i === -1 ? 100 + line.charCodeAt(0) : i;
  };
  const lineLimit = mode === 'rotha' ? 24 : limit;
  return Object.keys(counts)
    .sort((a, b) => rank(a) - rank(b) || (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b))
    .slice(0, lineLimit);
}

/** Busca SKU / nome (feira autocomplete). */
export function searchShipperCatalog(
  catalog: ShipperProductCatalog,
  query: string,
  limit = 20
): ShipperProductCatalogEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const hits: ShipperProductCatalogEntry[] = [];
  for (const entry of catalog.values()) {
    if (entry.sku.includes(q) || entry.name.toUpperCase().includes(q)) {
      hits.push(entry);
      if (hits.length >= limit) break;
    }
  }
  return hits.sort((a, b) => a.sku.localeCompare(b.sku));
}

/** Linhas pedido → totais carga (input calculate-freight). */
export function aggregateCatalogQuoteLines(
  catalog: ShipperProductCatalog,
  lines: CatalogQuoteLine[]
): CatalogQuoteAggregate {
  const resolved: CatalogQuoteLineResolved[] = [];
  const unknownSkus: string[] = [];
  let weightKg = 0;
  let volumeM3 = 0;
  let boxesCount = 0;
  let equipmentCount = 0;

  for (const line of lines) {
    const sku = String(line.sku ?? '')
      .trim()
      .toUpperCase();
    const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0));
    if (!sku || quantity <= 0) continue;

    const product = resolveProductForQuoteLine(catalog, line);
    if (!product) {
      unknownSkus.push(sku);
      continue;
    }

    const resolvedLine = aggregateLineFromProduct(product, sku, quantity, line.selectedBoxTypes);

    resolved.push(resolvedLine);

    weightKg += resolvedLine.weightKg;
    volumeM3 += resolvedLine.volumeM3;
    boxesCount += resolvedLine.boxesCount;
    equipmentCount += quantity;
  }

  return {
    lines: resolved,
    weightKg,
    volumeM3,
    boxesCount,
    equipmentCount,
    unknownSkus,
  };
}
