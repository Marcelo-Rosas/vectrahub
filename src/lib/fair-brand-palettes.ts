import type { CSSProperties } from 'react';

/** Paletas /feira por embarcador. Seed estático — sem Brand API no browser. */

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

export type FairBrandfetchSeed = {
  accent: FairBrandHex;
  dark: FairBrandHex;
  light: FairBrandHex;
  quality: number;
};

export type FairBrandPalette = {
  slug: 'buckler' | 'konnen' | 'boost' | 'reebok';
  name: string;
  domain: string;
  site: string;
  notes: string;
  brandfetch: FairBrandfetchSeed;
  tokens: FairBrandTokens;
};

const TOKEN_CSS: Record<keyof FairBrandTokens, string> = {
  headerBg: '--fair-header-bg',
  headerFg: '--fair-header-fg',
  logoBg: '--fair-logo-bg',
  logoFg: '--fair-logo-fg',
  pageBg: '--fair-page-bg',
  surface: '--fair-surface',
  surfaceAlt: '--fair-surface-alt',
  ink: '--fair-ink',
  muted: '--fair-muted',
  border: '--fair-border',
  accent: '--fair-accent',
  accentSoft: '--fair-accent-soft',
  accentHover: '--fair-accent-hover',
  ctaBg: '--fair-cta-bg',
  ctaFg: '--fair-cta-fg',
  price: '--fair-price',
  pillFg: '--fair-pill-fg',
  focus: '--fair-focus',
};

export const FAIR_BRAND_TOKEN_ROWS: ReadonlyArray<{
  key: keyof FairBrandTokens;
  cssVar: string;
  usage: string;
}> = (
  [
    ['headerBg', 'Barra do header'],
    ['headerFg', 'Texto do header'],
    ['logoBg', 'Pílula do logo'],
    ['logoFg', 'Wordmark / vetor do logo'],
    ['pageBg', 'Fundo da página'],
    ['surface', 'Card / campo'],
    ['surfaceAlt', 'Faixa zebra / kit'],
    ['ink', 'Título e texto principal'],
    ['muted', 'Texto secundário'],
    ['border', 'Borda de card'],
    ['accent', 'Marca (destaque)'],
    ['accentSoft', 'Pílula / chip'],
    ['accentHover', 'Hover do CTA'],
    ['ctaBg', 'Botão Salvar / Emitir'],
    ['ctaFg', 'Texto do CTA (contraste)'],
    ['price', 'Total R$'],
    ['pillFg', 'Texto do chip'],
    ['focus', 'Anel de foco'],
  ] as const
).map(([key, usage]) => ({ key, cssVar: TOKEN_CSS[key], usage }));

