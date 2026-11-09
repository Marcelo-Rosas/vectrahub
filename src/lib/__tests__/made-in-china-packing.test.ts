import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  extractGrossKgFromText,
  extractDimsFromText,
  extractGlCatalogProductLinks,
  extractPackingFromHtml,
  extractSkuFromText,
  htmlToPlainText,
} from '@/lib/made-in-china-packing';

const GL1007_HTML_CANDIDATES = [
  join(
    process.cwd(),
    '../.cursor/projects/c-Users-marce-vectra-hub/uploads/China-Good-Quality-Fitness-EquipmentWh-olesalers-Factory-Direct-Supply-Sport-Machine-Gl-1007-Prone-Glute-Machine-for-Body-Equipment-0.html'
  ),
  join(process.cwd(), 'docs/homolog/_mic-cache/gl-1007.html'),
];

function loadGl1007Html(): string | null {
  for (const p of GL1007_HTML_CANDIDATES) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return null;
}

describe('made-in-china-packing', () => {
  const gl1007Html = loadGl1007Html();

  it.skipIf(!gl1007Html)('GL-1007 HTML local — SKU + dims + GW', () => {
    const text = htmlToPlainText(gl1007Html!);
    expect(extractSkuFromText(text)).toBe('GL-1007');
    const dims = extractDimsFromText(text)!;
    expect(dims[0]).toBeGreaterThanOrEqual(1090);
    expect(dims[0]).toBeLessThanOrEqual(1095);
    expect(dims[1]).toBe(2100);
    expect(dims[2]).toBe(1620);
    expect(extractGrossKgFromText(text)).toBe(281);
  });

  it.skipIf(!gl1007Html)('monta row ShipperCatalogRawRow', () => {
    const row = extractPackingFromHtml(
      gl1007Html!,
      'https://realleaderfitness.en.made-in-china.com/product/maKpSCLOroUZ/China-Good-Quality-Fitness-EquipmentWh-olesalers-Factory-Direct-Supply-Sport-Machine-Gl-1007-Prone-Glute-Machine-for-Body-Equipment.html'
    );
    expect(row?.Item).toBe('GL-1007');
    expect(row?.['Peso Bruto Total (kg)']).toBe(281);
    expect(row?.LARGURA).toBe('2100');
  });

  it('regex dims/peso — strings típicas Realleader', () => {
    const sample =
      'ITEM NO.: GL-1007 SET UP DIMENSION: 1094x2100x1620mm N.W. / G.W.: 225kg 496lbs/281kg 620lbs';
    expect(extractSkuFromText(sample)).toBe('GL-1007');
    expect(extractGrossKgFromText(sample)).toBe(281);
    const dims = extractDimsFromText(sample)!;
    expect(dims[1]).toBe(2100);
  });
});

describe('extractGlCatalogProductLinks', () => {
  it('mapeia GL-xxxx da listagem catálogo', () => {
    const html = `
      <a href="/product/abc/Gl-1001-Buttocks-Bridge.html">Gl-1001 Bridge</a>
      <a href="/product/def/Gl-1007-Prone.html">Gl-1007 Prone</a>
    `;
    const links = extractGlCatalogProductLinks(
      html,
      'https://realleaderfitness.en.made-in-china.com/'
    );
    expect(links.get('GL-1001')).toContain('Gl-1001');
    expect(links.get('GL-1007')).toContain('Gl-1007');
  });
});
