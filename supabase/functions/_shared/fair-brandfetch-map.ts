/** Brandfetch Brand API → tokens /feira (Edge). */

export type FairBrandHex = `#${string}`;

export type FairBrandTokens = {
  headerBg: FairBrandHex;
  headerFg: FairBrandHex;
  logoBg: FairBrandHex;
  logoFg: FairBrandHex;
  pageBg: FairBrandHex;
  surface: FairBrandHex;
  surfaceAlt: FairBrandHex;
  ink: FairBrandHex;
  muted: FairBrandHex;
  border: FairBrandHex;
  accent: FairBrandHex;
  accentSoft: FairBrandHex;
  accentHover: FairBrandHex;
  ctaBg: FairBrandHex;
  ctaFg: FairBrandHex;
  price: FairBrandHex;
  pillFg: FairBrandHex;
  focus: FairBrandHex;
};

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

export const FAIR_MANUAL_TOKEN_SLUGS = new Set(['buckler', 'konnen', 'boost', 'reebok', 'playfit']);

export const FAIR_STATIC_BRAND_DOMAINS: Record<string, string> = {
  buckler: 'bucklerfit.com.br',
  konnen: 'konnenfitness.com.br',
  boost: 'boostequipment.com.br',
  reebok: 'reebokfitness.info',
  playfit: 'playfitpisos.com.br',
  rotha: 'rothafitness.com',
};

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

function contrastText(bg: string): '#000000' | '#FFFFFF' {
  const n = bg.replace('#', '');
  const full =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.4 ? '#000000' : '#FFFFFF';
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

export const FAIR_STATIC_TOKEN_FALLBACKS: Record<string, FairBrandTokens> = {
  rotha: {
    headerBg: '#FFFFFF',
    headerFg: '#0D0D0D',
    logoBg: '#0D0D0D',
    logoFg: '#FFFFFF',
    pageBg: '#F7F7F7',
    surface: '#FFFFFF',
    surfaceAlt: '#EEEEEE',
    ink: '#0D0D0D',
    muted: '#5C5C5C',
    border: '#D4D4D4',
    accent: '#E10600',
    accentSoft: '#FFD6D1',
    accentHover: '#B80500',
    ctaBg: '#E10600',
    ctaFg: '#FFFFFF',
    price: '#0D0D0D',
    pillFg: '#0D0D0D',
    focus: '#E10600',
  },
  buckler: {
    headerBg: '#FFFFFF',
    headerFg: '#010101',
    logoBg: '#010101',
    logoFg: '#CDC2B1',
    pageBg: '#F7F5F2',
    surface: '#FFFFFF',
    surfaceAlt: '#E8E2D8',
    ink: '#010101',
    muted: '#6B6560',
    border: '#CDC2B1',
    accent: '#CDC2B1',
    accentSoft: '#E8E2D8',
    accentHover: '#B5A894',
    ctaBg: '#010101',
    ctaFg: '#CDC2B1',
    price: '#010101',
    pillFg: '#010101',
    focus: '#CDC2B1',
  },
};

export function staticTokenFallback(slug: string): FairBrandTokens {
  return (
    FAIR_STATIC_TOKEN_FALLBACKS[slug] ?? {
      headerBg: '#FFFFFF',
      headerFg: '#0B1D3A',
      logoBg: '#0B1D3A',
      logoFg: '#FFFFFF',
      pageBg: '#F7F8FA',
      surface: '#FFFFFF',
      surfaceAlt: '#E8ECF2',
      ink: '#0B1D3A',
      muted: '#5B6B7F',
      border: '#D4DAE4',
      accent: '#0B1D3A',
      accentSoft: '#E8ECF2',
      accentHover: '#061224',
      ctaBg: '#0B1D3A',
      ctaFg: '#FFFFFF',
      price: '#0B1D3A',
      pillFg: '#0B1D3A',
      focus: '#0B1D3A',
    }
  );
}
