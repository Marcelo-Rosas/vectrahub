import {
  playfitDefaultMontage,
  playfitMontageOptionsForThickness,
  playfitPalletVolumeM3,
  PBR_BASE_HEIGHT_MM,
} from '@/lib/playfit-stack';

export type PlayFitColor = {
  id: string;
  label: string;
  hex: string;
};

export type PlayFitMontageProfile = {
  platesPerPallet: number;
  volumeM3PerPallet: number;
  stackHeightMm: number;
  weightKgPerPallet: number;
};

export type PlayFitCatalogLine = {
  sku: string;
  name: string;
  lineCode: string;
  typicalUse: string;
  geometryLabel: string;
  plateLengthMm: number;
  plateWidthMm: number;
  plateThicknessMm: number;
  m2PerPlate: number;
  weightKgPerPlate: number;
  colors: PlayFitColor[];
  montageOptions: number[];
  defaultMontage: number;
  montageProfiles: PlayFitMontageProfile[];
  maxPlatesPerPallet: number;
};

export type PlayFitCatalogRow = {
  sku: string;
  name: string;
  line_code: string | null;
  typical_use: string | null;
  geometry_label: string | null;
  plate_length_mm: number | null;
  plate_width_mm: number | null;
  plate_thickness_mm: number | null;
  m2_per_plate: number | null;
  weight_kg_per_plate: number | null;
  colors: PlayFitColor[] | null;
  product_boxes?: Array<{
    box_type: string;
    plates_per_pallet: number | null;
    stack_height_mm: number | null;
    pbr_base_height_mm: number | null;
    volume_m3: number;
    group_weight_kg: number;
  }> | null;
};

export function mapPlayFitCatalogLine(row: PlayFitCatalogRow): PlayFitCatalogLine {
  const thickness = Number(row.plate_thickness_mm) || 16;
  const weightPerPlate = Number(row.weight_kg_per_plate) || 0;
  const m2PerPlate = Number(row.m2_per_plate) || 1;
  const boxes = row.product_boxes ?? [];

  const montageProfiles: PlayFitMontageProfile[] = boxes
    .map((b) => {
      const plates = Number(b.plates_per_pallet ?? b.box_type) || 0;
      if (plates <= 0) return null;
      const baseMm = Number(b.pbr_base_height_mm) || PBR_BASE_HEIGHT_MM;
      return {
        platesPerPallet: plates,
        volumeM3PerPallet: Number(b.volume_m3) || playfitPalletVolumeM3(plates, thickness, baseMm),
        stackHeightMm: Number(b.stack_height_mm) || plates * thickness,
        weightKgPerPallet: Number(b.group_weight_kg) || plates * weightPerPlate,
      };
    })
    .filter((p): p is PlayFitMontageProfile => p != null)
    .sort((a, b) => a.platesPerPallet - b.platesPerPallet);

  const montageOptions =
    montageProfiles.length > 0
      ? montageProfiles.map((p) => p.platesPerPallet)
      : playfitMontageOptionsForThickness(thickness);

  const defaultMontage =
    montageOptions[montageOptions.length - 1] ?? playfitDefaultMontage(thickness);

  return {
    sku: row.sku,
    name: row.name,
    lineCode: row.line_code ?? row.sku,
    typicalUse: row.typical_use ?? '',
    geometryLabel: row.geometry_label ?? '',
    plateLengthMm: Number(row.plate_length_mm) || 1000,
    plateWidthMm: Number(row.plate_width_mm) || 1000,
    plateThicknessMm: thickness,
    m2PerPlate,
    weightKgPerPlate: weightPerPlate,
    colors: Array.isArray(row.colors) ? row.colors : [],
    montageOptions,
    defaultMontage,
    montageProfiles,
    maxPlatesPerPallet: montageOptions[montageOptions.length - 1] ?? defaultMontage,
  };
}

export function getPlayFitMontageProfile(
  line: PlayFitCatalogLine,
  platesPerPallet: number
): PlayFitMontageProfile {
  const hit = line.montageProfiles.find((p) => p.platesPerPallet === platesPerPallet);
  if (hit) return hit;
  return {
    platesPerPallet,
    volumeM3PerPallet: playfitPalletVolumeM3(platesPerPallet, line.plateThicknessMm),
    stackHeightMm: platesPerPallet * line.plateThicknessMm,
    weightKgPerPallet: platesPerPallet * line.weightKgPerPlate,
  };
}

export function parsePlayFitCatalog(rows: PlayFitCatalogRow[]): PlayFitCatalogLine[] {
  return rows
    .filter((r) => r.sku.startsWith('PLAYFIT-'))
    .map(mapPlayFitCatalogLine)
    .sort((a, b) => a.plateThicknessMm - b.plateThicknessMm);
}
