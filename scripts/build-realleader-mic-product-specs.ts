/**
 * Monta realleader-mic-product-specs.json — rota canônica MIC.
 * Index: realleader-mic-catalog.json. Stack kg: scrape MIC; lacunas → seed OEM (1x, commit JSON).
 *
 *   npx tsx scripts/build-realleader-mic-product-specs.ts
 *   npx tsx scripts/build-realleader-mic-product-specs.ts --no-seed-stack
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseOemStackKg } from '../src/lib/buckler-stack-spec.ts';
import {
  loadRealleaderMicCatalog,
  loadRealleaderMicProductSpecs,
  saveRealleaderMicProductSpecs,
  type RealleaderMicProductSpec,
} from '../src/lib/realleader-mic-product-specs.ts';

const seedStack = !process.argv.includes('--no-seed-stack');
const INTERFIT_PATH = join(
  process.cwd(),
  'docs/homolog/_medidas-buckler/interfit-464-483-base.json'
);
const CURATED_PATH = join(process.cwd(), 'docs/homolog/realleader-catalog-curated.json');

function loadCuratedStackKg(): Map<string, { kg: number; raw: string | null }> {
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
}

function main() {
  const mic = loadRealleaderMicCatalog();
  const scraped = loadRealleaderMicProductSpecs();
  const curated = seedStack ? loadCuratedStackKg() : new Map();

  const interfit = JSON.parse(readFileSync(INTERFIT_PATH, 'utf8')) as {
    rows?: Array<{ code: string; weightStackPallet: string }>;
  };

  const specs: RealleaderMicProductSpec[] = [];
  let seeded = 0;
  let missingMic = 0;

  for (const row of interfit.rows ?? []) {
    const plates = Number(String(row.weightStackPallet ?? '').replace(',', '.')) || 0;
    if (plates <= 0) continue;
    const sku = row.code.trim().toUpperCase();
    const index = mic.skuIndex[sku];
    if (!index) {
      missingMic++;
      continue;
    }

    const prev = scraped.get(sku);
    let weightStackKg = prev?.weightStackKg ?? null;
    let weightStackRaw = prev?.weightStackRaw ?? null;

    if (weightStackKg == null && seedStack) {
      const oem = curated.get(sku);
      if (oem) {
        weightStackKg = oem.kg;
        weightStackRaw = oem.raw;
        seeded++;
      }
    }

    if (weightStackKg == null) continue;

    specs.push({
      sku,
      productUrl: index.productUrl,
      line: index.line,
      scrapedAt: prev?.scrapedAt ?? null,
      weightStackKg,
      weightStackRaw,
      packageGrossKg: prev?.packageGrossKg ?? null,
      specificationMm: prev?.specificationMm ?? null,
      transportPackageMm: prev?.transportPackageMm ?? null,
      packageSizeCm: prev?.packageSizeCm ?? null,
    });
  }

  saveRealleaderMicProductSpecs(specs);
  console.log('[mic-specs] SKUs com stack kg:', specs.length);
  console.log('[mic-specs] seeded from OEM gap-fill:', seeded);
  console.log('[mic-specs] sem URL MIC:', missingMic);
}

main();
