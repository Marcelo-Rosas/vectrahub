import {
  fairFreightGate,
  FAIR_VEHICLE_LADDER,
  type FairFreightGateResult,
} from '@/lib/fair-freight-gate';
import { maxPbrPalletsForVehicleCode, vehicleFitsPbrPallets } from '@/lib/fair-vehicle-capacity';
import { getPlayFitMontageProfile, type PlayFitCatalogLine } from '@/lib/playfit-catalog';
import { PLAYFIT_TENANT_CONFIG } from '@/lib/playfit-tenant-config';

export type PlayFitLoadInput = {
  m2: number;
  line: PlayFitCatalogLine;
  platesPerPallet: number;
  palletQtyOverride?: number | null;
};

export type PlayFitLoadMetrics = {
  plates: number;
  pallets: number;
  weightKg: number;
  volumeM3: number;
  platesPerPallet: number;
  lineSku: string;
  weightKgPerPlate: number;
  volumeM3PerPallet: number;
};

export type PlayFitGateInput = PlayFitLoadInput;

export type PlayFitTripPlan = {
  vehicleTripCount: number;
  freightMultiplier: number;
  montageAutoUpgraded: boolean;
  effectivePlatesPerPallet: number;
  multiVehicle: boolean;
};

export type PlayFitGateResult = FairFreightGateResult & {
  load: PlayFitLoadMetrics;
  trip: PlayFitTripPlan;
};

function ceilPos(n: number): number {
  return Math.max(0, Math.ceil(n));
}

/** Peso = placas × kg/placa da linha (não kg/m² genérico). */
export function playfitLoadMetrics(input: PlayFitLoadInput): PlayFitLoadMetrics {
  const { line } = input;
  const montage = getPlayFitMontageProfile(line, input.platesPerPallet);
  const plates = ceilPos(input.m2 / line.m2PerPlate);
  const autoPallets = ceilPos(plates / montage.platesPerPallet);
  const pallets =
    input.palletQtyOverride != null && input.palletQtyOverride > 0
      ? Math.floor(input.palletQtyOverride)
      : autoPallets;
  const weightKg = plates * line.weightKgPerPlate;
  const volumeM3 = pallets * montage.volumeM3PerPallet;
  return {
    plates,
    pallets,
    weightKg,
    volumeM3,
    platesPerPallet: montage.platesPerPallet,
    lineSku: line.sku,
    weightKgPerPlate: line.weightKgPerPlate,
    volumeM3PerPallet: montage.volumeM3PerPallet,
  };
}

function ladderEntryToSuggested(
  entry: (typeof FAIR_VEHICLE_LADDER)[number]
): FairFreightGateResult['suggestedVehicle'] {
  return {
    code: entry.code,
    name: entry.name,
    axesCount: entry.axesCount,
    capacityKg: entry.capacityKg,
    pbtHint: entry.pbtHint,
  };
}

const RODOTREM_ENTRY = FAIR_VEHICLE_LADDER.find((v) => v.code === 'RODOTREM')!;

export function suggestPlayFitVehicle(
  billableWeightKg: number,
  pallets: number
): FairFreightGateResult['suggestedVehicle'] {
  const match = FAIR_VEHICLE_LADDER.find(
    (v) => v.capacityKg >= billableWeightKg && vehicleFitsPbrPallets(v.code, pallets)
  );
  return match ? ladderEntryToSuggested(match) : null;
}

function perTripFitsRodotrem(
  billableWeightKg: number,
  pallets: number,
  tripCount: number
): boolean {
  const perTripWeight = billableWeightKg / tripCount;
  const perTripPallets = Math.ceil(pallets / tripCount);
  return (
    RODOTREM_ENTRY.capacityKg >= perTripWeight && vehicleFitsPbrPallets('RODOTREM', perTripPallets)
  );
}

