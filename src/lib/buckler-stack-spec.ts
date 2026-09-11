/**
 * Spec OEM bateria de peso (placas + stack kg) — Buckler / Realleader.
 * Medidas manda dimensões; MIC JSON manda stack kg OEM; import recalcula P–Z.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  countStackBoxes,
  countStackSides,
  isStackBoxType,
  PLATES_PER_STACK_BOX,
  stackBoxTypeAt,
} from '@/lib/buckler-stack-packaging';
import type { ShipperProductCatalogEntry } from '@/lib/shipper-product-catalog';
import {
  loadRealleaderMicCatalog,
  loadRealleaderMicProductSpecs,
  REALLEADER_MIC_CATALOG_JSON,
  REALLEADER_MIC_PRODUCT_SPECS_JSON,
} from '@/lib/realleader-mic-product-specs';

export type ProductStackSpec = {
  sku: string;
  plates: number;
  stackSides: number;
  stackKgOem: number;
  stackKgSource: string;
  platesSource: string;
  /** Bruto kit Interfit (kg) — corrige planilha Medidas inflada. */
  kitGrossKg?: number;
  oemRaw?: string | null;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Placas por caixa pilha (mod 5, ordem P→Z). */
export function stackPlatesPerBox(plates: number, sides: number): number[] {
  if (plates <= 0) return [];
  const sideCount = Math.max(1, sides);
  const perSide = plates / sideCount;
  const boxesOf5 = Math.floor(perSide / PLATES_PER_STACK_BOX);
  const loose = perSide % PLATES_PER_STACK_BOX;
  const perSidePlates: number[] = [];
  for (let i = 0; i < boxesOf5; i++) perSidePlates.push(PLATES_PER_STACK_BOX);
  if (loose > 0 || perSide % 1 !== 0) {
    perSidePlates.push(loose > 0 ? loose : Math.ceil((perSide % 1) * PLATES_PER_STACK_BOX));
  }
  const out: number[] = [];
  for (let s = 0; s < sideCount; s++) out.push(...perSidePlates);
  return out;
}

/** Distribui stack kg OEM proporcional às placas de cada caixa P–Z. */
export function distributeOemStackKg(plates: number, sides: number, oemStackKg: number): number[] {
  const perBoxPlates = stackPlatesPerBox(plates, sides);
  const totalPlates = perBoxPlates.reduce((sum, p) => sum + p, 0);
  if (totalPlates <= 0 || oemStackKg <= 0) return perBoxPlates.map(() => 0);
  const weights = perBoxPlates.map((p) => round3((oemStackKg * p) / totalPlates));
  const drift = round3(oemStackKg - weights.reduce((s, w) => s + w, 0));
  if (weights.length > 0 && Math.abs(drift) >= 0.001) {
    weights[weights.length - 1] = round3(weights[weights.length - 1]! + drift);
  }
  return weights;
}

function distributeEven(totalKg: number, parts: number): number[] {
  if (parts <= 0) return [];
  const each = round3(totalKg / parts);
  const weights = Array.from({ length: parts }, () => each);
  const drift = round3(totalKg - weights.reduce((s, w) => s + w, 0));
  if (weights.length > 0 && Math.abs(drift) >= 0.001) {
    weights[weights.length - 1] = round3(weights[weights.length - 1]! + drift);
  }
  return weights;
}

export const DEFAULT_STACK_BOX_MM = { lengthMm: 1300, widthMm: 600, heightMm: 300 };

