import { calculatePalletsFromVolume } from '@/lib/pallets';

/**
 * Volume útil (m³) por código — espelho seed `public.vehicle_types`
 * (migration 20260207015416). Capacidade real do baú fica em `vehicles.capacity_m3`;
 * feira usa defaults do tipo até integrar frota.
 */
export const FAIR_VEHICLE_CAPACITY_M3: Record<string, number> = {
  VUC: 18,
  TOCO: 30,
  TRUCK: 45,
  BI_TRUCK: 55,
  CARRETA_3: 80,
  CARRETA_4: 90,
  RODOTREM: 150,
};

/** Pallets PBR (1,00 × 1,20 m) que cabem — `floor(m³ ÷ 3)` via `pallets.ts`. */
export function maxPbrPalletsForVehicleCode(code: string): number | null {
  const capacityM3 = FAIR_VEHICLE_CAPACITY_M3[code];
  if (capacityM3 == null) return null;
  return calculatePalletsFromVolume(capacityM3);
}

export function vehicleFitsPbrPallets(code: string, palletQty: number): boolean {
  const max = maxPbrPalletsForVehicleCode(code);
  return max != null && max >= palletQty;
}
