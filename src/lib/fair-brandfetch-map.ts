/** Brandfetch Brand API → tokens /feira. Sem HTTP aqui. */

import type { FairBrandHex, FairBrandTokens } from '@/lib/fair-brand-palettes';
import { contrastText } from '@/lib/fair-brand-palettes';

export type BrandfetchColor = {
  hex?: string;
  type?: 'accent' | 'dark' | 'light' | 'brand';
  brightness?: number;
};

export type BrandfetchLogoFormat = {
  src?: string;
  format?: string;
  width?: number;
  height?: number;
};

export type BrandfetchLogo = {
  theme?: 'light' | 'dark';
  type?: 'logo' | 'symbol' | 'icon' | 'other';
  formats?: BrandfetchLogoFormat[];
};

export type BrandfetchBrandPayload = {
  name?: string;
  domain?: string;
  logos?: BrandfetchLogo[];
  colors?: BrandfetchColor[];
  qualityScore?: number;
};

/** Slugs com paleta manual validada — API só entrega logo, não tokens. */
export const FAIR_MANUAL_TOKEN_SLUGS = new Set(['buckler', 'konnen', 'boost', 'reebok', 'playfit']);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeHex(value: string | undefined, fallback: FairBrandHex): FairBrandHex {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return HEX_RE.test(withHash) ? (withHash as FairBrandHex) : fallback;
}

export function pickBrandfetchColor(
  colors: BrandfetchColor[] | undefined,
  type: BrandfetchColor['type'],
  fallback: FairBrandHex
): FairBrandHex {
  const hit = (colors ?? []).find((c) => c.type === type && c.hex);
  return normalizeHex(hit?.hex, fallback);
}

export function pickBrandfetchLogoUrl(
  logos: BrandfetchLogo[] | undefined,
  prefer: 'logo' | 'symbol' = 'logo'
): string | null {
  const list = logos ?? [];
  const rank = (entry: BrandfetchLogo): number => {
    let score = 0;
    if (entry.type === prefer) score += 40;
    else if (entry.type === 'logo') score += 30;
    else if (entry.type === 'symbol') score += 20;
    else if (entry.type === 'icon') score += 10;
    if (entry.theme === 'dark') score += 5;
    return score;
  };
  const sorted = [...list].sort((a, b) => rank(b) - rank(a));
  for (const logo of sorted) {
    const formats = [...(logo.formats ?? [])].sort((a, b) => {
      const score = (f: BrandfetchLogoFormat) =>
        (f.format === 'svg' ? 30 : f.format === 'webp' ? 20 : f.format === 'png' ? 10 : 0) +
        (f.width ?? 0) / 1000;
      return score(b) - score(a);
    });
    const src = formats.find((f) => f.src?.trim())?.src?.trim();
    if (src) return src;
  }
  return null;
}

export function mapBrandfetchToFairTokens(
  payload: BrandfetchBrandPayload,
  fallbacks: FairBrandTokens
): FairBrandTokens {
  const accent = pickBrandfetchColor(payload.colors, 'accent', fallbacks.accent);
  const dark = pickBrandfetchColor(payload.colors, 'dark', fallbacks.ink);
  const light = pickBrandfetchColor(payload.colors, 'light', fallbacks.pageBg);
  const brand = pickBrandfetchColor(payload.colors, 'brand', accent);

  const ink = dark;
  const pageBg = light;
  const logoBg = dark;
  const logoFg = contrastText(logoBg);
  const ctaBg = accent;
  const ctaFg = contrastText(ctaBg);

  return {
    headerBg: '#FFFFFF',
    headerFg: ink,
    logoBg,
    logoFg,
    pageBg,
    surface: '#FFFFFF',
    surfaceAlt: brand === accent ? fallbacks.surfaceAlt : brand,
    ink,
    muted: fallbacks.muted,
    border: fallbacks.border,
    accent,
    accentSoft: light,
    accentHover: dark,
    ctaBg,
    ctaFg,
    price: ink,
    pillFg: ink,
    focus: accent,
  };
}

export function shouldApplyApiTokens(
  slug: string,
  qualityScore: number | null | undefined
): boolean {
  if (FAIR_MANUAL_TOKEN_SLUGS.has(slug.trim().toLowerCase())) return false;
  const q = typeof qualityScore === 'number' ? qualityScore : 0;
  return q >= 0.25;
}