/** Repõe caixas P–Z (mod 5) e aplica pesos OEM — corrige planilha Medidas com pilhas a mais. */
export function rebuildStackBoxesInEntry(
  entry: ShipperProductCatalogEntry,
  spec: Pick<ProductStackSpec, 'plates' | 'stackSides' | 'stackKgOem'>,
  stackDims = DEFAULT_STACK_BOX_MM
): ShipperProductCatalogEntry {
  const sides = spec.stackSides > 0 ? spec.stackSides : countStackSides(entry.name, entry.sku);
  const machineBoxes = entry.boxTypes.filter((b) => !isStackBoxType(b.boxType));
  const stackCount = countStackBoxes(spec.plates, sides);
  const stackBoxes = Array.from({ length: stackCount }, (_, i) => {
    const volumeM3 = (stackDims.lengthMm * stackDims.widthMm * stackDims.heightMm) / 1e9;
    return {
      boxType: stackBoxTypeAt(i),
      lengthMm: stackDims.lengthMm,
      widthMm: stackDims.widthMm,
      heightMm: stackDims.heightMm,
      boxesPerUnit: 1,
      groupWeightKg: 0,
      volumeM3,
    };
  });
  const kitGross =
    spec.kitGrossKg != null && spec.kitGrossKg > 0 ? spec.kitGrossKg : entry.weightKgPerUnit;
  const base: ShipperProductCatalogEntry = {
    ...entry,
    weightKgPerUnit: kitGross,
    boxTypes: [...machineBoxes, ...stackBoxes],
    boxesTotal: machineBoxes.length + stackCount,
    boxTypesCount: machineBoxes.length + stackCount,
  };
  return applyStackSpecToEntry(base, { ...spec, stackSides: sides });
}

/** Recalcula group_weight_kg: máquina A–D = kit−OEM; pilha P–Z = OEM por placa. */
export function applyStackSpecToEntry(
  entry: ShipperProductCatalogEntry,
  spec: Pick<ProductStackSpec, 'plates' | 'stackSides' | 'stackKgOem'>
): ShipperProductCatalogEntry {
  const sides = spec.stackSides > 0 ? spec.stackSides : countStackSides(entry.name, entry.sku);
  const stackWeights = distributeOemStackKg(spec.plates, sides, spec.stackKgOem);
  const machineTarget = round3(Math.max(0, entry.weightKgPerUnit - spec.stackKgOem));
  const machineIndices = entry.boxTypes
    .map((b, i) => (!isStackBoxType(b.boxType) ? i : -1))
    .filter((i) => i >= 0);
  const machineSplit = distributeEven(machineTarget, machineIndices.length);

  let stackIdx = 0;
  let machineIdx = 0;
  const boxTypes = entry.boxTypes.map((b) => {
    if (isStackBoxType(b.boxType)) {
      const w = stackWeights[stackIdx++] ?? 0;
      return { ...b, groupWeightKg: w };
    }
    const w = machineSplit[machineIdx++] ?? 0;
    return { ...b, groupWeightKg: w };
  });

  const weightKgPerUnit = round3(boxTypes.reduce((sum, b) => sum + b.groupWeightKg, 0));
  const volumeM3PerUnit = boxTypes.reduce((sum, b) => sum + b.volumeM3, 0);

  return {
    ...entry,
    boxTypes,
    weightKgPerUnit,
    volumeM3PerUnit,
  };
}

export function parseOemStackKg(
  specs: Record<string, string | undefined>,
  rawText?: string
): number | null {
  const raw = specs.weight_stack ?? specs.weight_stacks ?? specs.weight_stock ?? rawText ?? '';
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m) return Number(m[1]!.replace(',', '.'));
  const m2 = raw.match(/(\d+(?:[.,]\d+)?)\s*lbs?\/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (m2) return Number(m2[2]!.replace(',', '.'));
  return null;
}

const INTERFIT_PATH = join(
  process.cwd(),
  'docs/homolog/_medidas-buckler/interfit-464-483-base.json'
);
const CURATED_PATH = join(process.cwd(), 'docs/homolog/realleader-catalog-curated.json');
export const BUCKLER_STACK_SPECS_JSON = join(
  process.cwd(),
  'docs/homolog/buckler-stack-specs.json'
);

