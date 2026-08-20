import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  joinHyphenSplitLines,
  matchOrderLinesToCatalog,
  parseKonnenCargoValue,
  parseKonnenClient,
  parseKonnenOrderText,
  stripKonnenNoise,
  type KonnenParseResult,
} from '@/lib/fair-order-pdf-konnen';
import { buildShipperProductCatalog, stackLbsFromPdfWeightKg } from '@/lib/shipper-product-catalog';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(fixtureDir, 'fixtures/konnen-order-8144-extract.txt'), 'utf8');

type KonnenQuoteGolden = KonnenParseResult & {
  unmatched: { rawSku: string; quantity: number; hint: string }[];
};

const GOLDEN: KonnenQuoteGolden = JSON.parse(
  readFileSync(join(fixtureDir, 'fixtures/konnen-order-8144-quote.json'), 'utf8')
);

const catalog = buildShipperProductCatalog(
  JSON.parse(readFileSync(join(fixtureDir, 'fixtures/konnen-catalog-merged.json'), 'utf8'))
);
const catalogSkus = new Set([...catalog.keys()]);

describe('konnen-order-pdf 8144', () => {
  it('parse(txt) equals golden JSON (motor de cotação)', () => {
    const parsed = parseKonnenOrderText(FIXTURE);
    expect(parsed).toEqual({
      orderNo: GOLDEN.orderNo,
      client: GOLDEN.client,
      cargoValue: GOLDEN.cargoValue,
      lines: GOLDEN.lines,
    });
  });

  it('nome PDF "-134KG" → stack 295 lb', () => {
    const parsed = parseKonnenOrderText(FIXTURE);
    const if9302 = parsed.lines.find((l) => l.sku === 'IF9302');
    expect(if9302?.stackWeightKg).toBe(134);
    expect(stackLbsFromPdfWeightKg(134)).toBe('295');
    const if9303 = parsed.lines.find((l) => l.sku === 'IF9303');
    expect(if9303?.stackWeightKg).toBe(90);
    expect(stackLbsFromPdfWeightKg(90)).toBe('200');
  });

  it('fixture slim não contém lixo Clicksign/legal', () => {
    expect(FIXTURE).not.toMatch(/Documento assinado com validade jurídica/i);
    expect(FIXTURE).not.toMatch(/480adc90-aeb9-4d98-b0ce-bd96c10747af/i);
    expect(FIXTURE).not.toMatch(/FOR FITNESS/i);
    expect(stripKonnenNoise(FIXTURE)).not.toMatch(/MEDIDA PROVISÓRIA No 2\.200-2/i);
  });

  it('cruza lines com catálogo merged — unmatched esperado', () => {
    const parsed = parseKonnenOrderText(FIXTURE);
    const { unmatched, lines } = matchOrderLinesToCatalog(parsed.lines, catalogSkus);

    expect(unmatched).toEqual(GOLDEN.unmatched);
    expect(lines.some((l) => l.sku === 'IF9305' && l.quantity === 3)).toBe(true);
    expect(unmatched.some((u) => u.rawSku === 'E8')).toBe(true);
    expect(unmatched.some((u) => u.rawSku === 'R7')).toBe(true);
    expect(unmatched.some((u) => u.rawSku === 'TM07')).toBe(true);
  });

  it('junta hífen partido entre linhas', () => {
    expect(joinHyphenSplitLines(['RKC01UDB-', 'S780', 'Kit Dumbbell'])).toEqual([
      'RKC01UDB-S780',
      'Kit Dumbbell',
    ]);
  });
});

describe('konnen parser units', () => {
  it('parseKonnenClient lida com labels duplicados', () => {
    const sample = `Razão Social: Dg Academias Ltda
CNPJ / CPF: 50.902.729/0001-21 / CEP: 60741-575
Endereço: Av. Teste 100
Bairro: Centro Cidade / Estado: Fortaleza / CE
E-mail: test@example.com`;
    const client = parseKonnenClient(sample);
    expect(client.document).toBe('50902729000121');
    expect(client.zipCode).toBe('60741575');
  });

  it('parse layout 10119 — R$ direto sem Pronte entrega + TN/TB', () => {
    const sample = `ORÇAMENTO Nº 10.119
Razão Social: Top Up Itapipoca Ltda
CNPJ / CPF: 51.107.355/0001-15 / CEP: 62508-090
Endereço: Rua Joao Cordeiro 2122
Bairro: Coqueiro Cidade / Estado: Itapipoca / CE
E-mail: apollobarros@hotmail.com
IFP1103 Standing Lateral
Raise R$ 7.541,80 1 40,0% R$ 4.525,08
TN92 Abdominal R$ 4.095,84 1 40,0% R$ 2.457,50
TB44 Seated Preacher Curl R$ 5.725,44 1 40,0% R$ 3.435,26
AB7019-
1,2M Barra 1,2m R$ 1.015,93 1 40,0% R$ 609,56
Total do Orçamento: R$ 119.330,80`;
    const parsed = parseKonnenOrderText(sample);
    expect(parsed.orderNo).toBe('10119');
    expect(parsed.cargoValue).toBe(119_330.8);
    expect(parsed.lines).toEqual(
      expect.arrayContaining([
        { sku: 'IFP1103', quantity: 1 },
        { sku: 'TN92', quantity: 1 },
        { sku: 'TB44', quantity: 1 },
        { sku: 'AB7019-1,2M', quantity: 1 },
      ])
    );
    expect(parsed.lines.length).toBeGreaterThanOrEqual(4);
  });
});
