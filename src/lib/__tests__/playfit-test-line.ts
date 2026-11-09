import type { PlayFitCatalogLine } from '@/lib/playfit-catalog';
import { playfitMontageOptionsForThickness, playfitPalletVolumeM3 } from '@/lib/playfit-stack';

export function playfitTestLine(
  overrides: Partial<PlayFitCatalogLine> & { thicknessMm: number }
): PlayFitCatalogLine {
  const thickness = overrides.thicknessMm;
  const m2 = overrides.m2PerPlate ?? (overrides.plateLengthMm === 500 ? 0.25 : 1);
  const weightPlate =
    overrides.weightKgPerPlate ??
    (thickness === 40 ? 40 : thickness === 26 ? 6.5 : thickness === 13 ? 3.5 : 14);
  const montageOptions = overrides.montageOptions ?? playfitMontageOptionsForThickness(thickness);
  const defaultMontage = montageOptions[montageOptions.length - 1] ?? 80;

  const montageProfiles = montageOptions.map((plates) => ({
    platesPerPallet: plates,
    volumeM3PerPallet: playfitPalletVolumeM3(plates, thickness),
    stackHeightMm: plates * thickness,
    weightKgPerPallet: plates * weightPlate,
  }));

  return {
    sku: overrides.sku ?? `PLAYFIT-${thickness}`,
    name: overrides.name ?? `PlayFit ${thickness} mm`,
    lineCode: overrides.lineCode ?? String(thickness),
    typicalUse: overrides.typicalUse ?? 'Teste',
    geometryLabel: overrides.geometryLabel ?? (m2 === 1 ? '1 × 1 m' : '0,5 × 0,5 m'),
    plateLengthMm: overrides.plateLengthMm ?? (m2 === 1 ? 1000 : 500),
    plateWidthMm: overrides.plateWidthMm ?? (m2 === 1 ? 1000 : 500),
    plateThicknessMm: thickness,
    m2PerPlate: m2,
    weightKgPerPlate: weightPlate,
    colors: overrides.colors ?? [],
    montageOptions,
    defaultMontage,
    montageProfiles,
    maxPlatesPerPallet: overrides.maxPlatesPerPallet ?? defaultMontage,
  };
}
