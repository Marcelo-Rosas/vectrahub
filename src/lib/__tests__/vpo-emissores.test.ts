import { describe, expect, it } from 'vitest';
import {
  fornecedoraCnpjOf,
  lookupVpoVehicleByPlate,
  normalizePlate,
  resolveIdVpo,
  tipoValeFromLookup,
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
