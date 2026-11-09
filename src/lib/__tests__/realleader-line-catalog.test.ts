import { describe, expect, it } from 'vitest';
import {
  bucklerChipFromRealleaderSku,
  buildMicProductListUrl,
  extractMicProductGroupId,
  extractRealleaderSkuFromText,
  isPinLoadedRealleaderSku,
  micProductListPageCount,
  parseMicProductListTotal,
  realleaderLineFromSku,
  resolveMicGroupHint,
} from '@/lib/realleader-line-catalog';

describe('realleader-line-catalog', () => {
  it('pin loaded: M2, M3, M7PRO', () => {
    for (const sku of ['M2-1005', 'M3-1006', 'M7PRO-1001', 'M7PRO-2004']) {
      expect(isPinLoadedRealleaderSku(sku)).toBe(true);
      expect(bucklerChipFromRealleaderSku(sku)).toBe('PIN LOADED');
      expect(realleaderLineFromSku(sku)).toMatch(/^M(2|3|7PRO)$/);
    }
  });

  it('FW → bancos, não pin load', () => {
    expect(bucklerChipFromRealleaderSku('FW-1013A', 'ADJUSTABLE BENCH')).toBe('BENCHES & RACKS');
    expect(isPinLoadedRealleaderSku('FW-1013A')).toBe(false);
  });

  it('RS-1xxx plate Real Series; RS-800 cardio', () => {
    expect(bucklerChipFromRealleaderSku('RS-1018', 'Biceps')).toBe('PLATE LOADED');
    expect(bucklerChipFromRealleaderSku('RS-800', 'STAIR MASTER')).toBe('CARDIO');
    expect(realleaderLineFromSku('RS-1039')).toBe('RS');
  });

  it('FM-1024 plate; FM-2001 cable', () => {
    expect(bucklerChipFromRealleaderSku('FM-1024F', 'HACK SQUAT bearing')).toBe('PLATE LOADED');
    expect(bucklerChipFromRealleaderSku('FM-2001', 'DUAL ADJUSTABLE PULLEY')).toBe('CABLE CROSS');
  });

  it('GL pin load; Prime cardio não cai em acessorios', () => {
    expect(bucklerChipFromRealleaderSku('GL-1007', 'PRONE GLUTE')).toBe('PIN LOADED');
    expect(bucklerChipFromRealleaderSku('5556EA', 'Treadmill Led')).toBe('CARDIO');
    expect(bucklerChipFromRealleaderSku('6841TA', 'Treadmill Touch')).toBe('CARDIO');
    expect(bucklerChipFromRealleaderSku('B11V3', 'Bike Vertical')).toBe('CARDIO');
    expect(bucklerChipFromRealleaderSku('OK1013-10', 'Halter 10 Kg')).toBe('ACESSORIOS');
  });

  it('extrai SKU MIC incluindo M7PRO e sufixo E/F', () => {
    expect(
      extractRealleaderSkuFromText(
        'Hot Sale Commercial Fitness Equipment Gym of Chest Press (M7PRO-1001)'
      )
    ).toBe('M7PRO-1001');
    expect(extractRealleaderSkuFromText('Commercial Gym Equipment for Hack Squat (FM-1024F)')).toBe(
      'FM-1024F'
    );
    expect(extractRealleaderSkuFromText('Prone Leg Curl (M3-1006)')).toBe('M3-1006');
  });

  it('productList MIC — group id + paginação', () => {
    const groupUrl =
      'https://realleaderfitness.en.made-in-china.com/product-group/hqenjfyDXJpS/Strength-M2-Series-catalog-1.html';
    expect(extractMicProductGroupId(groupUrl)).toBe('hqenjfyDXJpS');
    const listUrl = buildMicProductListUrl('hqenjfyDXJpS', 1);
    expect(listUrl).toContain('productList?');
    expect(listUrl).toContain('productGroupOrCatId=hqenjfyDXJpS');
    expect(listUrl).toContain('pageNumber=1');
    expect(micProductListPageCount(362, 48)).toBe(8);
    expect(parseMicProductListTotal('Total 362 Strength-M2 Series Products')).toBe(362);
  });

  it('resolve hint MIC M2/M3/M7PRO', () => {
    expect(
      resolveMicGroupHint(
        'https://realleaderfitness.en.made-in-china.com/product-group/hqenjfyDXJpS/Strength-M2-Series-catalog-1.html'
      )?.line
    ).toBe('M2');
    expect(
      resolveMicGroupHint(
        'https://realleaderfitness.en.made-in-china.com/product-group/VoQJdalbHgkc/Strength-M3-Series-catalog-1.html'
      )?.defaultChip
    ).toBe('PIN LOADED');
  });
});
