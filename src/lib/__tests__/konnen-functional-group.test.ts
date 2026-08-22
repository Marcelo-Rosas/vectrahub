import { describe, expect, it } from 'vitest';
import {
  konnenFunctionalGroup,
  isKonnenWeightStackSku,
  getAllFunctionalGroups,
} from '@/lib/konnen-functional-group';

describe('konnenFunctionalGroup', () => {
  describe('PIN LOADED', () => {
    it('FE97 / IF93 / IT95 / LCS / AM80', () => {
      expect(konnenFunctionalGroup('FE9701', 'SUPINO VERTICAL')).toBe('PIN LOADED');
      expect(konnenFunctionalGroup('IF9302', 'CHEST PRESS')).toBe('PIN LOADED');
      expect(konnenFunctionalGroup('IT9501', 'CHEST PRESS')).toBe('PIN LOADED');
      expect(konnenFunctionalGroup('LCS608', '3D ABDUCTOR')).toBe('PIN LOADED');
      expect(konnenFunctionalGroup('AM8012C', 'PUXADA ALTA')).toBe('PIN LOADED');
    });

    it('IT95 HI-LO permanece PIN (prefixo manda)', () => {
      expect(konnenFunctionalGroup('IT9525', 'HI-LO PULLEY')).toBe('PIN LOADED');
    });
  });

  describe('PLATE LOADED', () => {
    it('IFP / SL / ECP / IFL', () => {
      expect(konnenFunctionalGroup('IFP001', 'LEG PRESS')).toBe('PLATE LOADED');
      expect(konnenFunctionalGroup('SL7001')).toBe('PLATE LOADED');
      expect(konnenFunctionalGroup('ECP201', 'CHEST PRESS')).toBe('PLATE LOADED');
      expect(konnenFunctionalGroup('IFLPHS', 'LEG PRESS / HACK SQUAT')).toBe('PLATE LOADED');
    });
  });

  describe('ACESSORIOS', () => {
    it('RKC* / FEWS / XMT / XMR', () => {
      expect(konnenFunctionalGroup('RKC01UDB-002')).toBe('ACESSORIOS');
      expect(konnenFunctionalGroup('FEWS-295')).toBe('ACESSORIOS');
      expect(isKonnenWeightStackSku('FEWS-295')).toBe(true);
      expect(konnenFunctionalGroup('XMT-FCDB-2.5KG', 'DUMBBELL')).toBe('ACESSORIOS');
      expect(konnenFunctionalGroup('XMR-FOO', 'RUBBER PLATE')).toBe('ACESSORIOS');
    });
  });

  describe('CARDIO', () => {
    it('AC / EC / PS / V9 / XSC', () => {
      expect(konnenFunctionalGroup('AC2990', 'TREADMILL')).toBe('CARDIO');
      expect(konnenFunctionalGroup('ECE5', 'ELLIPTICAL')).toBe('CARDIO');
      expect(konnenFunctionalGroup('PS300', 'COMMERCIAL CYCLE')).toBe('CARDIO');
      expect(konnenFunctionalGroup('V9T', 'Painel V9T')).toBe('CARDIO');
      expect(konnenFunctionalGroup('XSC700', 'STAIR CLIMBER')).toBe('CARDIO');
    });
  });

  describe('CABLE CROSS / BENCHES', () => {
    it('cable por nome (SKU sem prefixo pin)', () => {
      expect(konnenFunctionalGroup('ZZ-CC01', 'DUAL PULLEY CABLE CROSS')).toBe('CABLE CROSS');
    });

    it('TN/TB e bancos IF*', () => {
      expect(konnenFunctionalGroup('TN100', 'ADJUSTABLE BENCH')).toBe('BENCHES & RACKS');
      expect(konnenFunctionalGroup('IFHC', 'HALF CAGE')).toBe('BENCHES & RACKS');
    });
  });

  it('nunca retorna OUTROS; fallback ACESSORIOS', () => {
    const g = konnenFunctionalGroup('QQ99', 'WIDGET');
    expect(g).toBe('ACESSORIOS');
    expect(g).not.toBe('OUTROS' as never);
    expect(getAllFunctionalGroups()).not.toContain('OUTROS' as never);
  });
});
