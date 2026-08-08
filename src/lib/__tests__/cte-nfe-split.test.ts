import { describe, expect, it } from 'vitest';
import {
  nfeEmitCnpjFromChave,
  nfeNumeroFromChave,
  planCteEmissions,
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
