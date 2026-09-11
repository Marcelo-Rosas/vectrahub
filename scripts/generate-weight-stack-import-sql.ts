/**
 * Gera lotes SQL para import (evita limite de tamanho no MCP).
 *   npx tsx scripts/generate-weight-stack-import-sql.ts --batch=0 --batch-size=10
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { WeightStackComplement } from '../src/lib/weight-stack-complements';

const KONNEN_COMPANY_ID = '0c28d840-6076-4e72-b3be-b13195121686';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function sqlStr(v: string | null): string {
  if (v == null) return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlForComplement(c: WeightStackComplement): string {
  const lines: string[] = [];
  lines.push(`-- ${c.sku}`);
  lines.push(`DO $$`);
  lines.push(`DECLARE`);
  lines.push(`  fp_id UUID;`);
  lines.push(`  sp_id UUID;`);
  lines.push(`BEGIN`);
  lines.push(`  UPDATE feira.products SET`);
  lines.push(`    has_weight_stack = true,`);
  lines.push(`    weight_stack_sku = ${sqlStr(c.weightStackSku)},`);
  lines.push(`    weight_stack_boxes_count = ${c.boxes.length},`);
  lines.push(`    weight_kg_with_stack = ${c.weightKgWithStack},`);
  lines.push(`    volume_m3_with_stack = ${c.volumeM3WithStack},`);
  lines.push(`    boxes_total_with_stack = ${c.boxesTotalWithStack}`);
  lines.push(`  WHERE company_id = '${KONNEN_COMPANY_ID}' AND sku = ${sqlStr(c.sku)}`);
  lines.push(`  RETURNING id INTO fp_id;`);
  lines.push(`  IF fp_id IS NOT NULL THEN`);
  lines.push(
    `    DELETE FROM feira.product_boxes WHERE product_id = fp_id AND box_role = 'weight_stack';`
  );
  for (const b of c.boxes) {
    const vol = b.volumeM3 ?? (b.lengthMm * b.widthMm * b.heightMm) / 1e9;
    lines.push(
      `    INSERT INTO feira.product_boxes (product_id, box_type, length_mm, width_mm, height_mm, boxes_per_unit, group_weight_kg, volume_m3, box_role) VALUES (fp_id, ${sqlStr(b.boxType)}, ${b.lengthMm}, ${b.widthMm}, ${b.heightMm}, 1, ${b.groupWeightKg}, ${vol}, 'weight_stack');`
    );
  }
  lines.push(`  END IF;`);
  lines.push(`  SELECT sp.id INTO sp_id FROM public.shipper_products sp`);
  lines.push(`    JOIN public.shippers s ON s.id = sp.shipper_id`);
  lines.push(`    WHERE s.name ILIKE '%KONNEN%' AND sp.sku = ${sqlStr(c.sku)} LIMIT 1;`);
  lines.push(`  IF sp_id IS NOT NULL THEN`);
  lines.push(`    UPDATE public.shipper_products SET`);
  lines.push(`      has_weight_stack = true,`);
  lines.push(`      weight_stack_sku = ${sqlStr(c.weightStackSku)},`);
  lines.push(`      weight_stack_boxes_count = ${c.boxes.length},`);
  lines.push(`      weight_kg_with_stack = ${c.weightKgWithStack},`);
  lines.push(`      volume_m3_with_stack = ${c.volumeM3WithStack},`);
  lines.push(`      boxes_total_with_stack = ${c.boxesTotalWithStack}`);
  lines.push(`    WHERE id = sp_id;`);
  lines.push(
    `    DELETE FROM public.shipper_product_boxes WHERE product_id = sp_id AND box_role = 'weight_stack';`
  );
  for (const b of c.boxes) {
    const vol = b.volumeM3 ?? (b.lengthMm * b.widthMm * b.heightMm) / 1e9;
    lines.push(
      `    INSERT INTO public.shipper_product_boxes (product_id, box_type, length_mm, width_mm, height_mm, boxes_per_unit, group_weight_kg, volume_m3, box_role) VALUES (sp_id, ${sqlStr(b.boxType)}, ${b.lengthMm}, ${b.widthMm}, ${b.heightMm}, 1, ${b.groupWeightKg}, ${vol}, 'weight_stack');`
    );
  }
  lines.push(`  END IF;`);
  lines.push(`END $$;`);
  return lines.join('\n');
}

function main() {
  const fixturePath = join(
    process.cwd(),
    'src/lib/__tests__/fixtures/konnen-weight-stack-complements.json'
  );
  const complements = JSON.parse(readFileSync(fixturePath, 'utf-8')) as WeightStackComplement[];
  const batchSize = parseInt(arg('--batch-size') ?? '10', 10);
  const batchIdx = arg('--batch');

  if (batchIdx != null) {
    const i = parseInt(batchIdx, 10);
    const slice = complements.slice(i * batchSize, (i + 1) * batchSize);
    console.log('BEGIN;');
    for (const c of slice) console.log(sqlForComplement(c));
    console.log('COMMIT;');
    return;
  }

  mkdirSync(join(process.cwd(), 'tmp'), { recursive: true });
  const batches = Math.ceil(complements.length / batchSize);
  for (let i = 0; i < batches; i++) {
    const slice = complements.slice(i * batchSize, (i + 1) * batchSize);
    const sql = ['BEGIN;', ...slice.map(sqlForComplement), 'COMMIT;'].join('\n\n');
    const path = join(process.cwd(), 'tmp', `import-weight-stacks-batch-${i}.sql`);
    writeFileSync(path, `${sql}\n`);
    console.log(`batch ${i}: ${slice.length} SKUs → ${path} (${sql.length} bytes)`);
  }
}

main();
