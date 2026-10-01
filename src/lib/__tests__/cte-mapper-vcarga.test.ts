import { describe, expect, it } from 'vitest';
import {
  buildCtePayload,
  type PartyRow,
  type QuoteRow,
  type VectraConfig,
} from '../../../supabase/functions/_shared/cte-mapper';

const vectra: VectraConfig = {
  cnpj: '62188748000117',
  nome: 'VECTRA HUB LTDA',
  fantasia: 'VECTRA HUB',
  ie: '263768406',
  iest: '263768406',
  rntrc: '59734055',
  logradouro: 'Rodovia Jorge Lacerda',
  numero: '725',
  bairro: 'Espinheiros',
  municipio: 'Itajaí',
  ibge: 4208203,
  uf: 'SC',
  cep: '88317100',
  crt: 1,
};

const shipper = {
  name: 'CORE HEALTH & FITNESS BRASIL',
  cnpj: '19827141000291',
  state: 'RJ',
  city: 'Rio de Janeiro',
  ibge_code: 3304557,
  ie_indicator: 1,
} as unknown as PartyRow;

const client = {
  name: 'ACADEMIA JP LTDA',
  cnpj: '60718879000133',
  state: 'PB',
  city: 'João Pessoa',
  ibge_code: 2507507,
  ie_indicator: 9,
} as unknown as PartyRow;

describe('buildCtePayload — infCarga/vCarga (COT-2026-10-0001)', () => {
  it('envia valor_total_carga (campo lido pela Focus → vCarga), não só valor_carga', () => {
    const quote = {
      id: 'q1',
      quote_code: 'COT-2026-10-0001',
      cargo_value: 788894.44,
      cargo_type: 'EQUIPAMENTOS',
      weight: 9000,
      value: 25000,
      tomador_tipo: 3,
      nfe_keys: [],
    } as unknown as QuoteRow;

    const { payload } = buildCtePayload({ quote, shipper, client, serie: 1, numero: 33, vectra });
    const p = payload as Record<string, unknown>;
    expect(p.valor_total_carga).toBe(788894.44);
    // mantido: emit-mdfe (gate de seguro) e send-averba-ms-email leem payload_sent.valor_carga
    expect(p.valor_carga).toBe(788894.44);
  });
});
