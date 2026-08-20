import { describe, expect, it } from 'vitest';
import {
  BOOST_FAIR_PALETTE,
  BUCKLER_FAIR_PALETTE,
  FAIR_BRAND_PALETTES,
  FAIR_BRAND_TOKEN_ROWS,
  KONNEN_FAIR_PALETTE,
  REEBOK_FAIR_PALETTE,
  applyFairThemeToElement,
  contrastText,
  fairPaletteCssVars,
  relativeLuminance,
  resolveFairPalette,
} from '@/lib/fair-brand-palettes';

describe('fair-brand-palettes', () => {
  it('tem 18 tokens e embarcadores feira', () => {
    expect(FAIR_BRAND_TOKEN_ROWS).toHaveLength(18);
    expect(FAIR_BRAND_PALETTES.map((p) => p.slug)).toEqual([
      'buckler',
      'konnen',
      'boost',
      'reebok',
      'playfit',
      'rotha',
    ]);
  });

  it('Konnen CTA amarelo do site + texto preto', () => {
    expect(KONNEN_FAIR_PALETTE.tokens.accent).toBe('#FFD600');
    expect(KONNEN_FAIR_PALETTE.tokens.ctaBg).toBe('#FFD600');
    expect(KONNEN_FAIR_PALETTE.tokens.ctaFg).toBe('#000000');
    expect(contrastText(KONNEN_FAIR_PALETTE.tokens.ctaBg)).toBe('#000000');
  });

  it('Reebok header/logo pretos — pêssego Brand API só no chip', () => {
    expect(REEBOK_FAIR_PALETTE.tokens.logoBg).toBe('#000000');
    expect(REEBOK_FAIR_PALETTE.tokens.accent).toBe('#FF1714');
    expect(REEBOK_FAIR_PALETTE.tokens.accentSoft).toBe('#FBCFBB');
    expect(REEBOK_FAIR_PALETTE.tokens.muted).toBe('#525150');
    expect(REEBOK_FAIR_PALETTE.tokens.ctaFg).toBe('#FFFFFF');
    expect(contrastText(REEBOK_FAIR_PALETTE.tokens.ctaBg)).toBe('#FFFFFF');
  });

  it('Boost azul Equipment, não laranja', () => {
    expect(BOOST_FAIR_PALETTE.tokens.accent).toBe('#486FD9');
    expect(BOOST_FAIR_PALETTE.tokens.accentHover).toBe('#043C6C');
  });

  it('Buckler wordmark beige, logo pill preto (não navy Hub)', () => {
    expect(BUCKLER_FAIR_PALETTE.tokens.logoBg).toBe('#010101');
    expect(BUCKLER_FAIR_PALETTE.tokens.logoFg).toBe('#CDC2B1');
    expect(BUCKLER_FAIR_PALETTE.tokens.ctaFg).toBe('#CDC2B1');
  });

  it('resolve slug e CSS vars', () => {
    expect(resolveFairPalette('konnen').name).toBe('Konnen Fitness');
    expect(resolveFairPalette('nope').slug).toBe('buckler');
    const vars = fairPaletteCssVars(KONNEN_FAIR_PALETTE);
    expect(vars['--fair-cta-bg']).toBe('#FFD600');
    expect(vars['--fair-cta-fg']).toBe('#000000');
  });

  it('luminância amarelo Konnen alta', () => {
    expect(relativeLuminance('#FFD600')).toBeGreaterThan(0.65);
    expect(relativeLuminance('#FF1714')).toBeLessThan(0.3);
  });

  it('applyFairThemeToElement grava e limpa --fair-*', () => {
    const store: Record<string, string> = {};
    const el = {
      style: {
        setProperty: (k: string, v: string) => {
          store[k] = v;
        },
        removeProperty: (k: string) => {
          delete store[k];
        },
      },
    };
    const undo = applyFairThemeToElement(el, KONNEN_FAIR_PALETTE);
    expect(store['--fair-cta-bg']).toBe('#FFD600');
    expect(store['--fair-price']).toBe('#000000');
    undo();
    expect(store['--fair-cta-bg']).toBeUndefined();
  });
});