function resolveMultiVehicleTripCount(billableWeightKg: number, pallets: number): number {
  const rodotremPallets = maxPbrPalletsForVehicleCode('RODOTREM') ?? 50;
  const byPallets = Math.ceil(pallets / rodotremPallets);
  const byWeight = Math.ceil(billableWeightKg / RODOTREM_ENTRY.capacityKg);
  return Math.max(2, byPallets, byWeight);
}

export function playfitFreightGate(input: PlayFitGateInput): PlayFitGateResult {
  const maxMontage = input.line.maxPlatesPerPallet;
  const canAutoMontage = input.palletQtyOverride == null && input.platesPerPallet < maxMontage;

  let effectivePlates = input.platesPerPallet;
  let load = playfitLoadMetrics({ ...input, platesPerPallet: effectivePlates });
  let base = fairFreightGate({
    weightKg: load.weightKg,
    volumeM3: load.volumeM3,
    cubageFactor: PLAYFIT_TENANT_CONFIG.cubageFactor,
    manualMode: 'auto',
  });

  let montageAutoUpgraded = false;
  let suggestedVehicle: FairFreightGateResult['suggestedVehicle'] = null;
  let vehicleTripCount = 1;
  let multiVehicle = false;

  const alerts = [...base.alerts];

  if (base.mode === 'dedicado') {
    suggestedVehicle = suggestPlayFitVehicle(base.billableWeightKg, load.pallets);

    if (!suggestedVehicle && canAutoMontage) {
      effectivePlates = maxMontage;
      montageAutoUpgraded = true;
      load = playfitLoadMetrics({ ...input, platesPerPallet: effectivePlates });
      base = fairFreightGate({
        weightKg: load.weightKg,
        volumeM3: load.volumeM3,
        cubageFactor: PLAYFIT_TENANT_CONFIG.cubageFactor,
        manualMode: 'auto',
      });
      alerts.length = 0;
      alerts.push(...base.alerts);
      suggestedVehicle = suggestPlayFitVehicle(base.billableWeightKg, load.pallets);
    }

    if (!suggestedVehicle) {
      vehicleTripCount = resolveMultiVehicleTripCount(base.billableWeightKg, load.pallets);
      multiVehicle = true;
      suggestedVehicle = ladderEntryToSuggested(RODOTREM_ENTRY);

      if (perTripFitsRodotrem(base.billableWeightKg, load.pallets, vehicleTripCount)) {
        alerts.push({
          level: 'warning',
          code: 'playfit_multi_vehicle',
          message: `Carga excede 1 viagem — sugerido ${vehicleTripCount}× ${RODOTREM_ENTRY.name} (frete ×${vehicleTripCount}).`,
        });
      } else {
        alerts.push({
          level: 'warning',
          code: 'playfit_multi_vehicle_overflow',
          message: `Mesmo com ${vehicleTripCount}× ${RODOTREM_ENTRY.name}, carga excede capacidade PBR/peso — revisar com operacional.`,
        });
      }
    }

    if (montageAutoUpgraded) {
      alerts.push({
        level: 'info',
        code: 'playfit_montage_auto_max',
        message: `Montagem ajustada para ${effectivePlates} placas/pallet (máx. linha ${input.line.lineCode} mm).`,
      });
    }
  }

  const trip: PlayFitTripPlan = {
    vehicleTripCount,
    freightMultiplier: vehicleTripCount,
    montageAutoUpgraded,
    effectivePlatesPerPallet: effectivePlates,
    multiVehicle,
  };

  return { ...base, suggestedVehicle, alerts, load, trip };
}

export function playfitFreightCalcSlice(gate: PlayFitGateResult): {
  weightKg: number;
  volumeM3: number;
  freightMultiplier: number;
} {
  const trips = gate.trip.vehicleTripCount;
  return {
    weightKg: gate.billableWeightKg / trips,
    volumeM3: gate.load.volumeM3 / trips,
    freightMultiplier: gate.trip.freightMultiplier,
  };
}
