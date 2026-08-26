import { describe, expect, it } from 'vitest';
import {
  FAIR_VEHICLE_CAPACITY_M3,
  maxPbrPalletsForVehicleCode,
  vehicleFitsPbrPallets,
} from '@/lib/fair-vehicle-capacity';

describe('fair-vehicle-capacity', () => {
  it('espelha seed vehicle_types → pallets PBR', () => {
    expect(maxPbrPalletsForVehicleCode('VUC')).toBe(6);
    expect(maxPbrPalletsForVehicleCode('TOCO')).toBe(10);
    expect(maxPbrPalletsForVehicleCode('TRUCK')).toBe(15);
    expect(maxPbrPalletsForVehicleCode('CARRETA_3')).toBe(26);
    expect(maxPbrPalletsForVehicleCode('RODOTREM')).toBe(50);
  });

  it('vehicleFitsPbrPallets', () => {
    expect(vehicleFitsPbrPallets('CARRETA_3', 26)).toBe(true);
    expect(vehicleFitsPbrPallets('CARRETA_3', 27)).toBe(false);
    expect(vehicleFitsPbrPallets('RODOTREM', 38)).toBe(true);
  });

  it('todos os códigos da escada feira têm m³', () => {
    const codes = ['VUC', 'TOCO', 'TRUCK', 'BI_TRUCK', 'CARRETA_3', 'CARRETA_4', 'RODOTREM'];
    for (const code of codes) {
      expect(FAIR_VEHICLE_CAPACITY_M3[code]).toBeGreaterThan(0);
      expect(maxPbrPalletsForVehicleCode(code)).toBeGreaterThan(0);
    }
  });
});
