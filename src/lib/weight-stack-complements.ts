/**
 * Complemento de baterias de peso (weight stack) para SKUs selectorized Konnen.
 * Dados extraídos da planilha packing (P.COMPLETO / filhas -BAT-*).
 */

import { boxVolumeM3 } from '@/lib/shipper-product-catalog';

export type WeightStackBoxComplement = {
  boxType: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  groupWeightKg: number;
  /** CBM real da caixa (medidas_data); quando ausente, derivado das dimensões. */
  volumeM3?: number;
};

export type WeightStackComplement = {
  sku: string;
  weightStackSku: string | null;
  weightKgWithStack: number;
  volumeM3WithStack: number;
  boxesTotalWithStack: number;
  boxes: WeightStackBoxComplement[];
};

export function weightStackBoxVolumeM3(box: WeightStackBoxComplement): number {
  return box.volumeM3 ?? boxVolumeM3(box.lengthMm, box.widthMm, box.heightMm, 1);
}

export function sumWeightStackBoxesKg(boxes: WeightStackBoxComplement[]): number {
  return boxes.reduce((sum, b) => sum + b.groupWeightKg, 0);
}

export function sumWeightStackBoxesVolumeM3(boxes: WeightStackBoxComplement[]): number {
  return boxes.reduce((sum, b) => sum + weightStackBoxVolumeM3(b), 0);
}

/** Valida complemento: soma BAT ≈ delta frame→completo. */
export function validateWeightStackComplement(
  complement: WeightStackComplement,
  frameWeightKg: number,
  frameVolumeM3: number,
  toleranceKg = 0.5,
  toleranceVol = 0.02
): { ok: boolean; deltaWeightKg: number; deltaVolumeM3: number } {
  const deltaWeightKg = complement.weightKgWithStack - frameWeightKg;
  const deltaVolumeM3 = complement.volumeM3WithStack - frameVolumeM3;
  const sumBatKg = sumWeightStackBoxesKg(complement.boxes);
  const sumBatVol = sumWeightStackBoxesVolumeM3(complement.boxes);
  const ok =
    Math.abs(deltaWeightKg - sumBatKg) <= toleranceKg &&
    Math.abs(deltaVolumeM3 - sumBatVol) <= toleranceVol;
  return { ok, deltaWeightKg, deltaVolumeM3 };
}
