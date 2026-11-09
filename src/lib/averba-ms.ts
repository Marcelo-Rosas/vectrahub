/** Destinatários padrão da averbação manual Fairfax/MS (até AT&M em setembro). */
export const AVERBA_MS_TO_DEFAULT = [
  'operacional.cargo@fairfax.com.br',
  'kevin.cercal@msseguros.com.br',
  'Fellipe.medeiros@msseguros.com.br',
  'Ruan.nascimento@msseguros.com.br',
] as const;

export const AVERBA_MS_CC_DEFAULT = ['marcelo.rosas@vectracargo.com.br'] as const;

export function parseEmailList(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}

export function formatEmailList(emails: readonly string[]): string {
  return emails.join('\n');
}
