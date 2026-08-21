import { describe, expect, it } from 'vitest';
import {
  isBucklerExcludedOrderSku,
  normalizeBucklerCatalogItemSku,
  resolveBucklerCatalogSku,
} from '@/lib/buckler-catalog-sku';

describe('buckler-catalog-sku', () => {
  it('FM-2003A pedido → FM-2003 catálogo (sufixo = caixa A)', () => {
    const catalog = new Set(['FM-2003', 'M2-1010A']);
    expect(resolveBucklerCatalogSku('FM-2003A', catalog)).toBe('FM-2003');
  });

  it('FW-1013 proposta → FW-1013 catálogo (normalizado de FW-1013A)', () => {
    const catalog = new Set(['FW-1013']);
    expect(resolveBucklerCatalogSku('FW-1013', catalog)).toBe('FW-1013');
  });

  it('M2-1010A mantém SKU — várias caixas A/B/C', () => {
    expect(normalizeBucklerCatalogItemSku('M2-1010A', ['A', 'B', 'C'])).toBe('M2-1010A');
    const catalog = new Set(['M2-1010A']);
    expect(resolveBucklerCatalogSku('M2-1010A', catalog)).toBe('M2-1010A');
  });

  it('FM-1024D mantém SKU — caixas A/B, D é variant', () => {
    expect(normalizeBucklerCatalogItemSku('FM-1024D', ['A', 'B'])).toBe('FM-1024D');
  });

  it('FW-1013A planilha caixa única A → FW-1013', () => {
    expect(normalizeBucklerCatalogItemSku('FW-1013A', ['A'])).toBe('FW-1013');
  });

  it('FM-2003A + caixas A/B → FM-2003 (SKU puro crossover)', () => {
    expect(normalizeBucklerCatalogItemSku('FM-2003A', ['A', 'B'])).toBe('FM-2003');
  });

  it('S300 excluído de proposta Buckler', () => {
    expect(isBucklerExcludedOrderSku('S300')).toBe(true);
    expect(isBucklerExcludedOrderSku('FM-2003')).toBe(false);
  });
});
