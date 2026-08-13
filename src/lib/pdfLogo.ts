/** Logo Vectra para PDFs (browser Vite + Node/tsx smoke). */

export type PdfLogo = { dataUrl: string; format: 'JPEG' | 'PNG' };

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === 'undefined') {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function fetchAsLogo(url: string, format: 'JPEG' | 'PNG'): Promise<PdfLogo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl) return null;
    return { dataUrl, format };
  } catch {
    return null;
  }
}

async function loadLogoFromDisk(): Promise<PdfLogo | null> {
  try {
    const { existsSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const candidates: [string, 'JPEG' | 'PNG'][] = [
      ['src/assets/logo_vectra_cargo.jpg', 'JPEG'],
      ['public/brand/logo_vectra.jpg', 'JPEG'],
      ['public/brand/logo_vectra_cargo.png', 'PNG'],
      ['public/brand/logo_vectra_focus_200.png', 'PNG'],
    ];
    for (const [rel, format] of candidates) {
      const abs = join(process.cwd(), rel);
      if (!existsSync(abs)) continue;
      const buf = readFileSync(abs);
      const mime = format === 'JPEG' ? 'image/jpeg' : 'image/png';
      return { dataUrl: `data:${mime};base64,${buf.toString('base64')}`, format };
    }
  } catch {
    /* not Node or missing fs */
  }
  return null;
}

/**
 * Ordem: asset Vite → /public/brand → disco (smoke Node).
 */
export async function loadVectraPdfLogo(): Promise<PdfLogo | null> {
  try {
    const mod = (await import('@/assets/logo_vectra_cargo.jpg?url')) as { default?: string };
    if (mod.default) {
      const fromVite = await fetchAsLogo(mod.default, 'JPEG');
      if (fromVite) return fromVite;
    }
  } catch {
    /* Node / asset ausente */
  }

  for (const [path, format] of [
    ['/brand/logo_vectra.jpg', 'JPEG'],
    ['/brand/logo_vectra_cargo.png', 'PNG'],
    ['/brand/logo_vectra_focus_200.png', 'PNG'],
  ] as const) {
    const logo = await fetchAsLogo(path, format);
    if (logo) return logo;
  }

  return loadLogoFromDisk();
}
