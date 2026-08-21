/** Brandfetch Brand API → tokens /feira. Sem HTTP aqui. */

import type { FairBrandHex, FairBrandTokens } from '@/lib/fair-brand-palettes';
import { contrastText, relativeLuminance } from '@/lib/fair-brand-palettes';

export type BrandfetchLogoBackground = 'transparent' | 'white' | 'black' | string;

export type BrandfetchColor = {
  hex?: string;
  type?: 'accent' | 'dark' | 'light' | 'brand';
  brightness?: number;
};

export type BrandfetchLogoFormat = {
  src?: string;
  format?: 'svg' | 'png' | 'jpeg' | 'webp' | string;
  width?: number;
  height?: number;
  background?: BrandfetchLogoBackground;
};

export type BrandfetchLogo = {
  theme?: 'light' | 'dark';
  type?: 'logo' | 'symbol' | 'icon' | 'other';
  formats?: BrandfetchLogoFormat[];
};

export type BrandfetchBrandPayload = {
  name?: string | null;
  domain?: string;
  logos?: BrandfetchLogo[];
  colors?: BrandfetchColor[];
  qualityScore?: number | null;
};

/** Abaixo disso: domínio genérico / marca fraca — não usar PNG da API. */
export const BRAND_QUALITY_MIN = 0.3;

export function isUsableBrandQuality(score: number | null | undefined): boolean {
  return typeof score === 'number' && score >= BRAND_QUALITY_MIN;
}

export function pickPrimaryHex(colors: BrandfetchColor[] | undefined): string | null {
  const list = colors ?? [];
  const byType =
    list.find((c) => c.type === 'accent' && c.hex) ??
    list.find((c) => c.type === 'brand' && c.hex) ??
    list.find((c) => c.hex);
  const hex = byType?.hex?.trim();
  return hex ? (hex.startsWith('#') ? hex : `#${hex}`) : null;
}

export function surfaceIsDarkFromHex(hex: string): boolean {
  return relativeLuminance(hex) <= 0.4;
}

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

function assetPath(src: string | undefined): string {
  return (src ?? '').split('?')[0]?.toLowerCase() ?? '';
}

function isBrandfetchAssetHost(src: string | undefined): boolean {
  try {
    const host = new URL(src ?? '').hostname.toLowerCase();
    return host === 'cdn.brandfetch.io' || host === 'asset.brandfetch.io';
  } catch {
    return false;
  }
}

function isSvgAsset(f: BrandfetchLogoFormat): boolean {
  const fmt = (f.format ?? '').toLowerCase();
  if (fmt === 'svg') return true;
  return assetPath(f.src).endsWith('.svg');
}

/** PNG/WebP/JPEG do parceiro. CDN Brandfetch sem extensão conta como raster. */
function isRasterAsset(f: BrandfetchLogoFormat): boolean {
  if (!f.src?.trim() || isSvgAsset(f)) return false;
  const fmt = (f.format ?? '').toLowerCase();
  if (fmt === 'png' || fmt === 'jpeg' || fmt === 'jpg' || fmt === 'webp') return true;
  const path = assetPath(f.src);
  if (
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.jpeg') ||
    path.endsWith('.webp')
  ) {
    return true;
  }
  return isBrandfetchAssetHost(f.src);
}

function formatRank(f: BrandfetchLogoFormat): number {
  const fmt = (f.format ?? '').toLowerCase();
  const path = assetPath(f.src);
  const isPng = fmt === 'png' || path.endsWith('.png');
  const isWebp = fmt === 'webp' || path.endsWith('.webp');
  const isJpeg = fmt === 'jpeg' || fmt === 'jpg' || path.endsWith('.jpg') || path.endsWith('.jpeg');
  const bg = (f.background ?? '').toLowerCase();
  return (
    (bg === 'transparent' ? 50 : bg === 'white' || bg === 'black' ? -20 : 0) +
    (isPng ? 40 : isWebp ? 20 : isJpeg ? 15 : 0) +
    (f.width ?? 0) / 1000
  );
}

function isHeaderWordmark(entry: BrandfetchLogo, prefer: 'logo' | 'symbol'): boolean {
  if (prefer === 'symbol') return entry.type === 'symbol' || entry.type === 'icon';
  if (entry.type === 'icon' || entry.type === 'symbol') return false;
  const dims = (entry.formats ?? []).find((f) => (f.width ?? 0) > 0 && (f.height ?? 0) > 0);
  if (!dims?.width || !dims.height) return entry.type === 'logo' || !entry.type;
  return dims.width / dims.height >= 1.5;
}

export function pickBrandfetchLogoUrl(
  logos: BrandfetchLogo[] | undefined,
  opts: { prefer: 'logo' | 'symbol'; surfaceIsDark: boolean }
): string | null {
  const wantTheme = opts.surfaceIsDark ? 'dark' : 'light';
  const ranked = [...(logos ?? [])]
    .filter((l) => isHeaderWordmark(l, opts.prefer))
    .sort((a, b) => {
      const themeScore = (l: BrandfetchLogo) => (l.theme === wantTheme ? 20 : l.theme ? 0 : 8);
      const typeScore = (l: BrandfetchLogo) =>
        l.type === opts.prefer ? 40 : l.type === 'logo' ? 30 : l.type === 'symbol' ? 20 : 10;
      return typeScore(b) + themeScore(b) - (typeScore(a) + themeScore(a));
    });
  for (const logo of ranked) {
    const raster = [...(logo.formats ?? [])]
      .filter(isRasterAsset)
      .sort((a, b) => formatRank(b) - formatRank(a));
    const png = raster.find((f) => f.src?.trim())?.src?.trim();
    if (png) return png;
  }
  for (const logo of ranked) {
    const anyFmt = [...(logo.formats ?? [])]
      .filter((f) => f.src?.trim())
      .sort((a, b) => formatRank(b) - formatRank(a));
    const src = anyFmt.find((f) => f.src?.trim())?.src?.trim();
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
  return isUsableBrandQuality(qualityScore);
}
