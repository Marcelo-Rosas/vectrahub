/**
 * Catálogo embarcador — planilha Buckler "Caixas por Medida".
 * SKU + qtd → peso/volume/caixas para cotação feira (sem caminhão/tabela na UI).
 */

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

export type ProductBoxRole = 'frame' | 'weight_stack';

export type ShipperProductBoxType = {
  boxType: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  boxesPerUnit: number;
  groupWeightKg: number;
  volumeM3: number;
  boxRole?: ProductBoxRole;
};

export type ShipperProductCatalogEntry = {
  sku: string;
  name: string;
  boxesTotal: number;
  boxTypesCount: number;
  weightKgPerUnit: number;
  volumeM3PerUnit: number;
  boxTypes: ShipperProductBoxType[];
  /** SKU selectorized com baterias de peso opcionais. */
  hasWeightStack?: boolean;
  weightStackSku?: string | null;
  weightStackBoxesCount?: number | null;
  weightKgWithStack?: number | null;
  volumeM3WithStack?: number | null;
  boxesTotalWithStack?: number | null;
};

export type ShipperProductCatalog = Map<string, ShipperProductCatalogEntry>;

export type CatalogQuoteLine = {
  sku: string;
  quantity: number;
  /** Tipos caixa frame incluídos (ex. ['A','C']). Vazio = kit frame completo. */
  selectedBoxTypes?: string[];
  /** Inclui baterias de peso (BAT) quando o SKU tem complemento. Default: false. */
  includeWeightStack?: boolean;
};

export type CatalogQuoteLineResolved = CatalogQuoteLine & {
  name: string;
  weightKg: number;
  volumeM3: number;
  boxesCount: number;
  isPartialKit: boolean;
  hasWeightStackIncluded: boolean;
};

/** Dimensões mm → label compacta (cm). */
export function formatBoxDimensionsCm(lengthMm: number, widthMm: number, heightMm: number): string {
  const cm = (mm: number) => Math.round(mm / 10);
  return `${cm(lengthMm)}×${cm(widthMm)}×${cm(heightMm)} cm`;
}

export function frameBoxTypes(entry: ShipperProductCatalogEntry): ShipperProductBoxType[] {
  return entry.boxTypes.filter((b) => (b.boxRole ?? 'frame') === 'frame');
}

export function weightStackBoxTypes(entry: ShipperProductCatalogEntry): ShipperProductBoxType[] {
  return entry.boxTypes.filter((b) => b.boxRole === 'weight_stack');
}

/** Todos os tipos caixa frame do produto (kit frame completo). */
export function fullKitBoxTypes(entry: ShipperProductCatalogEntry): string[] {
  return frameBoxTypes(entry).map((b) => b.boxType);
}

/** Todos os tipos caixa BAT do produto. */
export function fullWeightStackBoxTypes(entry: ShipperProductCatalogEntry): string[] {
  return weightStackBoxTypes(entry).map((b) => b.boxType);
}

export function productHasWeightStack(entry: ShipperProductCatalogEntry): boolean {
  return Boolean(
    entry.hasWeightStack &&
    (weightStackBoxTypes(entry).length > 0 ||
      (entry.weightKgWithStack != null && entry.weightKgWithStack > entry.weightKgPerUnit))
  );
}

/** Tipos frame efetivamente selecionados na linha. */
export function resolveSelectedBoxTypes(
  entry: ShipperProductCatalogEntry,
  line: Pick<CatalogQuoteLine, 'selectedBoxTypes'>
): string[] {
  const all = fullKitBoxTypes(entry);
  const picked = line.selectedBoxTypes?.filter((t) => all.includes(t)) ?? [];
  return picked.length > 0 ? picked : all;
}

function aggregateFrameFromBoxes(
  product: ShipperProductCatalogEntry,
  types: string[]
): { weightKg: number; volumeM3: number; boxesCount: number; isPartialKit: boolean } {
  const allTypes = fullKitBoxTypes(product);
  const boxes = frameBoxTypes(product).filter((b) => types.includes(b.boxType));
  const isPartialKit = types.length < allTypes.length || types.some((t, i) => t !== allTypes[i]);

  if (!isPartialKit) {
    return {
      weightKg: product.weightKgPerUnit,
      volumeM3: product.volumeM3PerUnit,
      boxesCount: product.boxesTotal,
      isPartialKit: false,
    };
  }

  return {
    weightKg: boxes.reduce((s, b) => s + b.groupWeightKg, 0),
    volumeM3: boxes.reduce((s, b) => s + b.volumeM3, 0),
    boxesCount: boxes.reduce((s, b) => s + b.boxesPerUnit, 0),
    isPartialKit: true,
  };
}

