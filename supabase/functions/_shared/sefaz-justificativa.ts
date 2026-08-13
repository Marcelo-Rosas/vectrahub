/**
 * SEFAZ xJust (CT-e/MDF-e cancelamento): pattern
 *   [!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}
 * → trim ends; first/last char must be printable non-space (Latin-1).
 * Length: 15–255 (regra operacional Focus / SEFAZ).
 */

const XJUST_RE = /^[!-ÿ](?:[ -ÿ]*[!-ÿ])?$/;

export type JustificativaOk = { ok: true; value: string };
export type JustificativaErr = { ok: false; detail: string };

export function normalizeSefazJustificativa(raw: unknown): JustificativaOk | JustificativaErr {
  const value = String(raw ?? '')
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

  if (value.length < 15 || value.length > 255) {
    return {
      ok: false,
      detail: 'Justificativa deve ter 15 a 255 caracteres (sem espaços no início/fim).',
    };
  }
  if (!XJUST_RE.test(value)) {
    return {
      ok: false,
      detail:
        'Justificativa rejeitada pela SEFAZ: não pode começar/terminar com espaço; use só caracteres Latin-1.',
    };
  }
  return { ok: true, value };
}
