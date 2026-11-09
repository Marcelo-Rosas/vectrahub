import { describe, expect, it } from 'vitest';
import { cropReceiptDataUrl, findBrightPaperBox } from '@/lib/pod-receipt-crop';

function makeRgba(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number]
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('findBrightPaperBox', () => {
  it('recorta a faixa branca do recibo e descarta o tecido escuro', () => {
    const w = 80;
    const h = 120;
    const data = makeRgba(w, h, (x, y) => {
      const paper = y >= 48 && y <= 78 && x >= 4 && x <= 76;
      return paper ? [245, 245, 240] : [18, 16, 14];
    });
    const box = findBrightPaperBox(data, w, h);
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(40);
    expect(box!.y + box!.height).toBeLessThanOrEqual(90);
    expect(box!.height).toBeLessThan(h * 0.45);
    expect(box!.width).toBeGreaterThan(w * 0.7);
  });

  it('não recorta foto já só de papel (sem ganho)', () => {
    const w = 60;
    const h = 40;
    const data = makeRgba(w, h, () => [250, 250, 248]);
    expect(findBrightPaperBox(data, w, h)).toBeNull();
  });

  it('não recorta foto sem papel claro', () => {
    const w = 40;
    const h = 40;
    const data = makeRgba(w, h, () => [22, 20, 18]);
    expect(findBrightPaperBox(data, w, h)).toBeNull();
  });
});

describe('cropReceiptDataUrl', () => {
  it('no Node devolve o data URL original', async () => {
    const src = 'data:image/jpeg;base64,AAA';
    expect(await cropReceiptDataUrl(src)).toBe(src);
  });
});
