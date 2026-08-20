/** Gate Feira: lotação dedicada vs fracionado NTC por peso faturável. */

export type FairFreightManualMode = 'auto' | 'dedicado' | 'fracionado';

export type FairFreightGateAlert = {
  level: 'info' | 'warning';
  code: string;
  message: string;
};

export type FairSuggestedVehicle = {
  code: string;
  name: string;
  axesCount: number;
  capacityKg: number;
  pbtHint?: string;
};

export type FairFreightGateInput = {
  weightKg: number;
  volumeM3: number;
  cubageFactor?: number;
  unmatchedSkuCount?: number;
  parsedLineCount?: number;
  manualMode?: FairFreightManualMode;
};

export type FairFreightGateResult = {
  billableWeightKg: number;
  cubageWeightKg: number;
  mode: 'dedicado' | 'fracionado';
  modeSource: 'auto' | 'manual';
  hubModality: 'lotacao' | 'fracionado';
  hubMethodology: 'lotacao' | 'fracionado_ntc';
  freightTypeLabel: 'Dedicado' | 'Fracionado';
  suggestedVehicle: FairSuggestedVehicle | null;
  alerts: FairFreightGateAlert[];
  coverageIncomplete: boolean;
};

export const FAIR_DEDICADO_THRESHOLD_KG = 3000;
export const FAIR_DEFAULT_CUBAGE_FACTOR = 300;

type VehicleLadderEntry = {
  code: string;
  name: string;
  axesCount: number;
  capacityKg: number;
  pbtHint: string;
};

/** Carga útil heurística — alinhada ao seed / antt-utils FALLBACK_VEHICLES. */
export const FAIR_VEHICLE_LADDER: VehicleLadderEntry[] = [
  { code: 'VUC', name: '3/4 (VUC)', axesCount: 2, capacityKg: 3500, pbtHint: 'PBT ~6–8 t' },
  { code: 'TOCO', name: 'Toco', axesCount: 2, capacityKg: 6000, pbtHint: 'PBT ~16 t' },
  { code: 'TRUCK', name: 'Truck', axesCount: 3, capacityKg: 14000, pbtHint: 'PBT ~23 t' },
  { code: 'BI_TRUCK', name: 'Bi-Truck', axesCount: 4, capacityKg: 18000, pbtHint: 'PBT ~29 t' },
  {
    code: 'CARRETA_3',
    name: 'Carreta',
    axesCount: 5,
    capacityKg: 25000,
    pbtHint: 'PBTC ~41,5–45 t',
  },
  {
    code: 'CARRETA_4',
    name: 'Carreta LS',
    axesCount: 6,
    capacityKg: 30000,
    pbtHint: 'PBTC ~48,5–57 t',
  },
  { code: 'RODOTREM', name: 'Rodotrem', axesCount: 9, capacityKg: 57000, pbtHint: 'PBTC ~57 t' },
];

function roundKg(n: number): number {
  return Math.round(n * 10) / 10;
}

function autoModeFromBillable(billableWeightKg: number): 'dedicado' | 'fracionado' {
  return billableWeightKg < FAIR_DEDICADO_THRESHOLD_KG ? 'fracionado' : 'dedicado';
}

export function suggestFairVehicle(billableWeightKg: number): FairSuggestedVehicle | null {
  if (!(billableWeightKg > 0)) return null;
  const match =
    FAIR_VEHICLE_LADDER.find((v) => v.capacityKg >= billableWeightKg) ??
    FAIR_VEHICLE_LADDER[FAIR_VEHICLE_LADDER.length - 1];
  return {
    code: match.code,
    name: match.name,
    axesCount: match.axesCount,
    capacityKg: match.capacityKg,
    pbtHint: match.pbtHint,
  };
}

