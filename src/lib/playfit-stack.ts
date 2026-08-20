/** Empilhamento PlayFit sobre pallet PBR (1,00 × 1,20 m). */

export const PBR_FOOTPRINT_M = { length: 1.0, width: 1.2 } as const;

/** Altura madeira pallet PBR — padrão operacional 150 mm. */
export const PBR_BASE_HEIGHT_MM = 150;

/** Teto empilhamento carga (placas + base) — 2,00 m baú/pátio. */
export const MAX_CARGO_HEIGHT_MM = 2000;

export const PLAYFIT_MONTAGE_TIERS = [50, 60, 70, 80] as const;

/** Altura só das placas empilhadas (mm). */
export function playfitStackHeightMm(plates: number, thicknessMm: number): number {
  return Math.max(0, plates) * thicknessMm;
}

/** Placas + base PBR (mm). Ex.: 80×16 mm → 1.280 + 150 = 1.430 mm. */
export function playfitTotalPalletHeightMm(
  plates: number,
  thicknessMm: number,
  baseMm = PBR_BASE_HEIGHT_MM
): number {
  return playfitStackHeightMm(plates, thicknessMm) + baseMm;
}

/** m³ pallet = 1,0 × 1,2 × altura total. Ex.: 80 placas 16 mm → ≈ 1,716 m³. */
export function playfitPalletVolumeM3(
  plates: number,
  thicknessMm: number,
  baseMm = PBR_BASE_HEIGHT_MM
): number {
  const heightM = playfitTotalPalletHeightMm(plates, thicknessMm, baseMm) / 1000;
  return PBR_FOOTPRINT_M.length * PBR_FOOTPRINT_M.width * heightM;
}

/** Máximo placas empilháveis dentro do teto operacional. */
export function playfitMaxPlatesForThickness(
  thicknessMm: number,
  baseMm = PBR_BASE_HEIGHT_MM,
  maxTotalMm = MAX_CARGO_HEIGHT_MM
): number {
  if (thicknessMm <= 0) return 0;
  return Math.floor((maxTotalMm - baseMm) / thicknessMm);
}

/** Badges montagem válidos por espessura (40 mm → [20,30,40]). */
export function playfitMontageOptionsForThickness(thicknessMm: number): number[] {
  const cap = playfitMaxPlatesForThickness(thicknessMm);
  const fromTiers = PLAYFIT_MONTAGE_TIERS.filter((n) => n <= cap);
  if (fromTiers.length > 0) return [...fromTiers];
  const thickTiers = [20, 30, 40].filter((n) => n <= cap);
  if (thickTiers.length > 0) return thickTiers;
  return cap > 0 ? [cap] : [1];
}

export function playfitDefaultMontage(thicknessMm: number): number {
  const opts = playfitMontageOptionsForThickness(thicknessMm);
  return opts[opts.length - 1] ?? 80;
}
