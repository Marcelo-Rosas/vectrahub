import { describe, expect, it } from 'vitest';
import {
  FICHA_CADASTRAL_FILE_NAME,
  buildCompanyAddressLine,
  formatCepDisplay,
} from '@/lib/generateCompanyFichaCadastralPdf';

describe('Ficha Cadastral Vectra HUB', () => {
  it('nome do download e descricao do documento', () => {
    expect(FICHA_CADASTRAL_FILE_NAME).toBe('Ficha Cadastral Vectra HUB.pdf');
  });

  it('formata CEP', () => {
    expect(formatCepDisplay('88370600')).toBe('88370-600');
    expect(formatCepDisplay('88370-600')).toBe('88370-600');
    expect(formatCepDisplay(null)).toBe('—');
  });

  it('monta endereco completo da Vectra HUB', () => {
    expect(
      buildCompanyAddressLine({
        legal_name: 'VECTRA HUB LTDA',
        cnpj: '62188748000117',
        address_street: 'Rodovia Jorge Lacerda',
        address_number: '725',
        address_neighborhood: 'Sao Vicente',
        address_city: 'Itajai',
        address_state: 'SC',
        address_zip: '88370600',
      })
    ).toBe('Rodovia Jorge Lacerda, 725 · Sao Vicente · Itajai/SC · CEP 88370-600');
  });
});
