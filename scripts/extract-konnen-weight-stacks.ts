/**
 * Extrai complementos de baterias de peso do JSON packing Konnen (formato planilha UI)
 * e grava fixture para import.
 *
 *   npx tsx scripts/extract-konnen-weight-stacks.ts --json=tmp/user-packing.json
 *   npx tsx scripts/extract-konnen-weight-stacks.ts --json=tmp/user-packing.json --out=src/lib/__tests__/fixtures/konnen-weight-stack-complements.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  buildShipperProductCatalog,
  boxVolumeM3,
  type ShipperCatalogRawRow,
} from '../src/lib/shipper-product-catalog';
import type { WeightStackComplement } from '../src/lib/weight-stack-complements';

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

function parseCx(v: string | undefined): { frames: number; bats: number } | null {
  if (!v || v === '—') return null;
  const m = v.match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return null;
  return { frames: parseInt(m[1]!, 10), bats: m[2] ? parseInt(m[2]!, 10) : 0 };
}

function parseDims(raw: string | undefined): [number, number, number] | null {
  if (!raw || raw === '—') return null;
  const part = raw.split(';')[0]?.trim() ?? '';
  const nums = part.split('×').map((n) => parseInt(n.replace(/\D/g, ''), 10));
  if (nums.length !== 3 || nums.some((n) => !n)) return null;
  const [c, a, l] = nums;
  return [c, l, a];
}

function normalizeSku(raw: string): string | null {
  const s = raw.replace(/^▸/, '').trim();
  const m = s.match(/^([A-Z0-9][A-Z0-9/-]*)/i);
  return m ? m[1]!.toUpperCase() : null;
}

function parseBatSku(raw: string): { parentSku: string; boxIndex: number } | null {
  const s = raw.replace(/^▸/, '').trim().toUpperCase();
  const m = s.match(/^([A-Z0-9]+)-BAT-(\d+)BAT$/);
  if (!m) return null;
  return { parentSku: m[1]!, boxIndex: parseInt(m[2]!, 10) };
}

function main() {
  const jsonPath = arg('--json');
  if (!jsonPath) {
    console.error('Usage: --json=path [--out=path]');
    process.exit(1);
  }

  const outPath =
    arg('--out') ??
    join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-weight-stack-complements.json');

  const rows = JSON.parse(readFileSync(jsonPath, 'utf-8')) as PackingRow[];
  const parents = new Map<
    string,
    {
      cx: string;
      weightComplete: number | null;
      cbmComplete: number | null;
      weightStackSku: string | null;
    }
  >();

  for (const row of rows) {
    const rawSku = row['SKU / CAIXA▲'] ?? '';
    if (!rawSku.startsWith('▸')) continue;
    const sku = normalizeSku(rawSku);
    if (!sku) continue;
    const cx = row['CX▲'] ?? '';
    const parsed = parseCx(cx);
    if (!parsed || parsed.bats <= 0) continue;
    parents.set(sku, {
      cx,
      weightComplete: parseNum(row['P.COMPLETO▲']),
      cbmComplete: parseNum(row['CBM COMPLETO▲']),
      weightStackSku: (row['BAT (LBS)▲'] ?? '').trim() || null,
    });
  }

  const batRows = new Map<
    string,
    Map<number, { gw: number; dims: [number, number, number] | null }>
  >();
  for (const row of rows) {
    const rawSku = row['SKU / CAIXA▲'] ?? '';
    if (rawSku.startsWith('▸')) continue;
    const parsed = parseBatSku(rawSku);
    if (!parsed) continue;
    const gw = parseNum(row['P.BRUTO▲']) ?? parseNum(row['P.LÍQ▲']);
    if (gw == null) continue;
    const dims = parseDims(row['CAIXA C×A×L (MM)▲']);
    const byParent = batRows.get(parsed.parentSku) ?? new Map();
    byParent.set(parsed.boxIndex, { gw, dims });
    batRows.set(parsed.parentSku, byParent);
  }

  const fixturePath = join(process.cwd(), 'src/lib/__tests__/fixtures/konnen-catalog-merged.json');
  const catalog = buildShipperProductCatalog(
    JSON.parse(readFileSync(fixturePath, 'utf-8')) as ShipperCatalogRawRow[]
  );

  const complements: WeightStackComplement[] = [];

  for (const [sku, parent] of parents) {
    const entry = catalog.get(sku);
    if (!entry) continue;
    const parsedCx = parseCx(parent.cx);
    if (!parsedCx) continue;

    const bats = batRows.get(sku);
    const boxes = [];
    if (bats && bats.size > 0) {
      for (const [idx, bat] of [...bats.entries()].sort((a, b) => a[0] - b[0])) {
        const dims = bat.dims ?? [305, 150, 130];
        boxes.push({
          boxType: `BAT${idx}`,
          lengthMm: dims[0],
          widthMm: dims[1],
          heightMm: dims[2],
          groupWeightKg: Math.round(bat.gw * 10) / 10,
        });
      }
    } else if (parent.weightComplete != null) {
      const deltaKg = parent.weightComplete - entry.weightKgPerUnit;
      const perBox = Math.round((deltaKg / parsedCx.bats) * 10) / 10;
      for (let i = 1; i <= parsedCx.bats; i++) {
        boxes.push({
          boxType: `BAT${i}`,
          lengthMm: 305,
          widthMm: 150,
          heightMm: 130,
          groupWeightKg: perBox,
        });
      }
    }

    if (boxes.length === 0) continue;

    const volumeM3WithStack =
      parent.cbmComplete ??
      entry.volumeM3PerUnit +
        boxes.reduce((s, b) => s + boxVolumeM3(b.lengthMm, b.widthMm, b.heightMm, 1), 0);

    complements.push({
      sku,
      weightStackSku: parent.weightStackSku,
      weightKgWithStack:
        parent.weightComplete ??
        entry.weightKgPerUnit + boxes.reduce((s, b) => s + b.groupWeightKg, 0),
      volumeM3WithStack,
      boxesTotalWithStack: parsedCx.frames + parsedCx.bats,
      boxes,
    });
  }

  complements.sort((a, b) => a.sku.localeCompare(b.sku));
  writeFileSync(outPath, `${JSON.stringify(complements, null, 2)}\n`, 'utf-8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        parents_with_bats: parents.size,
        complements_written: complements.length,
        out: outPath,
        sample: complements.slice(0, 5).map((c) => ({
          sku: c.sku,
          weightKgWithStack: c.weightKgWithStack,
          bats: c.boxes.length,
        })),
      },
      null,
      2
    )
  );
}

main();
