/** Lockup header /feira — Suporte unificado a PNG. */

export const FAIR_LOCAL_LOCKUP_SLUGS = new Set(['buckler', 'konnen', 'playfit', 'rotha']);

export const FAIR_LOCKUP_BOX =
  'mx-auto flex h-12 md:h-14 w-auto max-w-[14rem] md:max-w-[16rem] items-center justify-center rounded-lg px-3 py-1.5';

export const FAIR_LOCKUP_IMG = 'h-full w-full object-contain object-center';

/** Brandfetch fora do header nos slugs curados (mantido como fallback). */
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
