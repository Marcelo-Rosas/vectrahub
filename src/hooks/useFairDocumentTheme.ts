import { useEffect } from 'react';
import { applyFairThemeToElement, type FairBrandPalette } from '@/lib/fair-brand-palettes';

/** --fair-* no documentElement enquanto /feira cotação montada. Sheet herda. */
export function useFairDocumentTheme(palette: FairBrandPalette): void {
  useEffect(() => applyFairThemeToElement(document.documentElement, palette), [palette]);
}
