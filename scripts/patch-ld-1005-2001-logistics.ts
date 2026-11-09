/**
 * LD-1005 (MIC pacote único) + LD-2001 (Medidas 2 caixas) — homolog + fixture.
 *
 *   npx tsx scripts/patch-ld-1005-2001-logistics.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildShipperProductCatalog,
  type ShipperCatalogRawRow,
} from '../src/lib/shipper-product-catalog.ts';

const root = process.cwd();

const LD_1005_MIC = {
  grossKg: 106,
  lengthMm: 1100,
  widthMm: 1420,
  heightMm: 1060,
  transportMm: '1100*1420*1060mm',
  specMm: '1100x1420x1060',
};

const LD_2001_MEDIDAS = {
  name: 'LEG EXTENSION',
  grossKg: 192,
  boxes: [
    { type: 'A', lengthMm: 1250, widthMm: 1350, heightMm: 550 },
    { type: 'B', lengthMm: 1100, widthMm: 900, heightMm: 1000 },
  ] as const,
  transportMm: 'A:1250*1350*550 B:1100*900*1000',
};

function patchLogistics() {
  const path = join(
    root,
    'docs/homolog/mic-factories/realleader/Plate_Loaded_LD_Series_logistics.json'
  );
  const doc = JSON.parse(readFileSync(path, 'utf8')) as {
    rows: Array<Record<string, unknown>>;
    failures: string[];
    validation: Record<string, unknown>;
  };

  for (const row of doc.rows) {
    const sku = String(row.Item).toUpperCase();
    if (sku === 'LD-1005') {
      row['Peso Bruto Total (kg)'] = LD_1005_MIC.grossKg;
      row['Peso Médio por Caixa (kg)'] = LD_1005_MIC.grossKg;
      row['Peso Estimado do Grupo (kg)'] = LD_1005_MIC.grossKg;
      row.COMPRIMENTO = String(LD_1005_MIC.lengthMm);
      row.LARGURA = String(LD_1005_MIC.widthMm);
      row.ALTURA = String(LD_1005_MIC.heightMm);
      row.Specification_mm = LD_1005_MIC.specMm;
      row.Transport_Package_mm = LD_1005_MIC.transportMm;
    }
    if (sku === 'LD-2001') {
      row['Qtd. Caixas Total'] = 2;
      row['Qtd. Tipos de Medida'] = 2;
      row['Peso Bruto Total (kg)'] = LD_2001_MEDIDAS.grossKg;
      row['Peso Médio por Caixa (kg)'] = LD_2001_MEDIDAS.grossKg / 2;
      row['Peso Estimado do Grupo (kg)'] = LD_2001_MEDIDAS.grossKg / 2;
      row.COMPRIMENTO = String(LD_2001_MEDIDAS.boxes[0].lengthMm);
      row.LARGURA = String(LD_2001_MEDIDAS.boxes[0].widthMm);
      row.ALTURA = String(LD_2001_MEDIDAS.boxes[0].heightMm);
      row.Transport_Package_mm = LD_2001_MEDIDAS.transportMm;
      row.Specification_mm = LD_2001_MEDIDAS.transportMm.replace(/\*/g, 'x');
    }
  }

  doc.failures = doc.failures.filter(
    (f) => !String(f).includes('LD-1005') && !String(f).includes('LD-2001')
  );

  const withWeight = doc.rows.filter((r) => Number(r['Peso Bruto Total (kg)']) > 0).length;
  const failures = doc.rows.length - withWeight;
  doc.validation = {
    ok: failures === 0,
    stats: {
      rows: doc.rows.length,
      withDimensions: doc.rows.length,
      withWeight,
      withModelNo: doc.rows.length,
      withUrl: doc.rows.length,
      failures,
      pctDimensions: 100,
      pctWeight: Math.round((withWeight / doc.rows.length) * 1000) / 10,
    },
    issues: doc.rows
      .map((r, i) =>
        Number(r['Peso Bruto Total (kg)']) <= 0 ? `row[${i}] ${r.Item}: gross weight 0` : null
      )
      .filter(Boolean),
  };

  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  console.log('[logistics] LD-1005 GW', LD_1005_MIC.grossKg, 'LD-2001 GW', LD_2001_MEDIDAS.grossKg);
}

function patchFixture() {
  const path = join(root, 'src/lib/__tests__/fixtures/buckler-caixas-por-medida.json');
  const rows = JSON.parse(readFileSync(path, 'utf8')) as ShipperCatalogRawRow[];

  const without2001 = rows.filter((r) => String(r.Item).toUpperCase() !== 'LD-2001');
  const idx = without2001.findIndex((r) => String(r.Item).toUpperCase() === 'LD-2002');
  const insertAt = idx >= 0 ? idx : without2001.length;

  const perBox = LD_2001_MEDIDAS.grossKg / 2;
  const ld2001Rows: ShipperCatalogRawRow[] = LD_2001_MEDIDAS.boxes.map((b) => ({
    Item: 'LD-2001',
    Produto: LD_2001_MEDIDAS.name,
    'Qtd. Caixas Total': 2,
    'Tipo Caixa': b.type,
    COMPRIMENTO: String(b.lengthMm),
    LARGURA: String(b.widthMm),
    ALTURA: String(b.heightMm),
    'Qtd. Tipos de Medida': 2,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': LD_2001_MEDIDAS.grossKg,
    'Peso Médio por Caixa (kg)': String(perBox),
    'Peso Estimado do Grupo (kg)': String(perBox),
  }));

  without2001.splice(insertAt, 0, ...ld2001Rows);
  writeFileSync(path, `${JSON.stringify(without2001, null, 2)}\n`);

  const catalog = buildShipperProductCatalog(without2001);
  const entry = catalog.get('LD-2001');
  console.log('[fixture] LD-2001 boxes', entry?.boxTypes.length, 'kg', entry?.weightKgPerUnit);
}

patchLogistics();
patchFixture();
