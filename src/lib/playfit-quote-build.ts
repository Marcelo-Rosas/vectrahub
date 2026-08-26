import type { PlayFitLoadMetrics } from '@/lib/playfit-pallet-gate';
import type { PlayFitCatalogLine } from '@/lib/playfit-catalog';

export type PlayFitQuoteSource = 'simples' | 'catalogo';

export type PlayFitQuoteBreakdown = {
  m2: number;
  palletQty: number;
  platesPerPallet: number;
  branchId: string;
  source: PlayFitQuoteSource;
  sku: string;
  lineSku: string;
  lineCode: string;
  colorId?: string | null;
  plates: number;
  weightKgPerPlate: number;
  geometryLabel: string;
  typicalUse: string;
};

export function buildPlayfitQuotePayload(input: {
  source: PlayFitQuoteSource;
  m2: number;
  branchId: string;
  line: PlayFitCatalogLine;
  platesPerPallet: number;
  load: PlayFitLoadMetrics;
  colorId?: string | null;
}) {
  const quantity = input.source === 'simples' ? input.m2 : input.load.pallets;
  return {
    lines: [
      {
        sku: input.line.sku,
        quantity,
        selectedBoxTypes: [String(input.platesPerPallet)],
      },
    ],
    boxesCount: input.load.pallets,
    playfitBreakdown: {
      m2: input.m2,
      palletQty: input.load.pallets,
      platesPerPallet: input.platesPerPallet,
      branchId: input.branchId,
      source: input.source,
      sku: input.line.sku,
      lineSku: input.line.sku,
      lineCode: input.line.lineCode,
      colorId: input.colorId ?? null,
      plates: input.load.plates,
      weightKgPerPlate: input.line.weightKgPerPlate,
      geometryLabel: input.line.geometryLabel,
      typicalUse: input.line.typicalUse,
    } satisfies PlayFitQuoteBreakdown,
  };
}
