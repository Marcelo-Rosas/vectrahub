/** Regras Konnen — caixas pilha P–Z (5 placas/caixa + avulsas). */

export const PLATES_PER_STACK_BOX = 5;

export function isGluteLeaderSku(sku: string): boolean {
  return /^GL-\d{4}/i.test(sku.trim());
}

export function countStackSides(name: string, code: string): number {
  const n = name.toUpperCase();
  if (/MULTI-JUNGLE|JUNGLE/.test(n)) {
    const m = n.match(/(\d+)[\s-]*STACK/);
    if (m) return Number(m[1]);
  }
  if (/CROSSOVER|DUAL ADJUSTABLE/.test(n)) return 2;
  if (/^FM-(1001|1002|1008|2001|2003)/i.test(code)) return 2;
  return 1;
}

/** Caixas P–Z por unidade (mod 5 por lado/estação). */
export function countStackBoxes(plates: number, sides: number): number {
  if (plates <= 0) return 0;
  const sideCount = Math.max(1, sides);
  const perSide = plates / sideCount;
  const boxesOf5 = Math.floor(perSide / PLATES_PER_STACK_BOX);
  const loose = perSide % PLATES_PER_STACK_BOX;
  const perSideBoxes = boxesOf5 + (loose > 0 || perSide % 1 !== 0 ? 1 : 0);
  return perSideBoxes * sideCount;
}

const STACK_LETTERS = ['P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;

/** Tipo caixa pilha — P…Z, depois P1, P2… (jungle multi-stack). */
export function stackBoxTypeAt(index: number): string {
  if (index < STACK_LETTERS.length) return STACK_LETTERS[index]!;
  return `P${index - STACK_LETTERS.length + 1}`;
}

export function isStackBoxType(tipo: string): boolean {
  const t = tipo.trim().toUpperCase();
  return STACK_LETTERS.includes(t as (typeof STACK_LETTERS)[number]) || /^P\d+$/.test(t);
}

export type KitStackBatteryAudit = {
  sku: string;
  plates: number;
  sides: number;
  expectedStackBoxes: number;
  actualStackBoxes: number;
  stackBoxCountOk: boolean;
  stackGrossKg: number;
  machineGrossKg: number;
  kitGrossKg: number;
  oemStackKg: number | null;
  oemDeltaKg: number | null;
  kgPerPlateMedidas: number | null;
  kgPerPlateOem: number | null;
  /** Planilha Medidas repete peso médio em A–Z — não é peso real por caixa. */
  uniformBoxWeights: boolean;
  oemStackOk: boolean;
  issues: string[];
};

/** Valida contagem caixas pilha (mod 5) e peso bateria vs OEM. */
export function auditKitStackBattery(input: {
  sku: string;
  name: string;
  plates: number;
  sides?: number;
  boxTypes: Array<{ boxType: string; groupWeightKg: number }>;
  kitGrossKg: number;
  oemStackKg?: number | null;
  oemToleranceKg?: number;
}): KitStackBatteryAudit {
  const sides = input.sides ?? countStackSides(input.name, input.sku);
  const plates = Math.max(0, input.plates);
  const expectedStackBoxes = countStackBoxes(plates, sides);
  const stackBoxes = input.boxTypes.filter((b) => isStackBoxType(b.boxType));
  const machineBoxes = input.boxTypes.filter((b) => !isStackBoxType(b.boxType));
  const stackGrossKg =
    Math.round(stackBoxes.reduce((sum, b) => sum + b.groupWeightKg, 0) * 100) / 100;
  const machineGrossKg =
    Math.round(machineBoxes.reduce((sum, b) => sum + b.groupWeightKg, 0) * 100) / 100;
  const kitGrossKg = input.kitGrossKg;
  const weights = input.boxTypes.map((b) => b.groupWeightKg);
  const uniformBoxWeights =
    weights.length > 1 && weights.every((w) => Math.abs(w - weights[0]!) < 0.01);
  const oemStackKg = input.oemStackKg ?? null;
  const oemToleranceKg = input.oemToleranceKg ?? 3;
  const oemDeltaKg =
    oemStackKg != null ? Math.round((stackGrossKg - oemStackKg) * 100) / 100 : null;
  const kgPerPlateMedidas = plates > 0 ? Math.round((stackGrossKg / plates) * 100) / 100 : null;
  const kgPerPlateOem =
    oemStackKg != null && plates > 0 ? Math.round((oemStackKg / plates) * 100) / 100 : null;

  const issues: string[] = [];
  const stackBoxCountOk = stackBoxes.length === expectedStackBoxes;
  if (!stackBoxCountOk) {
    issues.push(
      `caixas pilha ${stackBoxes.length} ≠ esperado ${expectedStackBoxes} (mod 5, ${plates} placas, ${sides} lado(s))`
    );
  }
  if (uniformBoxWeights) {
    issues.push(
      'peso igual em todas caixas A–Z — provável média planilha Medidas, não peso real por volume'
    );
  }
  const oemStackOk =
    oemStackKg == null || (oemDeltaKg != null && Math.abs(oemDeltaKg) <= oemToleranceKg);
  if (!oemStackOk && oemDeltaKg != null) {
    issues.push(
      `bateria medidas ${stackGrossKg} kg vs OEM ${oemStackKg} kg (Δ ${oemDeltaKg} kg > ±${oemToleranceKg})`
    );
  }
  const kitParts = Math.round((machineGrossKg + stackGrossKg) * 100) / 100;
  if (Math.abs(kitParts - kitGrossKg) > 0.1) {
    issues.push(`máq+stack ${kitParts} kg ≠ bruto kit ${kitGrossKg} kg`);
  }

  return {
    sku: input.sku,
    plates,
    sides,
    expectedStackBoxes,
    actualStackBoxes: stackBoxes.length,
    stackBoxCountOk,
    stackGrossKg,
    machineGrossKg,
    kitGrossKg,
    oemStackKg,
    oemDeltaKg,
    kgPerPlateMedidas,
    kgPerPlateOem,
    uniformBoxWeights,
    oemStackOk,
    issues,
  };
}

export function parseMedidasNumber(raw: string): number {
  const t = String(raw ?? '').trim();
  if (!t) return 0;
  if (t.includes(',') && t.includes('.')) {
    return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return Number(t.replace(',', '.')) || 0;
}
