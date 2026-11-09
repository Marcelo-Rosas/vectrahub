import { describe, expect, it } from 'vitest';
import {
  PBR_BASE_HEIGHT_MM,
  playfitMaxPlatesForThickness,
  playfitMontageOptionsForThickness,
  playfitPalletVolumeM3,
  playfitTotalPalletHeightMm,
} from '@/lib/playfit-stack';

describe('playfit-stack PBR', () => {
  it('16 mm × 80 placas → empilhamento 1.280 mm + base 150 mm = 1.430 mm', () => {
    expect(playfitTotalPalletHeightMm(80, 16, PBR_BASE_HEIGHT_MM)).toBe(1430);
  });

  it('16 mm × 80 placas → volume ≈ 1,716 m³ (1,0×1,2×1,43)', () => {
    expect(playfitPalletVolumeM3(80, 16)).toBeCloseTo(1.716, 3);
  });

  it('40 mm linha → montagem máx ~46 placas (teto 2 m)', () => {
    expect(playfitMaxPlatesForThickness(40)).toBe(46);
    expect(playfitMontageOptionsForThickness(40)).toEqual([20, 30, 40]);
  });

  it('16 mm linha → montagem 50·60·70·80', () => {
    expect(playfitMontageOptionsForThickness(16)).toEqual([50, 60, 70, 80]);
  });
});
