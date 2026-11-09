import { describe, expect, it } from 'vitest';
import { ROTHA_CANONICAL_CATALOG } from '@/lib/rotha-catalog';
import { packAnilhaKg, packAssembledM, packPuxadorAnatomicoRotha6 } from '@/lib/rotha-konnen-pack';

describe('rotha canonical catalog', () => {
  it('SKU comercial — zero R#### / RS / YL / BRTW / AB / RKC', () => {
    const skus = ROTHA_CANONICAL_CATALOG.map((p) => p.sku);
    expect(skus.some((s) => /^R\d/.test(s))).toBe(false);
    expect(skus.some((s) => /^(RS-|YL|BRTW|AB|RKC)/.test(s))).toBe(false);
    expect(skus).toContain('DBSIX32');
    expect(skus).toContain('ANVAN10');
    expect(skus).toContain('BMSIX20');
    expect(skus).toContain('PUX-W');
    expect(skus).toContain('SUPDUMBLACK-13');
    expect(skus).toContain('LAND001');
  });

  it('SKU único + peso e cubagem > 0', () => {
    const skus = ROTHA_CANONICAL_CATALOG.map((p) => p.sku);
    expect(new Set(skus).size).toBe(skus.length);
    for (const p of ROTHA_CANONICAL_CATALOG) {
      expect(p.weight_kg, p.sku).toBeGreaterThan(0);
      expect(p.volume_m3, p.sku).toBeGreaterThan(0);
      expect(p.length_m, p.sku).toBeGreaterThan(0);
    }
  });

  it('chips = seções catálogo', () => {
    const groups = new Set(ROTHA_CANONICAL_CATALOG.map((p) => p.catalog_group));
    expect([...groups].sort()).toEqual(
      [
        'ANILHAS',
        'BARRAS',
        'BARRAS MONTADAS',
        'DUMBBELLS',
        'FUNCIONAL',
        'PUXADORES',
        'SUPORTES',
      ].sort()
    );
  });

  it('DBSIX32 peso 32 kg · caixa Konnen similar', () => {
    const p = ROTHA_CANONICAL_CATALOG.find((x) => x.sku === 'DBSIX32')!;
    expect(p.weight_kg).toBe(32);
    expect(p.length_m).toBe(0.338);
  });

  it('ANVAN10 anilha 10 kg · caixa 335×325×85', () => {
    const p = ROTHA_CANONICAL_CATALOG.find((x) => x.sku === 'ANVAN10')!;
    expect(p.nf_skus).toEqual(['R6010']);
    expect(p.weight_kg).toBe(10);
    expect(p.length_m).toBe(packAnilhaKg(10).length_m);
    expect(p.width_m).toBe(0.325);
    expect(p.height_m).toBe(0.085);
  });

  it('SUPDUMBLACK-13 C×L×A catálogo 2025 · peso Konnen 95 kg', () => {
    const p = ROTHA_CANONICAL_CATALOG.find((x) => x.sku === 'SUPDUMBLACK-13')!;
    expect(p.nf_skus).toEqual(['R3074.1']);
    expect(p.length_m).toBe(3.14);
    expect(p.width_m).toBe(0.75);
    expect(p.height_m).toBe(0.72);
    expect(p.weight_kg).toBe(95);
    expect(p.volume_m3).toBe(packAssembledM(3.14, 0.75, 0.72, 95).volume_m3);
  });

  it('SUPBARRA-BLACK peso 50.3 kg', () => {
    const p = ROTHA_CANONICAL_CATALOG.find((x) => x.sku === 'SUPBARRA-BLACK')!;
    expect(p.nf_skus).toEqual(['R1511.1']);
    expect(p.weight_kg).toBe(50.3);
  });
});

describe('puxador anatomico pack (sem SKU comercial no PDF 36p)', () => {
  it('caixa 800×200×300 · 110 kg', () => {
    const p = packPuxadorAnatomicoRotha6();
    expect(p.weight_kg).toBe(110);
    expect(p.length_m).toBe(0.8);
    expect(p.volume_m3).toBe(0.048);
  });
});
