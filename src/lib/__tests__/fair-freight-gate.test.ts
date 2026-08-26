import { describe, expect, it } from 'vitest';
import {
  FAIR_DEDICADO_THRESHOLD_KG,
  fairFreightGate,
  suggestFairVehicle,
} from '@/lib/fair-freight-gate';

describe('fairFreightGate', () => {
  it('2.500 kg → fracionado, sem veículo', () => {
    const gate = fairFreightGate({ weightKg: 2500, volumeM3: 2 });
    expect(gate.mode).toBe('fracionado');
    expect(gate.hubModality).toBe('fracionado');
    expect(gate.hubMethodology).toBe('fracionado_ntc');
    expect(gate.suggestedVehicle).toBeNull();
    expect(gate.modeSource).toBe('auto');
  });

  it('cubagem manda quando volume × 300 > peso real', () => {
    const gate = fairFreightGate({ weightKg: 500, volumeM3: 12 });
    expect(gate.cubageWeightKg).toBe(3600);
    expect(gate.billableWeightKg).toBe(3600);
    expect(gate.mode).toBe('dedicado');
  });

  it('6.876,7 kg (8144 matched) → dedicado, cubagem manda → TRUCK', () => {
    const gate = fairFreightGate({ weightKg: 6876.7, volumeM3: 33.020631 });
    expect(gate.mode).toBe('dedicado');
    expect(gate.billableWeightKg).toBe(9906.2);
    expect(gate.suggestedVehicle?.code).toBe('TRUCK');
  });

  it('8144 + 45 unmatched → warning coverage', () => {
    const gate = fairFreightGate({
      weightKg: 6876.7,
      volumeM3: 33.020631,
      unmatchedSkuCount: 45,
      parsedLineCount: 80,
    });
    expect(gate.coverageIncomplete).toBe(true);
    expect(gate.alerts.some((a) => a.code === 'coverage_incomplete')).toBe(true);
    expect(gate.alerts.some((a) => a.code === 'dedicado_partial_coverage')).toBe(true);
  });

  it('override manual fracionado com 10t → warning peso alto', () => {
    const gate = fairFreightGate({
      weightKg: 10_000,
      volumeM3: 1,
      manualMode: 'fracionado',
    });
    expect(gate.mode).toBe('fracionado');
    expect(gate.modeSource).toBe('manual');
    expect(gate.alerts.some((a) => a.code === 'manual_fracionado_heavy')).toBe(true);
  });

  it('limiar exato 3000 kg → dedicado', () => {
    const gate = fairFreightGate({ weightKg: FAIR_DEDICADO_THRESHOLD_KG, volumeM3: 0 });
    expect(gate.mode).toBe('dedicado');
  });

  it('2999 kg → fracionado', () => {
    const gate = fairFreightGate({ weightKg: 2999, volumeM3: 0 });
    expect(gate.mode).toBe('fracionado');
  });
});

describe('suggestFairVehicle', () => {
  it('escolhe menor veículo que comporta', () => {
    expect(suggestFairVehicle(7000)?.code).toBe('TRUCK');
    expect(suggestFairVehicle(20_000)?.code).toBe('CARRETA_3');
  });
});
