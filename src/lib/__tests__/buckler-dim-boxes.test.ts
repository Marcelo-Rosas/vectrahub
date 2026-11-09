import { describe, expect, it } from 'vitest';

import { interfitCartonToRows, parseDimBoxes } from '@/lib/buckler-dim-boxes';

describe('buckler-dim-boxes', () => {
  it('6841 — cascata A/B sem dois-pontos', () => {
    const boxes = parseDimBoxes('A 220.5 x 89.5 x 37.5cm B 113.5 x 95 x 38 cm');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toMatchObject({ type: 'A', l: 2205, w: 895, h: 375 });
    expect(boxes[1]).toMatchObject({ type: 'B', l: 1135, w: 950, h: 380 });
  });

  it('5556 — cascata via +', () => {
    const boxes = parseDimBoxes('98 x 128 x 36.5cm + 223 x 95.5 x 40cm');
    expect(boxes).toHaveLength(2);
    expect(boxes[0]!.type).toBe('A');
    expect(boxes[1]!.type).toBe('B');
  });

  it('interfitCartonToRows gera 2 linhas por SKU cardio', () => {
    const rows = interfitCartonToRows({
      code: '6841EA',
      name: 'Treadmill Led (Esteira com Tela Led)',
      cartonQty: '2',
      cartonSizeMm: 'A 220.5 x 89.5 x 37.5cm B 113.5 x 95 x 38 cm',
      grossKg: '190',
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r['Tipo Caixa'])).toEqual(['A', 'B']);
    expect(rows[0]!['Peso Estimado do Grupo (kg)']).toBe('95');
  });
});