function buildAlerts(input: {
  mode: 'dedicado' | 'fracionado';
  billableWeightKg: number;
  unmatchedSkuCount: number;
  manualMode: FairFreightManualMode;
  suggestedVehicle: FairSuggestedVehicle | null;
}): FairFreightGateAlert[] {
  const alerts: FairFreightGateAlert[] = [];

  if (input.unmatchedSkuCount > 0) {
    alerts.push({
      level: 'warning',
      code: 'coverage_incomplete',
      message: `Previsão parcial — faltam ${input.unmatchedSkuCount} SKU(s) no catálogo; peso/volume podem subestimar a carga real.`,
    });
    if (input.mode === 'dedicado') {
      alerts.push({
        level: 'info',
        code: 'dedicado_partial_coverage',
        message: 'Mesmo parcial, o peso atual já indica frete dedicado.',
      });
    }
  }

  if (input.manualMode === 'fracionado' && input.billableWeightKg >= FAIR_DEDICADO_THRESHOLD_KG) {
    alerts.push({
      level: 'warning',
      code: 'manual_fracionado_heavy',
      message:
        'Peso acima do perfil fracionado típico (< 3 t). Confira se dedicado não seria mais adequado.',
    });
  }

  if (input.manualMode === 'dedicado' && input.billableWeightKg < FAIR_DEDICADO_THRESHOLD_KG) {
    alerts.push({
      level: 'info',
      code: 'manual_dedicado_light',
      message: 'Peso abaixo de 3 t — perfil fracionado NTC costuma ser mais econômico.',
    });
  }

  const maxCapacity = FAIR_VEHICLE_LADDER[FAIR_VEHICLE_LADDER.length - 1].capacityKg;
  if (input.mode === 'dedicado' && input.billableWeightKg > maxCapacity) {
    alerts.push({
      level: 'warning',
      code: 'over_max_vehicle_capacity',
      message: `Peso faturável acima da capacidade heurística máxima (${(maxCapacity / 1000).toFixed(0)} t). Validar AET / composição.`,
    });
  }

  if (input.suggestedVehicle && input.billableWeightKg > input.suggestedVehicle.capacityKg * 0.95) {
    alerts.push({
      level: 'info',
      code: 'near_vehicle_limit',
      message: `Carga próxima do limite útil sugerido para ${input.suggestedVehicle.name}.`,
    });
  }

  return alerts;
}

export function fairFreightGate(input: FairFreightGateInput): FairFreightGateResult {
  const cubageFactor = input.cubageFactor ?? FAIR_DEFAULT_CUBAGE_FACTOR;
  const weightKg = Math.max(0, Number(input.weightKg) || 0);
  const volumeM3 = Math.max(0, Number(input.volumeM3) || 0);
  const cubageWeightKg = roundKg(volumeM3 * cubageFactor);
  const billableWeightKg = roundKg(Math.max(weightKg, cubageWeightKg));

  const manualMode = input.manualMode ?? 'auto';
  const autoMode = autoModeFromBillable(billableWeightKg);
  const mode =
    manualMode === 'auto' ? autoMode : manualMode === 'dedicado' ? 'dedicado' : 'fracionado';
  const modeSource: 'auto' | 'manual' = manualMode === 'auto' ? 'auto' : 'manual';

  const hubModality = mode === 'dedicado' ? 'lotacao' : 'fracionado';
  const hubMethodology = mode === 'dedicado' ? 'lotacao' : 'fracionado_ntc';
  const freightTypeLabel = mode === 'dedicado' ? 'Dedicado' : 'Fracionado';

  const suggestedVehicle = mode === 'dedicado' ? suggestFairVehicle(billableWeightKg) : null;
  const unmatchedSkuCount = Math.max(0, Number(input.unmatchedSkuCount) || 0);

  const alerts = buildAlerts({
    mode,
    billableWeightKg,
    unmatchedSkuCount,
    manualMode,
    suggestedVehicle,
  });

  return {
    billableWeightKg,
    cubageWeightKg,
    mode,
    modeSource,
    hubModality,
    hubMethodology,
    freightTypeLabel,
    suggestedVehicle,
    alerts,
    coverageIncomplete: unmatchedSkuCount > 0,
  };
}
