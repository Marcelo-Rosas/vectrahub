/** Lockup header /feira — SVG local nos tenants curados; box CSS único. */

export const FAIR_LOCAL_LOCKUP_SLUGS = new Set(['buckler', 'konnen', 'playfit', 'rotha']);

export const FAIR_LOCKUP_BOX =
  'flex h-10 w-[13.5rem] items-center justify-center rounded-lg px-2 py-1';

export const FAIR_LOCKUP_IMG = 'max-h-8 max-w-[12.5rem] h-auto w-auto object-contain';

/** Brandfetch fora do header nos slugs com SVG curado. */
export function fairHeaderLogoUrl(
  slug: string,
  apiLogoUrl: string | null | undefined
): string | null {
  if (FAIR_LOCAL_LOCKUP_SLUGS.has(slug.trim().toLowerCase())) return null;
  const api = (apiLogoUrl ?? '').trim();
  return api || null;
}

export function pickFairLockupSrc(opts: {
  slug: string;
  localSrc: string;
  apiSrc?: string | null;
  qualityScore?: number | null;
}): string | null {
  const local = opts.localSrc.trim();
  const api = (opts.apiSrc ?? '').trim();
  const slug = opts.slug.trim().toLowerCase();
  if (FAIR_LOCAL_LOCKUP_SLUGS.has(slug) && local) return local;
  return api || local || null;
}
