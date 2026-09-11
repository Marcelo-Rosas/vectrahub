/**
 * Extrai complementos de baterias do JSON medidas_data (formato rows/boxes/kind).
 *
 *   npx tsx scripts/extract-konnen-weight-stacks-medidas.ts --json=tmp/medidas_data.json
 *   npx tsx scripts/extract-konnen-weight-stacks-medidas.ts --json=tmp/medidas_data.json --out=src/lib/__tests__/fixtures/konnen-weight-stack-complements.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { WeightStackComplement } from '../src/lib/weight-stack-complements';

type MedidasBox = {
  id: string;
  nw: number | null;
  gw: number;
  cbm: number;
  dim: string | null;
  kind: 'frame' | 'bateria';
};

type MedidasRow = {
  sku: string;
  ncx: number;
  nbat: number;
  gw: number;
  cbm: number;
  bat: string | null;
  tgw: number | null;
  tcbm: number | null;
  boxes: MedidasBox[];
};

type MedidasFile = {
  rows: MedidasRow[];
  stats?: { total?: number; bateria?: number };
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function parseDims(raw: string | null): [number, number, number] | null {
  if (!raw) return null;
  const nums = raw.split('×').map((n) => parseInt(n.replace(/\D/g, ''), 10));
  if (nums.length !== 3 || nums.some((n) => !n)) return null;
  const [c, a, l] = nums;
  return [c, l, a];
}

/** Deriva dimensões a partir do CBM usando proporção típica FEWS (290×155 mm base). */
function dimsFromCbm(cbm: number): [number, number, number] {
  const baseL = 290;
  const baseW = 155;
  const heightMm = Math.max(50, Math.round((cbm / ((baseL / 1000) * (baseW / 1000))) * 1000));
  return [baseL, baseW, heightMm];
}

function mapBatToWeightStackSku(sku: string, bat: string): string {
  const prefix = sku.startsWith('IF') ? 'IF93WS' : sku.startsWith('IT') ? 'IT95WS' : 'FEWS';
  return `${prefix}-${bat}`;
}

function batBoxIndex(id: string): number {
  const m = id.match(/BAT(\d)?-(\d+)$/i);
  if (m) return parseInt(m[2]!, 10);
  const m2 = id.match(/BAT-(\d+)$/i);
  if (m2) return parseInt(m2[1]!, 10);
  return 0;
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

  const data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as MedidasFile;
  const complements: WeightStackComplement[] = [];

  for (const row of data.rows) {
    if (!row.nbat || row.nbat <= 0 || !row.bat) continue;

    const batBoxes = row.boxes
      .filter((b) => b.kind === 'bateria')
      .sort((a, b) => batBoxIndex(a.id) - batBoxIndex(b.id));

    if (batBoxes.length === 0) continue;

    const boxes = batBoxes.map((b, i) => {
      const dims = parseDims(b.dim) ?? dimsFromCbm(b.cbm);
      return {
        boxType: `BAT${i + 1}`,
        lengthMm: dims[0],
        widthMm: dims[1],
        heightMm: dims[2],
        groupWeightKg: Math.round(b.gw * 10) / 10,
        volumeM3: b.cbm,
      };
    });

    complements.push({
      sku: row.sku,
      weightStackSku: mapBatToWeightStackSku(row.sku, row.bat),
      weightKgWithStack: row.tgw ?? row.gw + boxes.reduce((s, b) => s + b.groupWeightKg, 0),
      volumeM3WithStack: row.tcbm ?? row.cbm + boxes.reduce((s, b) => s + b.volumeM3, 0),
      boxesTotalWithStack: row.ncx + row.nbat,
      boxes,
    });
  }

  complements.sort((a, b) => a.sku.localeCompare(b.sku));
  writeFileSync(outPath, `${JSON.stringify(complements, null, 2)}\n`, 'utf-8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        rows_with_bats: data.stats?.bateria ?? complements.length,
        complements_written: complements.length,
        out: outPath,
        sample: complements.slice(0, 3).map((c) => ({
          sku: c.sku,
          weightStackSku: c.weightStackSku,
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
