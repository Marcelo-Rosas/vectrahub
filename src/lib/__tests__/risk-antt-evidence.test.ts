import { describe, expect, it } from 'vitest';
import {
  anttEvidenceToCollectionOrderSnapshot,
  anttRntrcForPortal,
  anttShouldFallbackToPlaca,
  isAnttPendente,
  parseAnttMunicipioUf,
  resolveAnttConsultPath,
  resolveAnttRegistryType,
  anttRegistryToMdfeTipoProprietario,
} from '@/lib/risk-antt-evidence';
import type { RiskEvidence } from '@/types/risk';

describe('risk-antt-evidence', () => {
  it('parseAnttMunicipioUf extrai UF de Município/UF', () => {
    expect(parseAnttMunicipioUf('Itajaí/SC')).toEqual({ municipio: 'Itajaí', uf: 'SC' });
    expect(parseAnttMunicipioUf('PAULISTA/PE')).toEqual({ municipio: 'PAULISTA', uf: 'PE' });
  });

  it('resolveAnttRegistryType lê prefixo do transportador', () => {
    expect(
      resolveAnttRegistryType({
        rntrc_registry_type: null,
        transportador: 'ETC - Vectra Hub Ltda',
      })
    ).toBe('ETC');
    expect(anttRegistryToMdfeTipoProprietario('ETC')).toBe('2');
    expect(anttRegistryToMdfeTipoProprietario('TAC')).toBe('1');
  });

  it('mapeia payload do wizard para snapshot da OC', () => {
    const evidence: RiskEvidence = {
      id: 'e1',
      evaluation_id: 'ev1',
      evidence_type: 'antt_rntrc_check',
      document_id: null,
      status: 'valid',
      expires_at: null,
      notes: null,
      created_by: null,
      created_at: '2026-06-09T12:00:00Z',
      payload: {
        situacao: 'regular',
        situacao_raw: 'ATIVO',
        rntrc_registry_type: 'TAC',
        rntrc: '050860844',
        transportador: 'TAC - Leonardo Anselmo do Monte',
        apto: false,
        cpf_cnpj: '03280298407',
        municipio_uf: 'PAULISTA/PE',
        cadastrado_desde: '2015-03-10',
        vehicle_plate: 'ABC1D23',
      },
    };

    const snap = anttEvidenceToCollectionOrderSnapshot(evidence);
    expect(snap.rntrc).toBe('050860844');
    expect(snap.rntrc_registry_type).toBe('TAC');
    expect(snap.transportador).toBe('Leonardo Anselmo do Monte');
    expect(snap.cpf_cnpj_mask).toBe('03280298407');
    expect(snap.municipio_uf).toBe('PAULISTA/PE');
    expect(snap.cadastrado_desde).toBe('2015-03-10');
    expect(snap.apto).toBe(false);
  });
});

describe('resolveAnttConsultPath', () => {
  it('cadastro terceiro + motorista dono do cavalo (mesmo CPF) → ANTT TAC Por Transportador', () => {
    expect(
      resolveAnttConsultPath({
        contractType: 'terceiro',
        driverCpf: '026.520.109-80',
        ownerDoc: '02652010980',
      })
    ).toBe('proprio');
  });

  it('cadastro terceiro + dono empresa CNPJ → Por Veículo', () => {
    expect(
      resolveAnttConsultPath({
        contractType: 'terceiro',
        driverCpf: '02652010980',
        ownerDoc: '12.345.678/0001-99',
      })
    ).toBe('terceiro');
  });

  it('motorista CPF ≠ dono CPF → agregado', () => {
    expect(
      resolveAnttConsultPath({
        contractType: 'terceiro',
        driverCpf: '02652010980',
        ownerDoc: '11122233344',
      })
    ).toBe('agregado');
  });

  it('sem dono cadastrado cai no contract_type', () => {
    expect(
      resolveAnttConsultPath({
        contractType: 'terceiro',
        driverCpf: '02652010980',
        ownerDoc: null,
      })
    ).toBe('terceiro');
  });
});

describe('anttRntrcForPortal', () => {
  it('8 dígitos (SEFAZ) não vai no filtro Por Transportador', () => {
    expect(anttRntrcForPortal('56875933')).toBeUndefined();
  });

  it('9 dígitos ANTT vai no filtro', () => {
    expect(anttRntrcForPortal('053625011')).toBe('053625011');
  });

  it('vazio → omite', () => {
    expect(anttRntrcForPortal(null)).toBeUndefined();
    expect(anttRntrcForPortal('')).toBeUndefined();
  });
});

describe('anttShouldFallbackToPlaca', () => {
  it('Por Transportador vazio (irregular sem RNTRC) → cai na placa', () => {
    expect(anttShouldFallbackToPlaca({ situacao: 'irregular', rntrc: null })).toBe(true);
  });

  it('PENDENTE com RNTRC não cai na placa', () => {
    expect(anttShouldFallbackToPlaca({ situacao: 'irregular', rntrc: '053625011' })).toBe(false);
  });

  it('regular não cai', () => {
    expect(anttShouldFallbackToPlaca({ situacao: 'regular', rntrc: '053625011' })).toBe(false);
  });
});

describe('isAnttPendente', () => {
  it('PENDENTE no portal é liberável pelo operador', () => {
    expect(isAnttPendente({ situacao_raw: 'PENDENTE' })).toBe(true);
    expect(isAnttPendente({ situacao_raw: 'pendente' })).toBe(true);
  });

  it('ATIVO / CANCELADO / vazio não é pendente', () => {
    expect(isAnttPendente({ situacao_raw: 'ATIVO' })).toBe(false);
    expect(isAnttPendente({ situacao_raw: 'CANCELADO' })).toBe(false);
    expect(isAnttPendente({ situacao: 'irregular' })).toBe(false);
  });
});
