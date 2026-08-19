import { useEffect } from 'react';
import { applyFairThemeToElement, type FairBrandPalette } from '@/lib/fair-brand-palettes';

/** --fair-* no documentElement só com paleta do tenant logado. Auth genérico não chama. */
export function useFairDocumentTheme(palette: FairBrandPalette | null): void {
  useEffect(() => {
    if (!palette) return;
    return applyFairThemeToElement(document.documentElement, palette);
  }, [palette]);
}
