/**
 * Cruza JSON packing Konnen (formato planilha UI) vs fixture merged vs opcional DB export.
 *
 *   npx tsx scripts/compare-konnen-packing-json.ts --json=tmp/user-packing.json
 *   npx tsx scripts/compare-konnen-packing-json.ts --json=tmp/user-packing.json --db=tmp/konnen-db-export.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
} from '../src/lib/shipper-product-catalog';

type PackingRow = Record<string, string>;

function arg(path: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${path}=`));
  return hit?.slice(path.length + 1)?.trim();
}

function parseNum(v: string | undefined): number | null {
  if (v == null || v === '' || v === '—') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseCx(
  v: string | undefined
): { frames: number; bats: number; totalBoxes: number } | null {
  if (!v || v === '—') return null;
  const m = v.match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return null;
  const frames = parseInt(m[1]!, 10);
  const bats = m[2] ? parseInt(m[2]!, 10) : 0;
  return { frames, bats, totalBoxes: frames + bats };
}

/** "2320×530×955; 1025×360×1015" ou "—" */
function parseDimsList(raw: string | undefined): Array<[number, number, number]> {
  if (!raw || raw === '—') return [];
  return raw
    .split(';')
    .map((part) => {
      const nums = part
        .trim()
        .split('×')
        .map((n) => parseInt(n.replace(/\D/g, ''), 10));
      if (nums.length !== 3 || nums.some((n) => !n)) return null;
      // Planilha: C×A×L → length=C, width=L, height=A (padrão Impulse/Konnen)
      const [c, a, l] = nums;
      return [c, l, a] as [number, number, number];
    })
    .filter((x): x is [number, number, number] => x !== null);
}

function normalizeSku(raw: string): string | null {
  const s = raw.replace(/^▸/, '').trim();
  const m = s.match(/^([A-Z0-9][A-Z0-9/-]*)/i);
  return m ? m[1]!.toUpperCase() : null;
}

type ParentProduct = {
  sku: string;
  label: string;
  description: string;
  cx: string;
  dims: Array<[number, number, number]>;
  weightNet: number | null;
  weightGross: number | null;
  cbm: number | null;
  weightComplete: number | null;
  cbmComplete: number | null;
  source: string;
  frameCount: number;
};

function parseParentProducts(rows: PackingRow[]): ParentProduct[] {
  const out: ParentProduct[] = [];
  for (const row of rows) {
    const rawSku = row['SKU / CAIXA▲'] ?? '';
    if (!rawSku.startsWith('▸')) continue;
    const sku = normalizeSku(rawSku);
    if (!sku) continue;
    const cx = row['CX▲'] ?? '';
    const parsedCx = parseCx(cx);
    out.push({
      sku,
      label: rawSku.replace(/^▸/, '').trim(),
      description: (row['DESCRIÇÃO▲'] ?? '').trim(),
      cx,
      dims: parseDimsList(row['CAIXA C×A×L (MM)▲']),
      weightNet: parseNum(row['P.LÍQ▲']),
      weightGross: parseNum(row['P.BRUTO▲']),
      cbm: parseNum(row['CBM▲']),
      weightComplete: parseNum(row['P.COMPLETO▲']),
      cbmComplete: parseNum(row['CBM COMPLETO▲']),
      source: (row['FONTE▲'] ?? '').trim(),
      frameCount: parsedCx?.frames ?? 0,
    });
  }
  return out;
}

type DbProduct = {
  sku: string;
  name: string;
  boxes_total: number;
  box_types_count: number;
  weight_kg_per_unit: number;
  volume_m3_per_unit: number;
  boxes: Array<{
    box_type: string;
    length_mm: number;
    width_mm: number;
    height_mm: number;
    boxes_per_unit: number;
    group_weight_kg: number;
    volume_m3: number;
  }>;
};

type Diff = {
  sku: string;
  status: 'ok' | 'missing_db' | 'missing_fixture' | 'weight' | 'volume' | 'boxes' | 'dims';
  detail: string;
};

const TOL_WEIGHT = 0.5;
const TOL_VOL = 0.02;

function compareDims(
  jsonDims: Array<[number, number, number]>,
  dbDims: Array<[number, number, number]>
): boolean {
  if (jsonDims.length === 0 && dbDims.length === 0) return true;
  if (jsonDims.length !== dbDims.length) return false;
  const norm = (d: [number, number, number]) => [...d].sort((a, b) => a - b).join(',');
  const a = jsonDims.map(norm).sort();
  const b = dbDims.map(norm).sort();
  return a.every((v, i) => v === b[i]);
}

