import { describe, expect, it } from 'vitest';
import { checkCoverageLimit } from '../insurance-limit';
import { buildMsFormPrefill, nfNumeroFromChave } from '../ms-liberacao-prefill';

const policies = [
  {
    policy_type: 'RCTR-C',
    code: 'RCTRC-63434060699',
    coverage_limit: 600000,
    metadata: { proposta: '63434060699' },
  },
  {
    policy_type: 'RC-DC',
    code: 'RCDC-63433997322',
    coverage_limit: 600000,
    metadata: {
      apolice: '6550008359',
      lmg_breakdown: { academia: 3000000, rj_metropolitano: 600000, academia_rj: 600000 },
    },
  },
];

describe('nfNumeroFromChave', () => {
  it('extrai nNF da chave', () => {
    expect(nfNumeroFromChave('33260905592876000198550010000105831475480948')).toBe('10583');
    expect(nfNumeroFromChave('3326 0919 8271 4100 0291 5500 1000 0167 7517 7940 4521')).toBe(
      '16775'
    );
    expect(nfNumeroFromChave('123')).toBeNull();
  });
});

describe('buildMsFormPrefill — caminhão 1 Academia JP', () => {
  const check = checkCoverageLimit(policies[1], 932614.15, {
    cargoType: 'EQUIPAMENTOS',
    originIbge: 3304557,
    destinationIbge: 2507507,
  });
  const form = buildMsFormPrefill({
    policies,
    check,
    cargoType: 'EQUIPAMENTOS',
    shipperName: 'CORE HEALTH & FITNESS BRASIL',
    consigneeName: 'ACADEMIA JP LTDA',
    nfeKeys: [
      '33260905592876000198550010000105831475480948',
      '33260905592876000198550010000105841657242217',
      '33260919827141000291550010000167751779404521',
    ],
    origin: 'Rio de Janeiro/RJ',
    destination: 'João Pessoa/PB',
    plannedStart: new Date('2026-10-06T12:00:00Z'),
    vehiclePlate: 'abc1d23',
    vehicleTypeName: 'Carreta',
    driverContract: 'agregado',
  });

  it('marca motivo limite excedido e explica o sublimite RJ', () => {
    expect(form.checks.motivo_limite).toBe(true);
    expect(form.text.motivo_esclarecer).toContain('R$ 932.614,15');
    expect(form.text.motivo_esclarecer).toContain('Sublimite academia RJ');
    expect(form.text.sublimite).toContain('origem Região Metropolitana do Rio de Janeiro');
  });

  it('apólices RC-DC (6550008359) + RCTR-C', () => {
    expect(form.text.apolice_numero_1).toBe('RC-DC 6550008359');
    expect(form.text.apolice_numero_2).toBe('RCTR-C 63434060699');
    expect(form.checks.apolice_rcf_dc && form.checks.apolice_rctr_c).toBe(true);
    expect(form.text.lmg).toBe(
      'R$ 600.000,00 (cobertura básica) / R$ 3.000.000,00 (equipamentos de academia)'
    );
  });

  it('NFs, placa, datas e GR', () => {
    expect(form.text.notas_fiscais).toBe('NF-e 10583, 10584, 16775');
    expect(form.text.placa).toBe('ABC1D23');
    expect(form.text.previsao_inicio).toBe('06/10/2026');
    expect(form.text.conhecimento).toBe('A emitir após autorização');
    expect(form.checks.veiculo_agregado && form.checks.motorista_agregado).toBe(true);
    expect(form.checks.tipo_caminhao).toBe(true);
    expect(form.checks.escolta_nao).toBe(true);
  });
});
