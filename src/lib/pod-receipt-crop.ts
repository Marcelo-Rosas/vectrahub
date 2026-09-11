/** Recorte do papel do canhoto (faixa clara) sem dependência extra. */

export interface PaperCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LUMINANCE_MIN = 168;
const ROW_FILL = 0.16;
const COL_FILL = 0.16;
const PAD_RATIO = 0.03;
const MIN_AREA_GAIN = 0.18;
const MIN_CROP_SIDE = 16;

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isPaperPixel(rgba: Uint8ClampedArray | Uint8Array, i: number): boolean {
  return luminance(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0) >= LUMINANCE_MIN;
}

/**
 * Encontra o retângulo do papel branco/claro sobre fundo escuro.
 * Retorna null se não houver faixa útil (foto já é o recibo, ou sem contraste).
 */
export function findBrightPaperBox(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): PaperCropBox | null {
  if (width < MIN_CROP_SIDE || height < MIN_CROP_SIDE || rgba.length < width * height * 4) {
    return null;
  }

  const stepX = width > 800 ? 2 : 1;
  const stepY = height > 800 ? 2 : 1;
  const paperRows: boolean[] = new Array(height).fill(false);
  const samplesPerRow = Math.max(1, Math.floor(width / stepX));

  for (let y = 0; y < height; y += stepY) {
    let bright = 0;
    const rowOff = y * width * 4;
    for (let x = 0; x < width; x += stepX) {
      if (isPaperPixel(rgba, rowOff + x * 4)) bright += 1;
    }
    paperRows[y] = bright / samplesPerRow >= ROW_FILL;
  }

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    if (paperRows[y]) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  if (top < 0 || bottom < top) return null;

  const bandH = bottom - top + 1;
  const samplesPerCol = Math.max(1, Math.floor(bandH / stepY));
  let left = -1;
  let right = -1;
  for (let x = 0; x < width; x += 1) {
    let bright = 0;
    for (let y = top; y <= bottom; y += stepY) {
      if (isPaperPixel(rgba, (y * width + x) * 4)) bright += 1;
    }
    if (bright / samplesPerCol >= COL_FILL) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left < 0 || right < left) return null;

  const padX = Math.max(4, Math.round(width * PAD_RATIO));
  const padY = Math.max(4, Math.round(height * PAD_RATIO));
  const x = Math.max(0, left - padX);
  const y = Math.max(0, top - padY);
  const x2 = Math.min(width, right + 1 + padX);
  const y2 = Math.min(height, bottom + 1 + padY);
  const box: PaperCropBox = { x, y, width: x2 - x, height: y2 - y };

  if (box.width < MIN_CROP_SIDE || box.height < MIN_CROP_SIDE) return null;
  const areaGain = 1 - (box.width * box.height) / (width * height);
  if (areaGain < MIN_AREA_GAIN) return null;
  return box;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('pod-crop-image'));
    img.src = dataUrl;
  });
}

/**
 * Recorta o papel do canhoto quando houver Canvas (browser).
 * Sem Canvas (Node/testes) ou sem faixa clara, devolve o data URL original.
 */
export async function cropReceiptDataUrl(dataUrl: string): Promise<string> {
  const src = dataUrl.trim();
  if (!src || typeof document === 'undefined' || typeof Image === 'undefined') return src;

  try {
    const img = await loadImageElement(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w < MIN_CROP_SIDE || h < MIN_CROP_SIDE) return src;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    const box = findBrightPaperBox(data, w, h);
    if (!box) return src;

    const out = document.createElement('canvas');
    out.width = box.width;
    out.height = box.height;
    const octx = out.getContext('2d');
    if (!octx) return src;
    octx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    return out.toDataURL('image/jpeg', 0.88);
  } catch {
    return src;
  }
}
