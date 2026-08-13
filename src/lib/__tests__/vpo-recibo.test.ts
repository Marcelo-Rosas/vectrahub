import { describe, expect, it } from 'vitest';
import { isVpoReciboOk, parseVpoReciboViagem } from '@/lib/vpo-recibo';
import { labelVpoTipoViagem, normalizeVpoTipoViagem } from '@/lib/vpo-emissores';

const SAMPLE = {
  id: 1,
  emissor: 'SEMPARAR',
  idViagemOSA: 352015,
  codigoViagemOSA: '83d8e5d1-2cb1-429e-88e6-f09918767330',
  descricaoCategoria: null,
  cnpjEmissor: '07.398.335/0001-59',
  nomeEmissor: 'Sem Parar (CGMP)',
  cnpjTransportador: '48077235000108',
  nomeTransportador: 'Transportador PJ',
  dataCompra: '23/06/2022 16:52',
  dataHoraExportacao: '23/06/2022 16:52',
  dataViagem: null,
  urlLogo: null,
  nomeRota: null,
  status: 'SUCESSO',
  tipo: null,
  valorTotal: 8.74,
};

describe('parseVpoReciboViagem', () => {
  it('parseia retorno oficial getReciboViagem', () => {
    const r = parseVpoReciboViagem(SAMPLE);
    expect(r?.status).toBe('SUCESSO');
    expect(r?.valorTotal).toBe(8.74);
    expect(r?.codigoViagemOSA).toBe('83d8e5d1-2cb1-429e-88e6-f09918767330');
    expect(isVpoReciboOk(r)).toBe(true);
  });

  it('lixo / vazio → null', () => {
    expect(parseVpoReciboViagem(null)).toBeNull();
    expect(parseVpoReciboViagem({})).toBeNull();
    expect(isVpoReciboOk(null)).toBe(false);
  });

  it('parseia tipo Rota Estendida do recibo SemParar', () => {
    const r = parseVpoReciboViagem({ ...SAMPLE, tipo: 'Rota Estendida' });
    expect(r?.tipo).toBe('Rota Estendida');
    expect(normalizeVpoTipoViagem(r?.tipo)).toBe('ESTENDIDA');
    expect(labelVpoTipoViagem(r?.tipo)).toBe('Rota Estendida');
  });
});

describe('normalizeVpoTipoViagem', () => {
  it('mapeia aliases SemParar/WebRouter', () => {
    expect(normalizeVpoTipoViagem('ESTENDIDA')).toBe('ESTENDIDA');
    expect(normalizeVpoTipoViagem('Rota Estendida')).toBe('ESTENDIDA');
    expect(normalizeVpoTipoViagem('PLANEJADA')).toBe('PLANEJADA');
    expect(normalizeVpoTipoViagem('rota fixa')).toBe('PLANEJADA');
    expect(normalizeVpoTipoViagem('CUSTOMIZADA')).toBe('CUSTOMIZADA');
    expect(normalizeVpoTipoViagem('')).toBeNull();
  });
});
