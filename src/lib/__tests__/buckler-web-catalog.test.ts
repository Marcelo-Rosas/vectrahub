import { describe, expect, it } from 'vitest';
import {
  bucklerCatalogGroupFallback,
  bucklerCatalogGroupFromWebTags,
  extractBucklerSkuFromTitle,
  splitBucklerWebTags,
} from '@/lib/buckler-web-catalog';

describe('buckler-web-catalog', () => {
  it('extracts SKU from Prime listing title', () => {
    expect(
      extractBucklerSkuFromTitle('PRIME FM-2001 DUAL ADJUSTABLE PULLEY Crossover angular')
    ).toBe('FM-2001');
    expect(extractBucklerSkuFromTitle('PRIME FW-2001 OLYMPIC FLAT BENCH Banco supino reto')).toBe(
      'FW-2001'
    );
    expect(extractBucklerSkuFromTitle('ANILHA DE URETANO CPU')).toBeNull();
  });

  it('splits Webflow tags into category vs series', () => {
    expect(splitBucklerWebTags(['Cable Cross', 'Prime', 'Todos']).categories).toEqual([
      'Cable Cross',
    ]);
    expect(splitBucklerWebTags(['Cable Cross', 'Prime', 'Todos']).series).toEqual(['Prime']);
  });

  it('maps equipment tags to chip group', () => {
    expect(bucklerCatalogGroupFromWebTags(['Benches &Racks', 'Prime'])).toBe('BENCHES & RACKS');
    expect(bucklerCatalogGroupFromWebTags(['Prime'], { name: 'ANILHA DE URETANO CPU' })).toBe(
      'ACESSORIOS'
    );
  });

  it('extracts SKU from Infinite plate-loaded titles (suffix E/F)', () => {
    expect(
      extractBucklerSkuFromTitle('INFINITE FM-1024E DEGREE LEG PRESS Agachamento no hack')
    ).toBe('FM-1024E');
    expect(extractBucklerSkuFromTitle('INFINITE FM-1024F HACK SQUAT Agachamento no hack')).toBe(
      'FM-1024F'
    );
  });

  it('fallback OEM Realleader — pin M2/M3/M7PRO, FW bancos, RS plate', () => {
    expect(bucklerCatalogGroupFallback('M2-1010', 'Biceps')).toBe('PIN LOADED');
    expect(bucklerCatalogGroupFallback('M3-1006', 'Leg curl')).toBe('PIN LOADED');
    expect(bucklerCatalogGroupFallback('M7PRO-1001', 'Chest press')).toBe('PIN LOADED');
    expect(bucklerCatalogGroupFallback('FW-1013A', 'Bench')).toBe('BENCHES & RACKS');
    expect(bucklerCatalogGroupFallback('RS-1018', 'Biceps')).toBe('PLATE LOADED');
    expect(bucklerCatalogGroupFallback('LD-1010', 'Leg press')).toBe('PLATE LOADED');
    expect(bucklerCatalogGroupFallback('FM-2003A', 'CABLE CROSSOVER')).toBe('CABLE CROSS');
    expect(bucklerCatalogGroupFallback('FM-1024F', 'HACK SQUAT bearing')).toBe('PLATE LOADED');
    expect(bucklerCatalogGroupFallback('RS-101', 'Treadmill')).toBe('CARDIO');
    expect(bucklerCatalogGroupFallback('GL-1007', 'PRONE GLUTE')).toBe('PIN LOADED');
    expect(bucklerCatalogGroupFallback('5556EA', 'Treadmill Led')).toBe('CARDIO');
    expect(bucklerCatalogGroupFallback('LD-2010', 'Adductor')).toBe('PLATE LOADED');
  });
});