/** Buckler: beige no preto. Brand API timeout frequente — hex do SVG oficial + site. */
export const BUCKLER_FAIR_PALETTE: FairBrandPalette = {
  slug: 'buckler',
  name: 'Buckler Fit',
  domain: 'bucklerfit.com.br',
  site: 'https://www.bucklerfit.com.br/',
  notes: 'Wordmark #CDC2B1 no SVG. Header preto, não navy Vectra #0B1D3A.',
  brandfetch: { accent: '#CDC2B1', dark: '#010101', light: '#E2DDDA', quality: 0.23 },
  tokens: {
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

/** Konnen: amarelo do CSS do site (`#FFD600`) + preto. Brand API #ffd500 quase igual. */
export const KONNEN_FAIR_PALETTE: FairBrandPalette = {
  slug: 'konnen',
  name: 'Konnen Fitness',
  domain: 'konnenfitness.com.br',
  site: 'https://www.konnenfitness.com.br/',
  notes:
    'Pedir orçamento no site = fundo #FFD600 texto #000. Hover amarelo #CCAB00. Não usar verde Brand API antigo.',
  brandfetch: { accent: '#FFD500', dark: '#000000', light: '#FBFBFC', quality: 0.46 },
  tokens: {
    headerBg: '#FFFFFF',
    headerFg: '#000000',
    logoBg: '#000000',
    logoFg: '#FFD600',
    pageBg: '#F5F5F5',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF8CC',
    ink: '#202020',
    muted: '#555555',
    border: '#FFD600',
    accent: '#FFD600',
    accentSoft: '#FFF4C2',
    accentHover: '#CCAB00',
    ctaBg: '#FFD600',
    ctaFg: '#000000',
    price: '#000000',
    pillFg: '#000000',
    focus: '#FFD600',
  },
};

/** Boost Equipment: azul #486FD9. Navy #043C6C só no rodapé do site. */
export const BOOST_FAIR_PALETTE: FairBrandPalette = {
  slug: 'boost',
  name: 'Boost Equipment',
  domain: 'boostequipment.com.br',
  site: 'https://boostequipment.com.br/',
  notes: 'Logo branco no preto. CTA azul. Não usar laranja de boostfitness.com.br (outra marca).',
  brandfetch: { accent: '#486FD9', dark: '#000000', light: '#FFFFFF', quality: 0.33 },
  tokens: {
    headerBg: '#FFFFFF',
    headerFg: '#000000',
    logoBg: '#000000',
    logoFg: '#FFFFFF',
    pageBg: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceAlt: '#DCE4F8',
    ink: '#000000',
    muted: '#5B6B7F',
    border: '#C5D2F5',
    accent: '#486FD9',
    accentSoft: '#DCE4F8',
    accentHover: '#043C6C',
    ctaBg: '#486FD9',
    ctaFg: '#FFFFFF',
    price: '#486FD9',
    pillFg: '#486FD9',
    focus: '#486FD9',
  },
};

/**
 * Reebok Fitness (RFE / reebokfitness.info) — equipamento, não apparel reebok.com.
 * Brand API dark/light veio de foto (#525150 / #FBCFBB). Site Wix é preto + branco + vetor #FF1714.
 * Pêssego e carvão viram chip/muted, não header.
 */
export const REEBOK_FAIR_PALETTE: FairBrandPalette = {
  slug: 'reebok',
  name: 'Reebok Fitness',
  domain: 'reebokfitness.info',
  site: 'https://www.reebokfitness.info/',
  notes: 'Header preto + vetor vermelho. Pêssego Brand API só em chip. Carvão só em muted.',
  brandfetch: { accent: '#FF1714', dark: '#525150', light: '#FBCFBB', quality: 0.46 },
  tokens: {
    headerBg: '#FFFFFF',
    headerFg: '#111111',
    logoBg: '#000000',
    logoFg: '#FF1714',
    pageBg: '#F7F6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#F8E4D8',
    ink: '#111111',
    muted: '#525150',
    border: '#E8C8B8',
    accent: '#FF1714',
    accentSoft: '#FBCFBB',
    accentHover: '#C4100E',
    ctaBg: '#FF1714',
    ctaFg: '#FFFFFF',
    price: '#FF1714',
    pillFg: '#7A2A1C',
    focus: '#FF1714',
  },
};

export const FAIR_BRAND_PALETTES: readonly FairBrandPalette[] = [
  BUCKLER_FAIR_PALETTE,
  KONNEN_FAIR_PALETTE,
  BOOST_FAIR_PALETTE,
  REEBOK_FAIR_PALETTE,
];

const BY_SLUG: Record<FairBrandPalette['slug'], FairBrandPalette> = {
  buckler: BUCKLER_FAIR_PALETTE,
  konnen: KONNEN_FAIR_PALETTE,
  boost: BOOST_FAIR_PALETTE,
  reebok: REEBOK_FAIR_PALETTE,
};

export function resolveFairPalette(slug: string | null | undefined): FairBrandPalette {
  const key = (slug ?? '').trim().toLowerCase();
  if (key === 'buckler' || key === 'konnen' || key === 'boost' || key === 'reebok') {
    return BY_SLUG[key];
  }
  return BUCKLER_FAIR_PALETTE;
}

export function fairPaletteCssVars(palette: FairBrandPalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of FAIR_BRAND_TOKEN_ROWS) {
    out[row.cssVar] = palette.tokens[row.key];
  }
  return out;
}

export function fairPaletteStyle(palette: FairBrandPalette): CSSProperties {
  return fairPaletteCssVars(palette) as CSSProperties;
}

/** Classes em `src/index.css` — CTA / total / chips no /feira. */
export const FAIR_UI = {
  ink: 'fair-ink',
  accent: 'fair-accent',
  price: 'fair-price',
  cta: 'fair-cta',
  toggleOff: 'fair-toggle-off',
  chip: 'fair-chip',
  softPanel: 'fair-soft-panel',
  mark: 'fair-mark',
  check: 'fair-check',
  stats: 'fair-stats',
  resultCard: 'fair-result-card',
} as const;

type ThemeStyleTarget = {
  style: {
    setProperty: (key: string, value: string) => void;
    removeProperty: (key: string) => void;
  };
};

/** Aplica --fair-* no elemento (html = Sheet portal herda). Cleanup remove. */
export function applyFairThemeToElement(
  el: ThemeStyleTarget,
  palette: FairBrandPalette
): () => void {
  const vars = fairPaletteCssVars(palette);
  const keys = Object.keys(vars);
  for (const key of keys) el.style.setProperty(key, vars[key]!);
  return () => {
    for (const key of keys) el.style.removeProperty(key);
  };
}

/** WCAG relative luminance 0–1. */
export function relativeLuminance(hex: string): number {
  const n = hex.replace('#', '');
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
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastText(bg: string): '#000000' | '#FFFFFF' {
  return relativeLuminance(bg) > 0.4 ? '#000000' : '#FFFFFF';
}
