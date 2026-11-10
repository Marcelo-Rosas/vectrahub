import { describe, expect, it } from 'vitest';
import {
  buildCiotOnlineEmit,
  findAdoptableCiot,
  mergeCiotMeta,
  listItemsFromResponse,
  tipoViagemFromProprietario,
} from '../../../supabase/functions/_shared/ciotonline-hub';
import type { HubCiotLoad } from '../../../supabase/functions/_shared/ailog-ciot-hub';

const NOW = new Date('2026-11-10T15:00:00Z');

function load(over: Partial<HubCiotLoad> = {}): HubCiotLoad {
  return {
    osNumber: 'OS-2026-11-0003',
    originLabel: 'Paulo Lopes - SC',
    destLabel: 'Rio de Janeiro - RJ',
    originCep: '88490000',
    destCep: '22220000',
    originIbge: 4212304,
    destIbge: 3304557,
    km: 1165,
    valorFrete: 3625,
    valorPedagio: 170,
    pesoKg: 1374,
    pickupDate: '2026-11-12',
    eta: '2026-11-14',
    plate: 'MDG5F32',
    tipoViagem: 1,
    contratadoDoc: '11122233344',
    contratadoNome: 'LEONARDO SILVA DOS REIS',
    contratadoRntrc: '012269966',
    destDoc: '64717065000135',
    destNome: 'UTF CATETE ACADEMIA DE GINASTICA LTDA',
    destLogradouro: 'Rua do Catete',
    destNumero: '129',
    destBairro: 'Catete',
    destCidade: 'Rio de Janeiro',
    destUf: 'RJ',
    contratanteDoc: '62188748000117',
    contratanteNome: 'VECTRA HUB LTDA',
    contratanteRntrc: '59734055',
    contratanteLogradouro: 'Rodovia Jorge Lacerda',
    contratanteNumero: '725',
    contratanteBairro: 'Espinheiros',
    contratanteCidade: 'Itajaí',
    contratanteUf: 'SC',
    contratanteCep: '88317100',
    ...over,
  };
}

const LOOKUPS = {
  origin: { municipio: 'Paulo Lopes', uf: 'SC', ibge_code: 4212304 },
  dest: { municipio: 'Rio de Janeiro', uf: 'RJ', ibge_code: 3304557 },
  contratante: null,
} as never;

