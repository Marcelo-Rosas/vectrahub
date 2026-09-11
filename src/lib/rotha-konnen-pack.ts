/**
 * Rotha feira — caixa similar Konnen (só C×L×A + kg).
 * SKU Rotha nunca recebe código RKC / YL / BRTW / AB.
 */

export type RothaPack = {
  length_m: number;
  width_m: number;
  height_m: number;
  volume_m3: number;
  weight_kg: number;
};

function pack(lengthMm: number, widthMm: number, heightMm: number, weightKg: number): RothaPack {
  const length_m = lengthMm / 1000;
  const width_m = widthMm / 1000;
  const height_m = heightMm / 1000;
  return {
    length_m,
    width_m,
    height_m,
    volume_m3: Math.round(length_m * width_m * height_m * 1000) / 1000,
    weight_kg: weightKg,
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function envelope(volumeM3: number, weightKg: number, lengthM = 1.2, widthM = 0.8): RothaPack {
  const height_m = volumeM3 / (lengthM * widthM);
  return {
    length_m: lengthM,
    width_m: widthM,
    height_m: round3(height_m),
    volume_m3: round3(volumeM3),
    weight_kg: weightKg,
  };
}

/** Urethane dumbbell — 1 peça. */
const UDB: Record<number, RothaPack> = {
  12: pack(284, 177, 177, 12),
  14: pack(298, 177, 177, 14),
  16: pack(274, 235, 235, 16),
  18: pack(278, 235, 235, 18),
  20: pack(288, 235, 235, 20),
  22: pack(298, 235, 235, 22),
  24: pack(304, 235, 235, 24),
  26: pack(316, 235, 235, 26),
  28: pack(318, 235, 235, 28),
  30: pack(328, 235, 235, 30),
  32: pack(338, 235, 235, 32),
  34: pack(348, 235, 235, 34),
  36: pack(358, 235, 235, 36),
};

/** Urethane plate — caixa. Peso = nominal da anilha Rotha. */
const UWP_BOX: Record<number, Omit<RothaPack, 'weight_kg'>> = {
  2.5: pack(230, 220, 57, 0),
  5: pack(280, 265, 85, 0),
  10: pack(335, 325, 85, 0),
  15: pack(378, 370, 70, 0),
  20: pack(420, 415, 54, 0),
  25: pack(450, 445, 57, 0),
};

const BAR_MONTADA_UNIT: Record<number, RothaPack> = {
  10: pack(1245, 235, 235, 10),
  15: pack(1060, 153, 153, 15),
  20: pack(1100, 177, 177, 20),
  25: pack(1110, 235, 235, 25),
  30: pack(1130, 235, 235, 30),
};

function nearestKey(table: Record<number, unknown>, kg: number): number {
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  return keys.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a));
}

export function packAnilhaKg(kg: number): RothaPack {
  const box = UWP_BOX[kg] ?? UWP_BOX[nearestKey(UWP_BOX, kg)]!;
  return { ...box, weight_kg: kg, volume_m3: box.volume_m3 };
}

/** Móvel montado — C×L×A catálogo 2025 (metro). */
export function packAssembledM(
  lengthM: number,
  widthM: number,
  heightM: number,
  weightKg: number
): RothaPack {
  return {
    length_m: lengthM,
    width_m: widthM,
    height_m: heightM,
    volume_m3: round3(lengthM * widthM * heightM),
    weight_kg: weightKg,
  };
}

/** Barra pelo comprimento catálogo (ex. OLBACR 2). */
export function packBarLengthM(lengthM: number, weightKg: number, sectionMm = 90): RothaPack {
  return pack(lengthM * 1000, sectionMm, sectionMm, weightKg);
}

export function packBarMontadaKg(kg: number): RothaPack {
  const hit = BAR_MONTADA_UNIT[kg];
  if (hit) return hit;
  const nearest = nearestKey(BAR_MONTADA_UNIT, kg);
  return { ...BAR_MONTADA_UNIT[nearest]!, weight_kg: kg };
}

export function packHalterPieceKg(kg: number): RothaPack {
  return pack(220, 90, 90, kg);
}

export function packKettleKg(kg: number): RothaPack {
  const s = Math.cbrt(kg / 16);
  return pack(205 * s, 173 * s, 270 * s, kg);
}

export function packBumperKg(kg: number): RothaPack {
  const s = Math.cbrt(kg / 10);
  return pack(470 * s, 470 * s, 60 * s, kg);
}

export function packDumbbellPieceKg(kg: number): RothaPack {
  const hit = UDB[kg];
  if (hit) return hit;
  const keys = Object.keys(UDB)
    .map(Number)
    .sort((a, b) => a - b);
  const nearest = keys.reduce((a, b) => (Math.abs(b - kg) < Math.abs(a - kg) ? b : a));
  return { ...UDB[nearest]!, weight_kg: kg };
}

/** Kit pares 12–36 kg passo 2 (NF R4070). */
export function packDumbbellKit12to36(): RothaPack {
  let weight = 0;
  let volume = 0;
  for (let kg = 12; kg <= 36; kg += 2) {
    const p = UDB[kg]!;
    weight += 2 * p.weight_kg;
    volume += 2 * p.volume_m3;
  }
  return envelope(volume, weight);
}

/** Kit barras 10–30 kg passo 5 (NF R3501 / R3506). */
export function packBarraMontadaKit10to30(): RothaPack {
  let weight = 0;
  let volume = 0;
  for (const kg of [10, 15, 20, 25, 30]) {
    const p = BAR_MONTADA_UNIT[kg]!;
    weight += p.weight_kg;
    volume += p.volume_m3;
  }
  return envelope(volume, weight, 1.25, 0.24);
}

/** Halter 1–10 kg × 10 pares (NF R1282). */
export function packHalter1to10(): RothaPack {
  return envelope(0.2, 110);
}

/**
 * Konnen P5357 = kit 5 puxadores, 2 caixas 800×200×150 mm, 62 kg.
 * Rotha NF 4661 R1751 = kit 6 pç texturizado + suporte, 110 kg, 2 vol.
 * Caixa = P5357; peso = NF.
 */
export function packPuxadorAnatomicoRotha6(): RothaPack {
  return pack(800, 200, 300, 110);
}

export const PACK = {
  puxador: pack(400, 250, 120, 4),
  puxadorCorda: pack(600, 150, 150, 2.5),
  puxadorAnatKit: packPuxadorAnatomicoRotha6(),
  anilheiro: pack(1255, 885, 215, 50.2),
  suporteHalter10: pack(1350, 530, 530, 70),
  suporteDb13: pack(2470, 540, 540, 95),
  suporteBarraMont: pack(1525, 845, 170, 50.3),
  suporteDbSext: pack(1260, 625, 145, 38.6),
  suporteKettle: pack(900, 500, 1200, 42),
  bumper10: pack(470, 470, 60, 10),
  kettle16: pack(205, 173, 270, 16),
  wallball6: pack(350, 350, 350, 6),
  barraOlimpica: pack(2260, 90, 90, 21),
  barraCurta: pack(1260, 90, 90, 11),
  barraW: pack(1260, 90, 90, 12),
  rackCfFixo: pack(2520, 1120, 440, 281),
  rackCfMod: pack(1920, 1020, 470, 244),
  funcionalPeq: pack(400, 300, 200, 5),
  colchonete: pack(1100, 400, 150, 8),
} as const;
