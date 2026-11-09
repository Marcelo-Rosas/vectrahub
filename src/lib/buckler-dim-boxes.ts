/**
 * Parse dimensões Medidas/Interfit → caixas A/B/C/D (cascata fixture).
 */

export type DimBox = { type: string; l: number; w: number; h: number };

export function parseDimsToken(token: string): { l: number; w: number; h: number } | null {
  const t = token.trim();
  const isCm = /cm/i.test(t);
  const isMm = /mm/i.test(t);
  const nums = [...t.replace(/[^\d.,xX×*:+]/g, ' ').matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) =>
    Number(m[1]!.replace(',', '.'))
  );
  if (nums.length < 3) return null;
  let [l, w, h] = nums;
  if (isCm || (!isMm && l < 400 && (String(nums[0]).includes('.') || w < 400))) {
    l *= 10;
    w *= 10;
    h *= 10;
  } else if (!isMm && l < 10 && w < 10) {
    l *= 1000;
    w *= 1000;
    h *= 1000;
  }
  return { l: Math.round(l), w: Math.round(w), h: Math.round(h) };
}

/** "A: L×W×H B: …" | "A L×W×H B L×W×H" | "L×W×H + L×W×H" → cascata tipos. */
export function parseDimBoxes(raw: string): DimBox[] {
  const boxes: DimBox[] = [];
  const text = raw.trim();

  const withColon = [...text.matchAll(/([A-D])[：:]\s*([^A-D]+?)(?=\s+[A-D][：:]|$)/gi)];
  if (withColon.length > 0) {
    for (const m of withColon) {
      const dims = parseDimsToken(m[2]!);
      if (dims) boxes.push({ type: m[1]!.toUpperCase(), ...dims });
    }
    return boxes;
  }

  const letterSpace = [...text.matchAll(/\b([A-D])\s+(\d[\s\S]*?)(?=\s+[A-D]\s+\d|$)/gi)];
  if (letterSpace.length > 0) {
    for (const m of letterSpace) {
      const dims = parseDimsToken(m[2]!);
      if (dims) boxes.push({ type: m[1]!.toUpperCase(), ...dims });
    }
    return boxes;
  }

  if (text.includes('+')) {
    const parts = text.split('+').map((s) => s.trim());
    const letters = ['A', 'B', 'C', 'D', 'E'];
    for (let i = 0; i < parts.length; i++) {
      const dims = parseDimsToken(parts[i]!);
      if (dims) boxes.push({ type: letters[i] ?? 'A', ...dims });
    }
    if (boxes.length > 0) return boxes;
  }

  const single = parseDimsToken(text);
  if (single) boxes.push({ type: 'A', ...single });
  return boxes;
}

export function fmtBr(n: number): string {
  return String(Math.round((n + Number.EPSILON) * 100) / 100).replace('.', ',');
}

/** Interfit base row → linhas cascata fixture (1 row por tipo caixa). */
export function interfitCartonToRows(input: {
  code: string;
  name: string;
  cartonQty: string;
  cartonSizeMm: string;
  grossKg: string;
}): Array<{
  Item: string;
  Produto: string;
  'Qtd. Caixas Total': number;
  'Tipo Caixa': string;
  COMPRIMENTO: string;
  LARGURA: string;
  ALTURA: string;
  'Qtd. Tipos de Medida': number;
  'Qtd. Caixas por Medida': number;
  'Peso Bruto Total (kg)': number;
  'Peso Médio por Caixa (kg)': string;
  'Peso Estimado do Grupo (kg)': string;
}> {
  const boxes = parseDimBoxes(input.cartonSizeMm);
  if (boxes.length === 0) return [];

  const cartonQty = Math.max(1, Number(String(input.cartonQty).replace(',', '.')) || 1);
  const gross = Number(String(input.grossKg).replace(',', '.')) || 0;
  const totalBoxes = boxes.length > 1 ? boxes.length : cartonQty;
  const perBox = gross / Math.max(totalBoxes, 1);
  const sku = input.code.trim().toUpperCase();

  return boxes.map((b) => ({
    Item: sku,
    Produto: input.name,
    'Qtd. Caixas Total': totalBoxes,
    'Tipo Caixa': b.type,
    COMPRIMENTO: String(b.l),
    LARGURA: String(b.w),
    ALTURA: String(b.h),
    'Qtd. Tipos de Medida': boxes.length,
    'Qtd. Caixas por Medida': 1,
    'Peso Bruto Total (kg)': gross,
    'Peso Médio por Caixa (kg)': fmtBr(perBox),
    'Peso Estimado do Grupo (kg)': fmtBr(perBox),
  }));
}
