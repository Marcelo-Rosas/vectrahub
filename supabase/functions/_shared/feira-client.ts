/** PostgREST schema `feira`. */

// deno-lint-ignore no-explicit-any
export function feiraFrom(supabase: { schema: (name: string) => any }, table: string): any {
  return supabase.schema('feira').from(table);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

export function mapQuoteStatus(status: string | null | undefined): 'open' | 'won' | 'lost' {
  if (status === 'won' || status === 'approved') return 'won';
  if (status === 'lost' || status === 'rejected') return 'lost';
  return 'open';
}
