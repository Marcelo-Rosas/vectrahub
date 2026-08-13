import { describe, expect, it } from 'vitest';
import {
  calculateLotacaoProfitability,
  estimateInsuranceRiskCosts,
  resolveLotacaoFretePeso,
  resolveLotacaoKmOverPercent,
} from '@/lib/lotacao-freight-base';

describe('resolveLotacaoKmOverPercent', () => {
  it('escolhe faixa por km', () => {
    const rules: Record<string, number> = {
      over_lotacao_ate_800km: 60,
      over_lotacao_801_1500km: 45,
      over_lotacao_1501_2500km: 30,
      over_lotacao_acima_2500km: 20,
    };
    expect(resolveLotacaoKmOverPercent(500, (k) => rules[k])).toBe(60);
    expect(resolveLotacaoKmOverPercent(1000, (k) => rules[k])).toBe(45);
    expect(resolveLotacaoKmOverPercent(2000, (k) => rules[k])).toBe(30);
    expect(resolveLotacaoKmOverPercent(3000, (k) => rules[k])).toBe(20);
  });
});

describe('resolveLotacaoFretePeso', () => {
  it('usa piso ANTT bruto como base de custo (sem over sobre o piso)', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 5000,
      pisoAntt: 10000,
      km: 600,
      overKmPercent: 60,
      overAnttPercent: 55,
    });
    expect(r.freteTabelaComOverKm).toBe(8000);
    expect(r.pisoComOverAntt).toBe(10000);
    expect(r.fretePeso).toBe(10000);
    expect(r.fretePesoReferenciaMax).toBe(10000);
    expect(r.anttCostBaseUsed).toBe(true);
    expect(r.pisoAplicado).toBe(true);
  });

  it('usa piso ANTT como base mesmo quando tabela+over é maior (COT-2026-06-0002)', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 20000,
      pisoAntt: 17304.92,
      km: 2761,
      overKmPercent: 34,
      overAnttPercent: 0,
    });
    expect(r.freteTabelaComOverKm).toBe(26800);
    expect(r.pisoComOverAntt).toBe(17304.92);
    expect(r.fretePeso).toBe(17304.92);
    expect(r.fretePesoReferenciaMax).toBe(26800);
    expect(r.anttCostBaseUsed).toBe(true);
  });

  it('sem piso ANTT, usa tabela+over km', () => {
    const r = resolveLotacaoFretePeso({
      freteTabela: 20000,
      pisoAntt: 0,
      km: 200,
      overKmPercent: 60,
      overAnttPercent: 55,
    });
    expect(r.fretePeso).toBe(32000);
    expect(r.anttCostBaseUsed).toBe(false);
    expect(r.pisoAplicado).toBe(false);
  });
});

describe('estimateInsuranceRiskCosts', () => {
  it('0,015% + 0,015% s/ valor da carga', () => {
    const r = estimateInsuranceRiskCosts(68665);
    expect(r.total).toBe(20.6);
    expect(r.items).toHaveLength(2);
  });
});

describe('calculateLotacaoProfitability', () => {
  it('resultado contábil ≠ lucro alvo; margem % sobre FAT', () => {
    const p = calculateLotacaoProfitability({
      receitaLiquida: 10000,
      overhead: 1000,
      fretePeso: 7000,
      pisoAntt: 7000,
      custoServicos: 500,
      custosDescarga: 200,
      custosDiretos: 7700,
      totalCliente: 13000,
      profitMarginPercent: 15,
      custosRiscoReal: 20,
    });
    // contribuição = 10000 - 1000 - 7000 - 500 - 200 = 1300
    expect(p.margemBruta).toBe(1300);
    expect(p.resultadoLiquido).toBe(1280);
    expect(p.lucroAlvo).toBe(1155);
    expect(p.margemPercent).toBeCloseTo((1280 / 13000) * 100, 1);
  });

  it('repasse não entra — só custosRiscoReal deduz resultado', () => {
    const p = calculateLotacaoProfitability({
      receitaLiquida: 10000,
      overhead: 1000,
      fretePeso: 12000,
      custoServicos: 500,
      custosDescarga: 0,
      custosDiretos: 12500,
      totalCliente: 13000,
      profitMarginPercent: 10,
      custosRiscoReal: 0,
    });
    expect(p.margemBruta).toBe(-3500);
    expect(p.resultadoLiquido).toBe(-3500);
    expect(p.lucroAlvo).toBe(1250);
  });
});
