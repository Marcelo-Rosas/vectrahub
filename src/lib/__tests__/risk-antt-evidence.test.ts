import { describe, expect, it } from 'vitest';
import {
  anttEvidenceToCollectionOrderSnapshot,
  parseAnttMunicipioUf,
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
