/** Código COT feira — prefixo por slug pra unique global `quotes_quote_code_key`. */

export function fairQuoteCodeSlug(slug: string): string {
  const key = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16);
  return (key || 'feira').toUpperCase();
}

export function fairQuoteCodePrefix(slug: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `FEIRA-${fairQuoteCodeSlug(slug)}-${y}-${m}-`;
}

export function nextFairQuoteCode(existingCodes: string[], slug: string, now = new Date()): string {
  const prefix = fairQuoteCodePrefix(slug, now);
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
