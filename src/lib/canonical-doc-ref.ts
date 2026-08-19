/**
 * Regra canônica de identificação de documentos (COT / OS / OC / CTR):
 * a razão social do PAGADOR do frete fica SEMPRE registrada após o número.
 *
 * Pagador: CIF → embarcador (shipper); FOB (ou sem tipo) → cliente (client).
 * Os códigos gravados no banco (`quote_code`, `os_number`, `oc_number`) NÃO mudam;
 * a razão social entra apenas na referência exibida e no nome do arquivo.
 */

/** Resolve a razão social do pagador do frete conforme o tipo (CIF/FOB). */
export function resolveFreightPayerName(
  freightType: string | null | undefined,
  clientName: string | null | undefined,
  shipperName: string | null | undefined
): string {
  const isCif =
    String(freightType ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  const client = String(clientName ?? '').trim();
  const shipper = String(shipperName ?? '').trim();
  if (isCif) return shipper || client;
  return client || shipper;
}

/** Slug da razão social para nome de arquivo (ASCII, maiúsculo). */
export function slugifyPayer(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 80);
}

/**
 * Deriva o código CTR do contrato a partir do `quote_code`.
 * `COT-2026-08-0002` → `CTR-2026-08-0002`; com sequence → `CTR-2026-08-0002-01`.
 */
export function ctrCodeFromQuoteCode(
  quoteCode: string | null | undefined,
  sequence?: number
): string {
  const code = String(quoteCode ?? '').trim();
  let base = 'CTR';
  if (code) {
    base = /^COT-/i.test(code) ? code.replace(/^COT-/i, 'CTR-') : `CTR-${code}`;
  }
  if (sequence == null || sequence < 1) return base;
  return `${base}-${String(sequence).padStart(2, '0')}`;
}

/** Contratos emitidos antes da regra CTR canônica (prefixo COT no filename). */
export function isLegacyContractFilename(fileName: string | null | undefined): boolean {
  const name = String(fileName ?? '').trim();
  if (!name) return false;
  if (/^CTR-/i.test(name)) return false;
  return /^COT-/i.test(name) || /_contrato_v/i.test(name);
}

/** Referência exibida no documento: `CÓDIGO — RAZÃO SOCIAL DO PAGADOR`. */
export function buildCanonicalReference(
  code: string | null | undefined,
  payerName: string | null | undefined
): string {
  const c = String(code ?? '').trim() || '[SEM CÓDIGO]';
  const p = String(payerName ?? '').trim();
  return p ? `${c} — ${p}` : c;
}

/** Nome de arquivo canônico: `CÓDIGO-RAZAO_SOCIAL_SLUG.ext`. */
export function buildCanonicalFilename(
  code: string | null | undefined,
  payerName: string | null | undefined,
  ext = 'pdf'
): string {
  const c =
    String(code ?? '')
      .trim()
      .replace(/[^\w-]+/g, '_') || 'documento';
  const slug = slugifyPayer(payerName);
  return slug ? `${c}-${slug}.${ext}` : `${c}.${ext}`;
}
