import { describe, expect, it } from 'vitest';
import {
  nfeEmitCnpjFromChave,
  nfeNumeroFromChave,
  planCteEmissions,
  groupCteLegs,
  nfeTotalsFromXml,
  splitFreightProportional,
  type CteNfeForSplit,
} from '@/lib/cte-nfe-split';

const OS0003: CteNfeForSplit[] = [
  {
    chave: '42260817621295000116550010000163701000138046',
    destTaxId: '22902694013920',
    destUf: 'PE',
  },
  {
    chave: '42260817621295000116550010000163721000146620',
    destTaxId: '51491397500',
    destUf: 'BA',
  },
  {
    chave: '42260817621295000116550010000163731000146830',
    destTaxId: '09534325000129',
    destUf: 'BA',
  },
];

function chaveSc(emitCnpj: string, nNF: number): string {
  const cnpj = emitCnpj.replace(/\D/g, '').padStart(14, '0').slice(0, 14);
  const nnf = String(nNF).padStart(9, '0').slice(0, 9);
  return `422608${cnpj}55${'001'}${nnf}1000138046`;
}

describe('splitFreightProportional', () => {
  it('rateia 26000 pelas 3 NFs da OS-0003 e soma o total', () => {
    const parts = splitFreightProportional(26000, [98856.61, 95385.68, 54987.98]);
    expect(parts).toHaveLength(3);
    expect(Number(parts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(26000);
    expect(parts.every((p) => p > 0)).toBe(true);
  });

  it('rateia 26000 pelo km de cada destinatario e nenhum leva o total', () => {
    const parts = splitFreightProportional(26000, [3560, 2480.5, 2010.2]);
    expect(Number(parts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(26000);
    expect(Math.max(...parts)).toBeLessThan(26000);
  });

  it('OS-0005: 2 embarcadores diferentes — rateio por km soma 26000', () => {
    // KONNEN Itajaí→Fortaleza 3782.8 · BUCKLER SBC→Fortaleza 2935.8
    const parts = splitFreightProportional(26000, [3782.8, 2935.8]);
    expect(parts).toEqual([14638.88, 11361.12]);
    expect(Number(parts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(26000);
  });

  it('OS-0005: rateia valor de mercadoria 340902.90 pelo mesmo km', () => {
    const parts = splitFreightProportional(340902.9, [3782.8, 2935.8]);
    expect(Number(parts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(340902.9);
    expect(parts.every((p) => p > 0)).toBe(true);
  });
});

describe('nfeNumeroFromChave', () => {
  it('extrai o numero da NF da chave 44', () => {
    expect(nfeNumeroFromChave('42260817621295000116550010000163701000138046')).toBe('16370');
    expect(nfeNumeroFromChave('42260817621295000116550010000163721000146620')).toBe('16372');
    expect(nfeNumeroFromChave('42260817621295000116550010000163731000146830')).toBe('16373');
  });
});

describe('nfeEmitCnpjFromChave', () => {
  it('as 3 NFs da OS-0003 sao do mesmo emitente SC', () => {
    const emits = OS0003.map((n) => nfeEmitCnpjFromChave(n.chave));
    expect(new Set(emits)).toEqual(new Set(['17621295000116']));
  });
});

describe('planCteEmissions', () => {
  it('OS-0003 CIF interestadual 3 destinos → 1 CT-e por destinatario (nao globalizado)', () => {
    const plan = planCteEmissions({ nfes: OS0003, tomadorTipo: 0, ufInicio: 'SC' });
    expect(plan.mode).toBe('per_destinatario');
    if (plan.mode !== 'per_destinatario') return;
    expect(plan.groups).toHaveLength(3);
    expect(plan.reason).toMatch(/interestadual/);
    expect(plan.reason).toMatch(/destinatarios_lt_5/);
  });

  it('mesmo dest + N NFs mesmo emitente → 1 CT-e normal (mesmo interestadual)', () => {
    const nfes: CteNfeForSplit[] = [
      { chave: OS0003[0].chave, destTaxId: '22902694013920', destUf: 'PE' },
      { chave: OS0003[1].chave, destTaxId: '22902694013920', destUf: 'PE' },
    ];
    const plan = planCteEmissions({ nfes, tomadorTipo: 0, ufInicio: 'SC' });
    expect(plan.mode).toBe('normal_multi_nfe');
  });

  it('CIF + 5 destinos na mesma UF + mesmo emitente → 1 CT-e globalizado', () => {
    const emit = '17621295000116';
    const nfes: CteNfeForSplit[] = [1, 2, 3, 4, 5].map((i) => ({
      chave: chaveSc(emit, 16000 + i),
      destTaxId: String(10000000000000 + i),
      destUf: 'SC',
    }));
    const plan = planCteEmissions({ nfes, tomadorTipo: 0, ufInicio: 'SC' });
    expect(plan.mode).toBe('globalizado');
    if (plan.mode === 'globalizado') expect(plan.kind).toBe('um_remetente_n_dest');
  });

  it('CIF + 5 destinos mas interestadual → nao globaliza', () => {
    const emit = '17621295000116';
    const nfes: CteNfeForSplit[] = [1, 2, 3, 4, 5].map((i) => ({
      chave: chaveSc(emit, 16000 + i),
      destTaxId: String(10000000000000 + i),
      destUf: 'PR',
    }));
    const plan = planCteEmissions({ nfes, tomadorTipo: 0, ufInicio: 'SC' });
    expect(plan.mode).toBe('per_destinatario');
  });
});

describe('groupCteLegs — Academia JP (out/2026)', () => {
  const ACAD = '60718879000133';
  const leg = (nfe_key: string, nfe_numero: string, cargo_value: number, valor_prestacao = 0) => ({
    nfe_key,
    nfe_numero,
    destTaxId: ACAD,
    cargo_value,
    weight: 0,
    valor_prestacao,
    km_negociado: 2450,
  });
  // Mega Armazéns 05.592.876/0001-98
  const nf10583 = leg('33260905592876000198550010000105831475480948', '10583', 592858.68, 12500);
  const nf10585 = leg('33260905592876000198550010000105851680828696', '10585', 196035.82, 12500);
  const nf10584 = leg('33260905592876000198550010000105841657242217', '10584', 334245.43);
  const nf10586 = leg('33260905592876000198550010000105861020774286', '10586', 401039.37);
  // Core Health & Fitness 19.827.141/0002-91
  const nf16775 = leg('33260919827141000291550010000167751779404521', '16775', 5510.04);

  it('carro 1: mesmo emitente + mesmo destinatário → 1 CT-e com 2 NF-e', () => {
    const g = groupCteLegs([nf10583, nf10585]);
    expect(g).toHaveLength(1);
    expect(g[0].nfe_numeros).toEqual(['10583', '10585']);
    expect(g[0].cargo_value).toBe(788894.5);
    expect(g[0].valor_prestacao).toBe(25000);
  });

  it('carro 2: emitentes diferentes → Mega (2 NF) + Core (1 NF)', () => {
    const g = groupCteLegs([nf10584, nf16775, nf10586]);
    expect(g.map((x) => x.nfe_numeros)).toEqual([['10584', '10586'], ['16775']]);
    expect(g[0].cargo_value).toBe(735284.8);
    expect(g[1].cargo_value).toBe(5510.04);
  });

  it('destinatários diferentes nunca se juntam', () => {
    const g = groupCteLegs([nf10583, { ...nf10585, destTaxId: '11222333000181' }]);
    expect(g).toHaveLength(2);
  });
});

describe('nfeTotalsFromXml — vCarga real da NF (não rateio)', () => {
  const xml16775 = `<nfeProc><NFe><infNFe Id="NFe33260919827141000291550010000167751779404521">
    <det nItem="1"><prod><vProd>5510.04</vProd></prod><imposto><ICMS><ICMS00><vBC>5510.04</vBC></ICMS00></ICMS></imposto></det>
    <total><ICMSTot><vBC>5510.04</vBC><vICMS>220.40</vICMS><vProd>5510.04</vProd><vNF>5510.04</vNF></ICMSTot></total>
    <transp><modFrete>1</modFrete><vol><qVol>30</qVol><pesoB>3500.000</pesoB></vol></transp>
  </infNFe></NFe></nfeProc>`;

  it('NF 16775: vNF 5.510,04 e pesoB 3.500 kg', () => {
    expect(nfeTotalsFromXml(xml16775)).toEqual({ valor_nf_xml: 5510.04, peso_bruto_xml: 3500 });
  });

  it('soma pesoB de vários volumes e lê vNF só do ICMSTot', () => {
    const xml =
      '<det><prod><vNF>1</vNF></prod></det><ICMSTot><vNF>401039.37</vNF></ICMSTot>' +
      '<vol><pesoB>1200.5</pesoB></vol><vol><pesoB>800</pesoB></vol>';
    expect(nfeTotalsFromXml(xml)).toEqual({ valor_nf_xml: 401039.37, peso_bruto_xml: 2000.5 });
  });

  it('XML sem totais → vazio (cai no fallback, nunca inventa valor)', () => {
    expect(nfeTotalsFromXml('<NFe></NFe>')).toEqual({});
  });
});