function build(over: Partial<HubCiotLoad> = {}, lookups = LOOKUPS) {
  const r = buildCiotOnlineEmit(load(over), lookups, NOW);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('buildCiotOnlineEmit', () => {
  it('PIX quando pixKey', () => {
    const r = build({ pixKey: 'leo@pix.com' });
    expect(r.pagamento).toBe('PIX');
    expect(r.payload).toMatchObject({
      tipo_pagamento: 'PIX',
      chave_pix: 'leo@pix.com',
      cpf_proprietario_conta: '11122233344',
    });
  });

  it('CONTA_CORRENTE quando banco completo e sem pix', () => {
    const r = build({ bancoCodigo: '001', bancoAgencia: '1234', bancoConta: '56789-0' });
    expect(r.pagamento).toBe('CONTA_CORRENTE');
    expect(r.payload).toMatchObject({
      tipo_pagamento: 'CONTA_CORRENTE',
      codigo_banco: '001',
      agencia: '1234',
      numero_conta: '56789-0',
    });
  });

  it('OUTROS quando sem pix e sem banco', () => {
    const r = build({});
    expect(r.pagamento).toBe('OUTROS');
    expect(r.payload.tipo_pagamento).toBe('OUTROS');
    expect(r.payload).not.toHaveProperty('chave_pix');
  });

  it('tipo_viagem 3 só para TAC agregado (0)', () => {
    expect(tipoViagemFromProprietario(0)).toBe(3);
    expect(tipoViagemFromProprietario(1)).toBe(1);
    expect(tipoViagemFromProprietario(2)).toBe(1);
    expect(tipoViagemFromProprietario(null)).toBe(1);
    expect(build({ tipoProprietario: 0 }).payload.tipo_viagem).toBe(3);
  });

  it('eixos ausentes → omitido; presentes → enviados', () => {
    expect(build({ eixos: null }).payload.veiculos[0]).not.toHaveProperty('eixos');
    expect(build({ eixos: 3 }).payload.veiculos[0]).toMatchObject({ eixos: 3 });
  });

  it('placa normalizada', () => {
    expect(build({ plate: 'mdg-5f32' }).payload.veiculos[0]).toMatchObject({
      placa: 'MDG5F32',
      rntrc: '012269966',
    });
  });

  it('coleta no passado → início hoje, fim preserva duração', () => {
    const r = build({ pickupDate: '2026-11-01', eta: '2026-11-04' });
    expect(r.payload.data_inicio_viagem).toBe('2026-11-10');
    expect(r.payload.data_fim_viagem).toBe('2026-11-13');
  });

  it('coleta futura só-data mantém o dia (sem deslocar fuso)', () => {
    const r = build({ pickupDate: '2026-11-12', eta: '2026-11-14' });
    expect(r.payload.data_inicio_viagem).toBe('2026-11-12');
    expect(r.payload.data_fim_viagem).toBe('2026-11-14');
  });

  it('valores em reais com 2 casas, CEP 8 dígitos e código cliente = OS', () => {
    const r = build({ valorFrete: 3625.456, originCep: '88490-000' });
    expect(r.payload.valor_frete).toBe(3625.46);
    expect(r.payload.valor_pedagio).toBe(170);
    expect(r.payload.origem).toMatchObject({ cep: '88490000', codigo_ibge: 4212304, uf: 'SC' });
    expect(r.payload.destino).toMatchObject({ cep: '22220000', codigo_ibge: 3304557, uf: 'RJ' });
    expect(r.payload.codigo_cliente).toBe('OS-2026-11-0003');
    expect(r.payload.codigo_natureza_carga).toBe('0001');
    expect(r.payload).not.toHaveProperty('contratante');
  });

  it('sem RNTRC do contratado → ok:false PT-BR', () => {
    expect(buildCiotOnlineEmit(load({ contratadoRntrc: '' }), LOOKUPS, NOW)).toEqual({
      ok: false,
      error: expect.stringContaining('RNTRC'),
    });
  });

  it('sem IBGE destino → ok:false', () => {
    const r = buildCiotOnlineEmit(
      load({ destIbge: null }),
      { ...(LOOKUPS as object), dest: null } as never,
      NOW
    );
    expect(r.ok).toBe(false);
  });
});

describe('findAdoptableCiot', () => {
  const items = [
    {
      id: 1,
      codigo_cliente: 'OS-2026-11-0002',
      status: 'emitido',
      numero_ciot: '111',
      protocolo: 'P1',
    },
    {
      id: 2,
      codigo_cliente: 'OS-2026-11-0003',
      status: 'cancelado',
      numero_ciot: '222',
      protocolo: 'P2',
    },
    {
      id: 3,
      codigo_cliente: 'OS-2026-11-0003',
      status: 'emitido',
      numero_ciot: '333',
      protocolo: 'P3',
    },
  ];

  it('acha CIOT emitido pela OS', () => {
    expect(findAdoptableCiot(items, 'OS-2026-11-0003')).toEqual({
      id: 3,
      numero_ciot: '333',
      protocolo: 'P3',
    });
  });

  it('ignora cancelado', () => {
    expect(findAdoptableCiot([items[1]], 'OS-2026-11-0003')).toBeNull();
  });

  it('null sem match', () => {
    expect(findAdoptableCiot(items, 'OS-2026-11-9999')).toBeNull();
  });
});

describe('listItemsFromResponse', () => {
  it('aceita data como array, data.items ou data.data', () => {
    const it1 = { id: 1 };
    expect(listItemsFromResponse([it1])).toEqual([it1]);
    expect(listItemsFromResponse({ items: [it1] })).toEqual([it1]);
    expect(listItemsFromResponse({ data: [it1], page: 1 })).toEqual([it1]);
    expect(listItemsFromResponse(null)).toEqual([]);
  });
});

describe('mergeCiotMeta', () => {
  it('grava meta.ciot preservando o resto do pricing_breakdown', () => {
    const pb = {
      total: 10,
      meta: { vpo: { idANTT: 'X' }, ciot: { number: 'OLD', cnpjResponsavel: '1' } },
    };
    const out = mergeCiotMeta(pb, {
      number: '550000012345678',
      protocolo: 'P',
      provider: 'ciotonline',
    });
    expect(out).toEqual({
      total: 10,
      meta: {
        vpo: { idANTT: 'X' },
        ciot: { number: '550000012345678', protocolo: 'P', provider: 'ciotonline' },
      },
    });
    expect(pb.meta.ciot.number).toBe('OLD');
  });

  it('null remove meta.ciot (cancelamento)', () => {
    const out = mergeCiotMeta({ meta: { ciot: { number: '1' }, vpo: {} } }, null);
    expect(out).toEqual({ meta: { vpo: {} } });
  });

  it('pricing_breakdown nulo vira objeto', () => {
    expect(mergeCiotMeta(null, { number: '9' })).toEqual({ meta: { ciot: { number: '9' } } });
  });
});
