import { describe, expect, it } from 'vitest';
import {
  canEmitVpo,
  fornecedoraCnpjOf,
  lookupVpoVehicleByPlate,
  normalizePlate,
  resolveIdVpo,
  resolveVpoVehicleForUi,
  tipoValeFromLookup,
  vpoLookupFromConsult,
} from '@/lib/vpo-emissores';

describe('normalizePlate', () => {
  it('remove máscara e uppercase', () => {
    expect(normalizePlate('qjl-1771')).toBe('QJL1771');
  });
});

describe('lookupVpoVehicleByPlate', () => {
  it('QJL1771 → SEMPARAR TAG ativa', () => {
    const v = lookupVpoVehicleByPlate('QJL-1771');
    expect(v?.emissor).toBe('SEMPARAR');
    expect(v?.tag).toBe('0737371360');
    expect(v?.ativo).toBe(true);
    expect(tipoValeFromLookup(v)).toBe('01');
    expect(fornecedoraCnpjOf('SEMPARAR')).toBe('04088208000165');
  });

  it('placa desconhecida → null', () => {
    expect(lookupVpoVehicleByPlate('AAA0000')).toBeNull();
  });
});

describe('resolveIdVpo', () => {
  it('prioriza idANTT', () => {
    expect(resolveIdVpo({ idANTT: 'ANT-1', idVpo: 'x', codigoViagem: 'c', idViagemAILog: 9 })).toBe(
      'ANT-1'
    );
  });

  it('cai para idViagemAILog', () => {
    expect(resolveIdVpo({ idViagemAILog: 56 })).toBe('56');
  });
});

describe('vpoLookupFromConsult', () => {
  it('SFN1D89 SEMPARAR ativo → lookup com TAG', () => {
    const v = vpoLookupFromConsult({
      emissor: 'SEMPARAR',
      placa: 'SFN1D89',
      tag: '0737000001',
      ativo: true,
      status: 'SUCESSO',
      quantidadeEixos: 5,
      nomeProprietario: 'CLAUDIOMIR DE JESUZ',
      descricao: 'SCANIA CAT>1 R420 - CAT 05 - 05 EIXOS ROD DUPLA',
    });
    expect(v).toEqual({
      plate: 'SFN1D89',
      emissor: 'SEMPARAR',
      tag: '0737000001',
      ativo: true,
      status: 'SUCESSO',
      quantidadeEixos: 5,
      nomeProprietario: 'CLAUDIOMIR DE JESUZ',
      descricao: 'SCANIA CAT>1 R420 - CAT 05 - 05 EIXOS ROD DUPLA',
    });
    expect(tipoValeFromLookup(v)).toBe('01');
  });

  it('emissor fora da lista → null', () => {
    expect(
      vpoLookupFromConsult({
        emissor: 'FOO',
        placa: 'SFN1D89',
        tag: null,
        ativo: true,
        status: 'SUCESSO',
      })
    ).toBeNull();
  });

  it('ativo false ainda devolve lookup (UI mostra TAG inativa)', () => {
    const v = vpoLookupFromConsult({
      emissor: 'SEMPARAR',
      placa: 'ABC1D23',
      tag: null,
      ativo: false,
      status: 'VEICULO_INVALIDO',
    });
    expect(v?.ativo).toBe(false);
    expect(v?.emissor).toBe('SEMPARAR');
  });
});

describe('resolveVpoVehicleForUi', () => {
  it('live ganha do catálogo estático', () => {
    const live = vpoLookupFromConsult({
      emissor: 'SEMPARAR',
      placa: 'SFN1D89',
      tag: '999',
      ativo: true,
      status: 'SUCESSO',
    });
    const catalog = lookupVpoVehicleByPlate('QJL1771');
    expect(resolveVpoVehicleForUi({ live, catalog, liveFetched: true })).toEqual(live);
  });

  it('consulta miss não cai no catálogo de outra placa', () => {
    const catalog = lookupVpoVehicleByPlate('QJL1771');
    expect(resolveVpoVehicleForUi({ live: null, catalog, liveFetched: true })).toBeNull();
  });

  it('consulta ainda não voltou → fallback catálogo', () => {
    const catalog = lookupVpoVehicleByPlate('QJL1771');
    expect(resolveVpoVehicleForUi({ live: null, catalog, liveFetched: false })).toEqual(catalog);
  });
});

describe('canEmitVpo', () => {
  const base = {
    canManage: true,
    tollFree: false,
    plate: 'SFN1D89',
    persistedId: '',
    emitPending: false,
  };

  it('libera com placa mesmo sem catálogo/live', () => {
    expect(canEmitVpo({ ...base, vehicleAtivo: false })).toBe(true);
  });

  it('bloqueia sem placa', () => {
    expect(canEmitVpo({ ...base, plate: '', vehicleAtivo: true })).toBe(false);
  });

  it('bloqueia rota sem pedágio', () => {
    expect(canEmitVpo({ ...base, tollFree: true, vehicleAtivo: true })).toBe(false);
  });

  it('bloqueia se VPO já persistido', () => {
    expect(canEmitVpo({ ...base, persistedId: '4599', vehicleAtivo: true })).toBe(false);
  });
});
