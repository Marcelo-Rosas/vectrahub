/**
 * Formulário oficial MS Seguros "Liberação de embarque excepcional" — campos e preenchimento.
 * Paridade obrigatória com supabase/functions/_shared/ms-liberacao-form.ts
 *
 * O template DOCX (_shared/ms-liberacao-template.ts) tem os content controls do Word trocados por
 * tokens: texto → {{key}}; checkbox → glyph {{chk:key}} + w14:checked {{chkv:key}}.
 * Gerado por scripts/ms-liberacao/tokenize_docx.py a partir do DOCX original da corretora.
 */

export const MS_TEXT_KEYS = [
  'segurado_nome',
  'apolice_numero_1',
  'apolice_numero_2',
  'lmg',
  'sublimite',
  'motivo_esclarecer',
  'mercadoria_tipo',
  'mercadoria_valor',
  'embarcador',
  'destinatario',
  'notas_fiscais',
  'conhecimento',
  'origem',
  'destino',
  'mercadoria_usada',
  'container',
  'percurso_fluvial',
  'previsao_inicio',
  'transportadora',
  'placa',
  'terceiro_viagens_12m',
  'rastreador_modelo',
  'escolta_qtd',
  'gerenciadora',
  'info_adicionais',
] as const;

export const MS_CHECK_GROUPS = {
  apolice: [
    'apolice_tn',
    'apolice_rctr_vi',
    'apolice_rctr_c',
    'apolice_rcf_dc',
    'apolice_ti_imp',
    'apolice_ti_exp',
    'apolice_rcta_c',
  ],
  motivo: [
    'motivo_limite',
    'motivo_excluida',
    'motivo_sem_gr',
    'motivo_gr_desacordo',
    'motivo_rastreador',
  ],
  modal: [
    'modal_rodoviario',
    'modal_aereo',
    'modal_maritimo',
    'modal_rodo_aereo',
    'modal_rodo_fluvial',
    'modal_cabotagem',
    'modal_ferroviario',
  ],
  veiculo: ['veiculo_frotista', 'veiculo_agregado', 'veiculo_terceiro'],
  tipo_veiculo: ['tipo_caminhao', 'tipo_utilitario', 'tipo_passeio', 'tipo_moto'],
  motorista: ['motorista_frotista', 'motorista_agregado', 'motorista_terceiro'],
  rastreio: ['rastreio_gprs', 'rastreio_satelital', 'rastreio_hibrido', 'rastreio_rf'],
  tec2: ['tec2_localizador', 'tec2_isca'],
  escolta: ['escolta_sim', 'escolta_nao'],
} as const;

export type MsTextKey = (typeof MS_TEXT_KEYS)[number];
export type MsCheckGroup = keyof typeof MS_CHECK_GROUPS;
export type MsCheckKey = (typeof MS_CHECK_GROUPS)[MsCheckGroup][number];

export const MS_CHECK_KEYS: readonly MsCheckKey[] = Object.values(
  MS_CHECK_GROUPS
).flat() as MsCheckKey[];

export type MsLiberacaoForm = {
  text: Partial<Record<MsTextKey, string>>;
  checks: Partial<Record<MsCheckKey, boolean>>;
};

export const MS_TEXT_LABELS: Record<MsTextKey, string> = {
  segurado_nome: 'Nome do segurado',
  apolice_numero_1: 'Número da apólice',
  apolice_numero_2: 'Número da apólice (2ª)',
  lmg: 'Limite Máximo de Garantia da apólice',
  sublimite: 'Sublimite',
  motivo_esclarecer: 'Esclarecer (motivo)',
  mercadoria_tipo: 'Tipo de mercadoria',
  mercadoria_valor: 'Valor da mercadoria',
  embarcador: 'Embarcador',
  destinatario: 'Destinatário',
  notas_fiscais: 'Nota fiscal / Fatura comercial',
  conhecimento: 'Conhecimento de transporte',
  origem: 'Origem (Cidade/UF/País)',
  destino: 'Destino (Cidade/UF/País)',
  mercadoria_usada: 'A mercadoria é usada?',
  container: 'Será utilizado container?',
  percurso_fluvial: 'Haverá percurso complementar fluvial?',
  previsao_inicio: 'Previsão de início',
  transportadora: 'Transportadora',
  placa: 'Placa do veículo',
  terceiro_viagens_12m: 'Se terceiro: viagens pela empresa nos últimos 12 meses',
  rastreador_modelo: 'Modelo do equipamento rastreador',
  escolta_qtd: 'Quantidade de veículos da escolta',
  gerenciadora: 'Gerenciadora de risco',
  info_adicionais: 'Informações adicionais',
};

/** Obrigatórios para enviar à MS (os demais podem ir em branco). */
export const MS_REQUIRED_TEXT: readonly MsTextKey[] = [
  'segurado_nome',
  'apolice_numero_1',
  'lmg',
  'motivo_esclarecer',
  'mercadoria_tipo',
  'mercadoria_valor',
  'embarcador',
  'destinatario',
  'notas_fiscais',
  'origem',
  'destino',
  'previsao_inicio',
  'transportadora',
  'placa',
  'gerenciadora',
];

/** Grupos que exigem ao menos uma opção marcada. */
export const MS_REQUIRED_GROUPS: readonly MsCheckGroup[] = [
  'apolice',
  'motivo',
  'modal',
  'veiculo',
  'tipo_veiculo',
  'motorista',
  'rastreio',
  'escolta',
];

export function validateMsForm(form: MsLiberacaoForm): string[] {
  const errors: string[] = [];
  for (const k of MS_REQUIRED_TEXT) {
    if (!String(form.text?.[k] ?? '').trim()) errors.push(`Preencha: ${MS_TEXT_LABELS[k]}`);
  }
  for (const g of MS_REQUIRED_GROUPS) {
    if (!MS_CHECK_GROUPS[g].some((k) => form.checks?.[k as MsCheckKey])) {
      errors.push(`Marque ao menos uma opção em: ${g.replace('_', ' ')}`);
    }
  }
  if (form.checks?.escolta_sim && form.checks?.escolta_nao)
    errors.push('Escolta: marque Sim ou Não, não ambos');
  if (form.checks?.escolta_sim && !String(form.text?.escolta_qtd ?? '').trim()) {
    errors.push('Escolta armada: informe a quantidade de veículos');
  }
  return errors;
}

export function escapeXml(s: string): string {
  return (
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      // Controles XML inválidos (mantém \t \n \r)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}

const CHECKED = '☒'; // ☒
const UNCHECKED = '☐'; // ☐

/** Substitui tokens no document.xml. Token desconhecido/sem valor vira vazio (nunca vaza "{{"). */
export function fillMsLiberacaoXml(xml: string, form: MsLiberacaoForm): string {
  return xml.replace(
    /\{\{(chkv:|chk:)?([a-z0-9_]+)\}\}/g,
    (_m, prefix: string | undefined, key: string) => {
      if (prefix === 'chk:') return form.checks?.[key as MsCheckKey] ? CHECKED : UNCHECKED;
      if (prefix === 'chkv:') return form.checks?.[key as MsCheckKey] ? '1' : '0';
      const raw = String(form.text?.[key as MsTextKey] ?? '').trim();
      // Quebra de linha dentro de <w:t> não renderiza no Word — vira " / ".
      return escapeXml(raw.replace(/\s*\r?\n\s*/g, ' / '));
    }
  );
}
