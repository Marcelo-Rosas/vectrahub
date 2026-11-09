/**
 * Corpo HTML do e-mail de liberação de embarque excepcional (MS Seguros / Fairfax).
 */
import { MS_TEXT_LABELS, type MsLiberacaoForm, type MsTextKey } from './ms-liberacao-form.ts';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SUMMARY_KEYS: MsTextKey[] = [
  'apolice_numero_1',
  'motivo_esclarecer',
  'mercadoria_tipo',
  'mercadoria_valor',
  'embarcador',
  'destinatario',
  'notas_fiscais',
  'origem',
  'destino',
  'previsao_inicio',
  'placa',
  'gerenciadora',
];

export function buildMsLiberacaoHtml(input: {
  form: MsLiberacaoForm;
  deadline: Date;
  resend?: boolean;
  message?: string;
}): string {
  const rows = SUMMARY_KEYS.map((k) => {
    const v = String(input.form.text?.[k] ?? '').trim();
    return v
      ? `<tr><td style="padding:4px 12px 4px 0;color:#555;white-space:nowrap">${esc(MS_TEXT_LABELS[k])}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`
      : '';
  }).join('');

  const prazo = input.deadline.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const msg = input.message?.trim()
    ? `<p style="background:#fff8e1;padding:8px 12px;border-left:3px solid #f5a623">${esc(input.message.trim())}</p>`
    : '';

  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
<p>Prezados,</p>
${input.resend ? '<p><strong>REENVIO com dados corrigidos — desconsiderar a versão anterior.</strong></p>' : ''}
<p>Solicitamos <strong>liberação de embarque excepcional</strong> conforme formulário anexo (modelo MS Corretora).</p>
${msg}
<table style="border-collapse:collapse;margin:12px 0">${rows}</table>
<p>Conforme a apólice, aguardamos manifestação por escrito em até <strong>3 dias úteis</strong> (até ${esc(prazo)}).
Na ausência de resposta nesse prazo, o risco será considerado aceito.</p>
<p>Havendo código de liberação de limite, favor informá-lo na resposta para averbação.</p>
<p>Atenciosamente,<br/>VECTRA HUB LTDA — Operacional</p>
</div>`;
}
