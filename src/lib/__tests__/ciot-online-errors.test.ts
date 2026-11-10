import { describe, expect, it } from 'vitest';
import { ciotErrorMessage } from '@/lib/ciot-online-errors';

describe('ciotErrorMessage', () => {
  it('licença/créditos', () => {
    expect(ciotErrorMessage('licenca_vencida')).toContain('Sem créditos/licença CIOT Online');
    expect(ciotErrorMessage('sem_creditos')).toContain('Sem créditos/licença CIOT Online');
  });

  it('emissao_falhou mostra status ANTT e detalhe', () => {
    const m = ciotErrorMessage('emissao_falhou', 'DADOS_INVALIDOS', 'RNTRC inválido');
    expect(m).toContain('DADOS_INVALIDOS');
    expect(m).toContain('RNTRC inválido');
  });

  it('textos fixos do spec', () => {
    expect(ciotErrorMessage('token_invalido')).toBe(
      'Integração CIOT Online inválida — falar com admin'
    );
    expect(ciotErrorMessage('antt_sem_protocolo')).toBe(
      'ANTT não confirmou — consultar antes de reemitir'
    );
    expect(ciotErrorMessage('motivo_invalido')).toBe('Motivo deve ter ao menos 10 caracteres');
    expect(ciotErrorMessage('nao_encontrado')).toBe('CIOT não encontrado no CIOT Online');
  });

  it('código desconhecido → fallback', () => {
    expect(ciotErrorMessage('xyz', undefined, 'Falha X')).toBe('Falha X');
    expect(ciotErrorMessage(undefined, undefined, undefined)).toBe('Falha ao processar CIOT');
  });

  it('api_desabilitada → orienta pedir habilitação', () => {
    expect(ciotErrorMessage('api_desabilitada')).toContain('adm@ciotonline.com.br');
  });
});
