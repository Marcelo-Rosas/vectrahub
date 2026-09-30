import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MS_TEMPLATE_TOKENS } from '../../../supabase/functions/_shared/ms-liberacao-template';
import {
  MS_CHECK_KEYS,
  MS_TEXT_KEYS,
  fillMsLiberacaoXml,
  validateMsForm,
  type MsLiberacaoForm,
} from '../ms-liberacao-form';

describe('template MS ↔ chaves do formulário', () => {
  it('todo token do DOCX tem chave e vice-versa', () => {
    const expected = [
      ...MS_TEXT_KEYS,
      ...MS_CHECK_KEYS.map((k) => `chk:${k}`),
      ...MS_CHECK_KEYS.map((k) => `chkv:${k}`),
    ].sort();
    expect([...MS_TEMPLATE_TOKENS].sort()).toEqual(expected);
  });
});

describe('fillMsLiberacaoXml', () => {
  const xml =
    '<w:t>{{embarcador}}</w:t><w14:checked w14:val="{{chkv:motivo_limite}}"/><w:t>{{chk:motivo_limite}}</w:t>' +
    '<w:t>{{chk:motivo_excluida}}</w:t><w:t>{{placa}}</w:t><w:t>{{desconhecido}}</w:t>';

  it('preenche texto com escape XML e marca checkboxes', () => {
    const out = fillMsLiberacaoXml(xml, {
      text: { embarcador: 'CORE HEALTH & FITNESS <BR>' },
      checks: { motivo_limite: true },
    });
    expect(out).toContain('<w:t>CORE HEALTH &amp; FITNESS &lt;BR&gt;</w:t>');
    expect(out).toContain('w14:val="1"');
    expect(out).toContain('<w:t>☒</w:t><w:t>☐</w:t>');
    expect(out).not.toContain('{{');
  });

  it('quebra de linha vira " / " (Word não quebra dentro de w:t)', () => {
    const out = fillMsLiberacaoXml('<w:t>{{placa}}</w:t>', {
      text: { placa: 'ABC1D23\nXYZ9K87' },
      checks: {},
    });
    expect(out).toBe('<w:t>ABC1D23 / XYZ9K87</w:t>');
  });
});

describe('validateMsForm', () => {
  it('formulário vazio lista obrigatórios', () => {
    const errs = validateMsForm({ text: {}, checks: {} });
    expect(errs).toContain('Preencha: Embarcador');
    expect(errs.some((e) => e.includes('motivo'))).toBe(true);
  });

  it('formulário completo passa', () => {
    const form: MsLiberacaoForm = {
      text: Object.fromEntries(MS_TEXT_KEYS.map((k) => [k, 'x'])),
      checks: {
        apolice_rcf_dc: true,
        motivo_limite: true,
        modal_rodoviario: true,
        veiculo_agregado: true,
        tipo_caminhao: true,
        motorista_agregado: true,
        rastreio_hibrido: true,
        escolta_nao: true,
      },
    };
    expect(validateMsForm(form)).toEqual([]);
  });

  it('escolta sim exige quantidade', () => {
    const errs = validateMsForm({ text: {}, checks: { escolta_sim: true } });
    expect(errs).toContain('Escolta armada: informe a quantidade de veículos');
  });
});

describe('paridade ms-liberacao-form', () => {
  it('src/lib ↔ _shared idênticos', () => {
    const strip = (s: string) => s.replace(/^ \* Paridade obrigatória com .*$/m, '');
    const root = resolve(__dirname, '../../..');
    expect(strip(readFileSync(resolve(root, 'src/lib/ms-liberacao-form.ts'), 'utf8'))).toBe(
      strip(readFileSync(resolve(root, 'supabase/functions/_shared/ms-liberacao-form.ts'), 'utf8'))
    );
  });
});
