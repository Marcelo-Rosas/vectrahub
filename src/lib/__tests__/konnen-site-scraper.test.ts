import { describe, expect, it } from 'vitest';
import {
  extractSkuFromKonnenHtml,
  parseDimensionsMm,
  parseKonnenProductHtml,
  extractProductUrlsFromCategoryHtml,
} from '../../../scripts/lib/konnen-site-scraper';

const ABDOMINAL_DESC = `
<div class="woocommerce-Tabs-panel--description">
<h2>Descrição</h2>
<p><strong>Medida: </strong><span>1383 x 1202 x 1491 mm</span></p>
<p><strong>Peso: </strong><span>141.5 kg</span></p>
<p><strong>Carga de peso: </strong><span>106 kg</span></p>
</div>`;

describe('konnen-site-scraper', () => {
  it('parse product FE9714 abdominal', () => {
    const html = `<html><body><h1 class="product_title">ABDOMINAL</h1>
      <p><span>COD: FE9714</span></p>${ABDOMINAL_DESC}</body></html>`;
    const p = parseKonnenProductHtml(html, {
      lineId: 'exoform',
      lineLabel: 'Linha Exoform',
      url: 'https://www.konnenfitness.com.br/produto/exoform-abdominal/',
      group: 'baterias',
      profile: 'stack',
    });
    expect(p.sku).toBe('FE9714');
    expect(p.weightKg).toBe(141.5);
    expect(p.stackWeightKg).toBe(106);
    expect(p.stackLbs).toBe('235');
    expect(p.dimensionsMm).toEqual([1383, 1202, 1491]);
  });

  it('parse dimensões mm', () => {
    expect(parseDimensionsMm('1383 x 1202 x 1491 mm')).toEqual([1383, 1202, 1491]);
  });

  it('extrai COD com dois-pontos ou ponto', () => {
    expect(extractSkuFromKonnenHtml('<p>COD: IF9301</p>')).toBe('IF9301');
    expect(extractSkuFromKonnenHtml('<p>COD. LCS201</p>')).toBe('LCS201');
  });

  it('extrai URLs de categoria', () => {
    const html = `<a href="https://www.konnenfitness.com.br/produto/exoform-abdominal/">x</a>`;
    expect(extractProductUrlsFromCategoryHtml(html, 'https://www.konnenfitness.com.br')).toEqual([
      'https://www.konnenfitness.com.br/produto/exoform-abdominal/',
    ]);
  });
});
