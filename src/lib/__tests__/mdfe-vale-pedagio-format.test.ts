import { describe, expect, it } from 'vitest';
import { buildMdfeDispositivosValePedagio } from '../../../supabase/functions/_shared/mdfe-mapper';

// SEFAZ (leiaute MDF-e) vValePed: pattern 0|0\.[0-9]{2}|[1-9][0-9]{0,12}(\.[0-9]{2})?
// → valor com centavos precisa de exatamente 2 casas ("117.90", não 117.9).
const VVALEPED = /^(0|0\.[0-9]{2}|[1-9][0-9]{0,12}(\.[0-9]{2})?)$/;

function valorEnviado(valor: number): string {
  const out = buildMdfeDispositivosValePedagio(
    [
      {
        cnpjFornecedora: '04088208000165',
        cnpjPagador: '62188748000117',
        numeroComprovante: '74740544923418983481',
        valor,
        tipo: '01',
      },
    ] as never,
    '02',
    []
  ) as { dispositivos_vale_pedagio: Array<{ valor_vale_pedagio: unknown }> };
  return String(out.dispositivos_vale_pedagio[0].valor_vale_pedagio);
}

describe('vValePed com 2 casas decimais', () => {
  it('117.9 sai como "117.90" (rejeição SEFAZ pattern)', () => {
    expect(valorEnviado(117.9)).toBe('117.90');
    expect(valorEnviado(117.9)).toMatch(VVALEPED);
  });

  it('126.16 permanece "126.16"', () => {
    expect(valorEnviado(126.16)).toBe('126.16');
  });

  it('valor inteiro sai como "170.00"', () => {
    expect(valorEnviado(170)).toMatch(VVALEPED);
    expect(valorEnviado(170)).toBe('170.00');
  });
});
