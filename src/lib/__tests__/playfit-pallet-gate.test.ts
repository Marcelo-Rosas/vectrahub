import { describe, expect, it } from 'vitest';
import { maxPbrPalletsForVehicleCode } from '@/lib/fair-vehicle-capacity';
import {
  playfitFreightCalcSlice,
  playfitFreightGate,
  playfitLoadMetrics,
  suggestPlayFitVehicle,
} from '@/lib/playfit-pallet-gate';
import { playfitTestLine } from '@/lib/__tests__/playfit-test-line';

const LINE_16 = playfitTestLine({ thicknessMm: 16, m2PerPlate: 1, weightKgPerPlate: 14 });
const LINE_40 = playfitTestLine({ thicknessMm: 40, m2PerPlate: 1, weightKgPerPlate: 40 });

describe('fair vehicle PBR capacity', () => {
  it('CARRETA_3 80 m³ → 26 pallets PBR', () => {
    expect(maxPbrPalletsForVehicleCode('CARRETA_3')).toBe(26);
  });

  it('RODOTREM 150 m³ → 50 pallets PBR', () => {
    expect(maxPbrPalletsForVehicleCode('RODOTREM')).toBe(50);
  });
});

describe('playfitLoadMetrics', () => {
  it('2500 m² linha 16 → 2500 placas × 14 kg, 42 pallets @60', () => {
    const m = playfitLoadMetrics({ m2: 2500, line: LINE_16, platesPerPallet: 60 });
    expect(m.plates).toBe(2500);
    expect(m.pallets).toBe(42);
    expect(m.weightKg).toBe(35000);
    expect(m.volumeM3).toBeCloseTo(
      42 * playfitLoadMetrics({ m2: 60, line: LINE_16, platesPerPallet: 60 }).volumeM3PerPallet,
      2
    );
  });

  it('peso linha 40 mm = placas × 40 kg (não kg/m² fixo)', () => {
    const m = playfitLoadMetrics({ m2: 100, line: LINE_40, platesPerPallet: 20 });
    expect(m.plates).toBe(100);
    expect(m.weightKg).toBe(4000);
  });
});

describe('playfitFreightGate', () => {
  it('carga média linha 16 → dedicado TOCO', () => {
    const gate = playfitFreightGate({ m2: 400, line: LINE_16, platesPerPallet: 60 });
    expect(gate.mode).toBe('dedicado');
    expect(gate.suggestedVehicle?.code).toBe('TOCO');
  });

  it('3500 m² @60 → auto montagem 80 → 1 RODOTREM', () => {
    const gate = playfitFreightGate({ m2: 3500, line: LINE_16, platesPerPallet: 60 });
    expect(gate.trip.montageAutoUpgraded).toBe(true);
    expect(gate.trip.effectivePlatesPerPallet).toBe(80);
    expect(gate.suggestedVehicle?.code).toBe('RODOTREM');
  });

  it('5000 m² @80 → 2 RODOTREM', () => {
    const gate = playfitFreightGate({ m2: 5000, line: LINE_16, platesPerPallet: 80 });
    expect(gate.trip.multiVehicle).toBe(true);
    expect(gate.trip.vehicleTripCount).toBe(2);
    const slice = playfitFreightCalcSlice(gate);
    expect(slice.freightMultiplier).toBe(2);
  });

  it('200 m² → fracionado', () => {
    const gate = playfitFreightGate({ m2: 200, line: LINE_16, platesPerPallet: 60 });
    expect(gate.mode).toBe('fracionado');
  });

  it('sem veículo single-fit → null', () => {
    expect(suggestPlayFitVehicle(21000, 60)).toBeNull();
  });
});