function aggregateWeightStack(product: ShipperProductCatalogEntry): {
  weightKg: number;
  volumeM3: number;
  boxesCount: number;
} {
  const batBoxes = weightStackBoxTypes(product);
  if (batBoxes.length > 0) {
    return {
      weightKg: batBoxes.reduce((s, b) => s + b.groupWeightKg, 0),
      volumeM3: batBoxes.reduce((s, b) => s + b.volumeM3, 0),
      boxesCount: batBoxes.reduce((s, b) => s + b.boxesPerUnit, 0),
    };
  }

  const frameWeight = product.weightKgPerUnit;
  const frameVolume = product.volumeM3PerUnit;
  const frameBoxes = product.boxesTotal;
  return {
    weightKg: Math.max(0, (product.weightKgWithStack ?? frameWeight) - frameWeight),
    volumeM3: Math.max(0, (product.volumeM3WithStack ?? frameVolume) - frameVolume),
    boxesCount: Math.max(0, (product.boxesTotalWithStack ?? frameBoxes) - frameBoxes),
  };
}

/** Agrega uma linha de cotação a partir do produto e volumes selecionados. */
export function aggregateLineFromProduct(
  product: ShipperProductCatalogEntry,
  sku: string,
  quantity: number,
  selectedBoxTypes?: string[],
  includeWeightStack = false
): Omit<CatalogQuoteLineResolved, 'sku' | 'quantity'> & {
  sku: string;
  quantity: number;
} {
  const types = resolveSelectedBoxTypes(product, { selectedBoxTypes });
  const allTypes = fullKitBoxTypes(product);
  const frameAgg = aggregateFrameFromBoxes(product, types);
  const withStack = includeWeightStack && productHasWeightStack(product);
  const stackAgg = withStack
    ? aggregateWeightStack(product)
    : { weightKg: 0, volumeM3: 0, boxesCount: 0 };

  const isFullFrameKit = !frameAgg.isPartialKit;
  const useCompleteTotals =
    withStack &&
    isFullFrameKit &&
    product.weightKgWithStack != null &&
    product.volumeM3WithStack != null &&
    product.boxesTotalWithStack != null;

  const unitWeight = useCompleteTotals
    ? product.weightKgWithStack!
    : frameAgg.weightKg + stackAgg.weightKg;
  const unitVolume = useCompleteTotals
    ? product.volumeM3WithStack!
    : frameAgg.volumeM3 + stackAgg.volumeM3;
  const unitBoxes = useCompleteTotals
    ? product.boxesTotalWithStack!
    : frameAgg.boxesCount + stackAgg.boxesCount;

  return {
    sku,
    quantity,
    selectedBoxTypes: isFullFrameKit ? undefined : types,
    includeWeightStack: withStack || undefined,
    name: product.name,
    weightKg: unitWeight * quantity,
    volumeM3: unitVolume * quantity,
    boxesCount: unitBoxes * quantity,
    isPartialKit: frameAgg.isPartialKit || (withStack && types.length < allTypes.length),
    hasWeightStackIncluded: withStack,
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

export function skuProductLine(sku: string): string {
  const m = String(sku)
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+)-/);
  return m?.[1] ?? 'OUTROS';
}

export function catalogEntriesByLine(
  catalog: ShipperProductCatalog,
  line: string
): ShipperProductCatalogEntry[] {
  const prefix = line.trim().toUpperCase();
  const hits: ShipperProductCatalogEntry[] = [];
  for (const entry of catalog.values()) {
    if (skuProductLine(entry.sku) === prefix) hits.push(entry);
  }
  return hits.sort((a, b) => a.sku.localeCompare(b.sku));
}

export function catalogLineCounts(catalog: ShipperProductCatalog): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of catalog.values()) {
    const line = skuProductLine(entry.sku);
    counts[line] = (counts[line] ?? 0) + 1;
  }
  return counts;
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

    const product = catalog.get(sku);
    if (!product) {
      unknownSkus.push(sku);
      continue;
    }

    const resolvedLine = aggregateLineFromProduct(
      product,
      sku,
      quantity,
      line.selectedBoxTypes,
      line.includeWeightStack
    );

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