function loadCuratedStackKg(): Map<string, { kg: number; raw: string | null }> {
  try {
    const doc = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as {
      catalogs: Array<{ lines?: Array<{ products?: Array<Record<string, unknown>> }> }>;
    };
    const map = new Map<string, { kg: number; raw: string | null }>();
    for (const cat of doc.catalogs ?? []) {
      for (const line of cat.lines ?? []) {
        for (const p of line.products ?? []) {
          const sku = String(p.sku ?? '').toUpperCase();
          if (!sku) continue;
          const specs = (p.specs ?? {}) as Record<string, string>;
          const kg = parseOemStackKg(specs, String(p.rawText ?? ''));
          if (kg == null) continue;
          const prev = map.get(sku);
          if (!prev || kg > prev.kg) {
            map.set(sku, {
              kg,
              raw: specs.weight_stack ?? specs.weight_stacks ?? specs.weight_stock ?? null,
            });
          }
        }
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveStackKgOem(
  sku: string,
  micSpecs: ReturnType<typeof loadRealleaderMicProductSpecs>,
  curated: Map<string, { kg: number; raw: string | null }>
): { stackKgOem: number; stackKgSource: string; oemRaw?: string | null } | null {
  for (const key of [sku, `${sku}A`, `${sku}B`]) {
    const mic = micSpecs.get(key);
    if (mic?.weightStackKg) {
      return {
        stackKgOem: mic.weightStackKg,
        stackKgSource: 'realleader-mic-product-specs',
        oemRaw: mic.weightStackRaw,
      };
    }
    const oem = curated.get(key);
    if (oem) {
      return {
        stackKgOem: oem.kg,
        stackKgSource: 'realleader-catalog-curated',
        oemRaw: oem.raw,
      };
    }
  }
  return null;
}

/** Infer stack kg quando OEM ausente — split kit Medidas (média planilha). */
export function inferStackKgFromKitEntry(entry: ShipperProductCatalogEntry): number {
  const machineBoxes = entry.boxTypes.filter((b) => !isStackBoxType(b.boxType));
  const divisor = Math.max(entry.boxTypes.length, 1);
  const avg = entry.weightKgPerUnit / divisor;
  return round3(Math.max(0, entry.weightKgPerUnit - avg * machineBoxes.length));
}

/** Placas (Interfit) + stack kg OEM (`realleader-mic-product-specs.json`). */
export function loadBucklerStackSpecsFromHomolog(): Map<string, ProductStackSpec> {
  const interfit = JSON.parse(readFileSync(INTERFIT_PATH, 'utf8')) as {
    rows?: Array<{
      code: string;
      name: string;
      weightStackPallet: string;
      grossKg: string;
    }>;
  };

  loadRealleaderMicCatalog(REALLEADER_MIC_CATALOG_JSON);
  const micSpecs = loadRealleaderMicProductSpecs(REALLEADER_MIC_PRODUCT_SPECS_JSON);
  const curated = loadCuratedStackKg();

  const map = new Map<string, ProductStackSpec>();
  for (const row of interfit.rows ?? []) {
    const plates = Number(String(row.weightStackPallet ?? '').replace(',', '.')) || 0;
    if (plates <= 0) continue;
    const sku = row.code.trim().toUpperCase();
    const resolved = resolveStackKgOem(sku, micSpecs, curated);
    const kitGrossKg = Number(String(row.grossKg ?? '').replace(',', '.')) || 0;
    map.set(sku, {
      sku,
      plates,
      stackSides: countStackSides(row.name, sku),
      stackKgOem: resolved?.stackKgOem ?? 0,
      stackKgSource: resolved?.stackKgSource ?? 'infer-on-rebuild',
      platesSource: 'interfit-464-483-base',
      kitGrossKg: kitGrossKg > 0 ? kitGrossKg : undefined,
      oemRaw: resolved?.oemRaw ?? null,
    });
  }
  return map;
}

export function loadBucklerStackSpecsJson(): Map<string, ProductStackSpec> {
  const raw = JSON.parse(readFileSync(BUCKLER_STACK_SPECS_JSON, 'utf8')) as {
    specs: ProductStackSpec[];
  };
  return new Map(raw.specs.map((s) => [s.sku.toUpperCase(), s]));
}
