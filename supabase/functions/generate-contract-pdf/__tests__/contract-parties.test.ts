import { describe, expect, it } from 'vitest';
import { resolveContractContratante } from '../contract-clause-helpers.ts';

const client = {
  name: 'Cliente Destino LTDA',
  cnpj: '11111111000111',
  address: 'Rua do Cliente',
  legal_representative_name: 'Rep Cliente',
};

const shipper = {
  name: 'Embarcador Remetente SA',
  cnpj: '22222222000122',
  address: 'Av. do Embarcador',
  legal_representative_name: 'Rep Embarcador',
};

describe('resolveContractContratante', () => {
  it('usa o embarcador (shipper) como CONTRATANTE quando frete é CIF', () => {
    const result = resolveContractContratante({
      freight_type: 'CIF',
      client_name: 'Cliente Destino LTDA',
      shipper_name: 'Embarcador Remetente SA',
      clients: client,
      shippers: shipper,
    });

    expect(result.isCif).toBe(true);
    expect(result.source).toBe('shipper');
    expect(result.party).toBe(shipper);
    expect(result.name).toBe('Embarcador Remetente SA');
  });

  it('usa o cliente como CONTRATANTE quando frete é FOB', () => {
    const result = resolveContractContratante({
      freight_type: 'FOB',
      client_name: 'Cliente Destino LTDA',
      shipper_name: 'Embarcador Remetente SA',
      clients: client,
      shippers: shipper,
    });

    expect(result.isCif).toBe(false);
    expect(result.source).toBe('client');
    expect(result.party).toBe(client);
    expect(result.name).toBe('Cliente Destino LTDA');
  });

  it('faz fallback para o cliente quando CIF mas embarcador está ausente', () => {
    const result = resolveContractContratante({
      freight_type: 'CIF',
      client_name: 'Cliente Destino LTDA',
      clients: client,
      shippers: null,
    });

    expect(result.isCif).toBe(true);
    expect(result.source).toBe('client');
    expect(result.party).toBe(client);
    expect(result.name).toBe('Cliente Destino LTDA');
  });

  it('normaliza freight_type minúsculo/espacos como CIF', () => {
    const result = resolveContractContratante({
      freight_type: ' cif ',
      clients: client,
      shippers: shipper,
    });

    expect(result.isCif).toBe(true);
    expect(result.source).toBe('shipper');
  });
});
