import { describe, expect, it } from 'vitest';
import {
  extractDestFromNfeXml,
  mergeNfeDestIntoMetadata,
  partyFromNfeMeta,
} from '@/lib/nfe-dest-from-meta';

const KEY = '42260830735998000214550020001134761867472316';

describe('partyFromNfeMeta', () => {
  it('chave-only metadata não tem dest', () => {
    expect(
      partyFromNfeMeta({ serie: '2', modelo: '55', cnpj_emitente: '30735998000214' }, KEY)
    ).toBeNull();
  });

  it('sobe dest aninhado em sefaz', () => {
    const p = partyFromNfeMeta(
      {
        serie: '2',
        sefaz: {
          destinatario_nome: 'AC7 COMERCIO LTDA',
          destinatario_cnpj: '12345678000199',
        },
      },
      KEY
    );
    expect(p?.name).toBe('AC7 COMERCIO LTDA');
    expect(p?.cnpj).toBe('12345678000199');
  });

  it('IE numérica → contribuinte', () => {
    const p = partyFromNfeMeta(
      {
        destinatario_nome: 'AC7',
        destinatario_cnpj: '17621295000116',
        destinatario_ie: '255123456',
      },
      KEY
    );
    expect(p?.ie_indicator).toBe(1);
    expect(p?.state_registration).toBe('255123456');
  });

  it('sobe dest de xml_data', () => {
    const p = partyFromNfeMeta(
      { xml_data: { destinatario_nome: 'FULANO', destinatario_cpf: '51491397500' } },
      KEY
    );
    expect(p?.name).toBe('FULANO');
    expect(p?.cpf).toBe('51491397500');
  });
});

describe('extractDestFromNfeXml', () => {
  it('lê dest com namespace e CPF', () => {
    const xml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe><nfe:dest xmlns:nfe="http://www.portalfiscal.inf.br/nfe"><nfe:CPF>51491397500</nfe:CPF><nfe:xNome>CLIENTE CPF</nfe:xNome><nfe:enderDest><nfe:xLgr>RUA A</nfe:xLgr><nfe:nro>10</nfe:nro><nfe:xBairro>CENTRO</nfe:xBairro><nfe:xMun>ITAJAI</nfe:xMun><nfe:UF>SC</nfe:UF><nfe:CEP>88301000</nfe:CEP></nfe:enderDest></nfe:dest></infNFe></NFe>`;
    const d = extractDestFromNfeXml(xml);
    expect(d.destinatario_nome).toBe('CLIENTE CPF');
    expect(d.destinatario_cpf).toBe('51491397500');
    expect(d.uf).toBe('SC');
    expect(d.cidade).toBe('ITAJAI');
  });
});

describe('mergeNfeDestIntoMetadata', () => {
  it('sobe cidade/UF/IE de xml_data', () => {
    const m = mergeNfeDestIntoMetadata({
      destinatario_nome: 'AC7',
      xml_data: { cidade: 'TUBARAO', uf: 'SC', destinatario_ie: '258346590', cep: '88704315' },
    });
    expect(m.cidade).toBe('TUBARAO');
    expect(m.uf).toBe('SC');
    expect(m.destinatario_ie).toBe('258346590');
  });

  it('não inventa nome vazio', () => {
    const m = mergeNfeDestIntoMetadata({ serie: '1' });
    expect(m.destinatario_nome).toBeUndefined();
  });
});