function main() {
  const jsonPath = arg('--json');
  if (!jsonPath) {
    console.error('Usage: --json=path [--db=path]');
    process.exit(1);
  }

  const userRows = JSON.parse(readFileSync(jsonPath, 'utf-8')) as PackingRow[];
  const parents = parseParentProducts(userRows);

  const fixturePath = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
  const fixtureRows = JSON.parse(readFileSync(fixturePath, 'utf-8')) as ShipperCatalogRawRow[];
  const fixtureCatalog = buildShipperProductCatalog(fixtureRows);

  const dbPath = arg('--db');
  const dbMap = new Map<string, DbProduct>();
  if (dbPath) {
    const dbRows = JSON.parse(readFileSync(dbPath, 'utf-8')) as DbProduct[];
    for (const p of dbRows) dbMap.set(p.sku.toUpperCase(), p);
  }

  const diffs: Diff[] = [];
  let ok = 0;

  for (const p of parents) {
    const fix = fixtureCatalog.get(p.sku);
    const db = dbMap.get(p.sku);

    if (!fix && !db) {
      diffs.push({ sku: p.sku, status: 'missing_fixture', detail: 'ausente no fixture merged' });
      continue;
    }

    const ref = db ?? {
      weight: fix!.weightKgPerUnit,
      volume: fix!.volumeM3PerUnit,
      boxes: fix!.boxesTotal,
      dims: fix!.boxTypes.map(
        (b) => [b.lengthMm, b.widthMm, b.heightMm] as [number, number, number]
      ),
      name: fix!.name,
    };

    const weight = db ? db.weight_kg_per_unit : fix!.weightKgPerUnit;
    const volume = db ? db.volume_m3_per_unit : fix!.volumeM3PerUnit;
    const boxes = db ? db.boxes_total : fix!.boxesTotal;
    const dims = db
      ? db.boxes.map((b) => [b.length_mm, b.width_mm, b.height_mm] as [number, number, number])
      : fix!.boxTypes.map((b) => [b.lengthMm, b.widthMm, b.heightMm] as [number, number, number]);

    const refWeight = p.weightComplete ?? p.weightGross;
    const refVol = p.cbmComplete ?? p.cbm;

    let hasIssue = false;

    if (refWeight != null && Math.abs(weight - refWeight) > TOL_WEIGHT) {
      diffs.push({
        sku: p.sku,
        status: 'weight',
        detail: `JSON ${refWeight} vs catálogo ${weight.toFixed(3)} (Δ ${(weight - refWeight).toFixed(2)} kg)`,
      });
      hasIssue = true;
    }

    if (refVol != null && Math.abs(volume - refVol) > TOL_VOL) {
      diffs.push({
        sku: p.sku,
        status: 'volume',
        detail: `JSON ${refVol} vs catálogo ${volume.toFixed(4)} m³ (Δ ${(volume - refVol).toFixed(3)})`,
      });
      hasIssue = true;
    }

    if (p.frameCount > 0 && boxes !== p.frameCount && p.cx.includes('+') === false) {
      // só caixas frame (sem bateria no CX)
      if (boxes !== parseInt(p.cx, 10)) {
        diffs.push({
          sku: p.sku,
          status: 'boxes',
          detail: `JSON CX=${p.cx} (${p.frameCount} frames) vs catálogo boxes_total=${boxes}`,
        });
        hasIssue = true;
      }
    }

    if (p.dims.length > 0 && !compareDims(p.dims, dims)) {
      diffs.push({
        sku: p.sku,
        status: 'dims',
        detail: `JSON [${p.dims.map((d) => d.join('×')).join('; ')}] vs catálogo [${dims.map((d) => d.join('×')).join('; ')}]`,
      });
      hasIssue = true;
    }

    if (!hasIssue) ok++;
  }

  const jsonSkus = new Set(parents.map((p) => p.sku));
  const fixtureOnly = [...fixtureCatalog.keys()].filter((s) => !jsonSkus.has(s));
  const jsonOnly = parents.filter((p) => !fixtureCatalog.has(p.sku)).map((p) => p.sku);

  console.log(
    JSON.stringify(
      {
        summary: {
          json_parent_skus: parents.length,
          fixture_skus: fixtureCatalog.size,
          db_skus: dbMap.size || null,
          matched_ok: ok,
          diffs: diffs.length,
          json_only_count: jsonOnly.length,
          fixture_only_count: fixtureOnly.length,
        },
        json_only: jsonOnly.sort(),
        fixture_only_sample: fixtureOnly.sort().slice(0, 40),
        diffs_by_status: diffs.reduce(
          (acc, d) => {
            acc[d.status] = (acc[d.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        diffs: diffs.slice(0, 80),
      },
      null,
      2
    )
  );
}

main();
