import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';
import { cropReceiptDataUrl } from '@/lib/pod-receipt-crop';
import {
  podPdfCode,
  podPdfFileName,
  shouldSplitPodByShipper,
  singlePodPdfFileName,
  type PodShipperSlice,
} from '@/lib/pod-pdf-shippers';

export interface PodPdfPayload {
  os_number: string;
  client_name: string;
  origin: string;
  destination: string;
  shipper_name: string | null;
  shipper_2_name?: string | null;
  driver_name: string | null;
  vehicle_plate: string | null;
  cargo_value_cents: number | null;
  value_cents: number;
  pickup_date: string | null;
  eta: string | null;
  cte_number?: string | null;
  nfe_number?: string | null;
  pod_image_data_url: string;
  /** Extra canhotos no mesmo PDF (OS não-VG). VG usa um por fatia. */
  pod_images?: string[];
  pod_uploaded_at: string;
  /** Viagem (VG-YYYY-MM-NNNN). Quando VG + ≥2 embarcadores, gera um PDF por fatia. */
  trip_number?: string | null;
  /** Fatias já resolvidas (origem/NF/CT-e por embarcador). */
  shippers?: PodShipperSlice[];
  /** Logo já em data URL — testes Node / smoke sem Vite. */
  logoBase64Override?: string | null;
}

export interface PodPdfFile {
  blob: Blob;
  fileName: string;
  shipper_name: string | null;
}

type PdfDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

const C = {
  navy: [27, 42, 74] as [number, number, number],
  navyDark: [18, 28, 52] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
  orangeLight: [249, 200, 150] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [30, 35, 45] as [number, number, number],
  muted: [100, 110, 130] as [number, number, number],
  light: [246, 248, 251] as [number, number, number],
  border: [200, 206, 214] as [number, number, number],
  success: [22, 101, 52] as [number, number, number],
  successLight: [220, 252, 231] as [number, number, number],
};

const PW = 210;
const ML = 12;
const MR = 12;
const CW = PW - ML - MR;
/** Teto baixo: retrato com fundo não toma a página. Paisagem fina encolhe sozinha. */
export const POD_IMAGE_MAX_HEIGHT_MM = 62;
const POD_FOOTER_RESERVE_MM = 16;

/**
 * Encaixa a foto no retângulo (contain): mantém aspect ratio, nunca estoura
 * maxW/maxH. Usado para canhotos paisagem (ex.: 1600×355) e retrato.
 */
export function fitImageContain(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  const boxW = Math.max(0, maxW);
  const boxH = Math.max(0, maxH);
  if (boxW <= 0 || boxH <= 0) return { width: 0, height: 0 };
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
    return { width: boxW, height: Math.min(boxH, 40) };
  }
  const scale = Math.min(boxW / srcW, boxH / srcH);
  return {
    width: srcW * scale,
    height: srcH * scale,
  };
}

const VECTRA = {
  name: 'VECTRA HUB LTDA',
  cnpj: '62.188.748/0001-17',
  ie: '263768406',
  address: 'RODOVIA JORGE LACERDA, 725',
  city: 'ITAJAI',
  uf: 'SC',
  phone: '(47) 98850-9714',
  email: 'marcelo.rosas@vectracargo.com.br',
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  try {
    return formatDate(d);
  } catch {
    return d;
  }
};

async function loadLogoBase64(): Promise<string | null> {
  try {
    const mod = (await import('@/assets/logo_vectra_cargo.jpg?url')) as { default?: string };
    const logoUrl = mod.default;
    if (!logoUrl) return null;
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fallbackShippers(payload: PodPdfPayload): PodShipperSlice[] {
  if (payload.shippers && payload.shippers.length > 0) {
    return payload.shippers.filter((s) => s.name.trim().length > 0);
  }
  const slices: PodShipperSlice[] = [];
  const primary = payload.shipper_name?.trim();
  if (primary) {
    slices.push({
      name: primary,
      origin: payload.origin,
      nfe_numbers: payload.nfe_number?.trim() ? [payload.nfe_number.trim()] : [],
      cte_numbers: payload.cte_number?.trim() ? [payload.cte_number.trim()] : [],
    });
  }
  const second = payload.shipper_2_name?.trim();
  if (second) {
    slices.push({
      name: second,
      origin: null,
      nfe_numbers: [],
      cte_numbers: [],
    });
  }
  return slices;
}

function payloadForSlice(base: PodPdfPayload, slice: PodShipperSlice): PodPdfPayload {
  const image = slice.pod_image_data_url?.trim() || base.pod_image_data_url;
  return {
    ...base,
    shipper_name: slice.name,
    shipper_2_name: null,
    origin: slice.origin?.trim() || base.origin,
    nfe_number: slice.nfe_numbers.length > 0 ? slice.nfe_numbers.join(', ') : null,
    cte_number: slice.cte_numbers.length > 0 ? slice.cte_numbers.join(', ') : null,
    pod_image_data_url: image,
    pod_images: image ? [image] : [],
    shippers: undefined,
  };
}

function drawHeader(doc: PdfDoc, payload: PodPdfPayload, logoBase64: string | null): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'JPEG', ML, 3, 22, 22);
  }

  const ix = ML + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text(VECTRA.name, ix, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 215, 235);
  doc.text(`CNPJ: ${VECTRA.cnpj}    IE: ${VECTRA.ie}`, ix, 13);
  doc.text(`${VECTRA.address} - ${VECTRA.city}/${VECTRA.uf}`, ix, 17.5);
  doc.text(`Fone: ${VECTRA.phone}    E-mail: ${VECTRA.email}`, ix, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('COMPROVANTE DE ENTREGA', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  const headerRef = payload.trip_number?.trim()
    ? `${payload.os_number}  ·  ${payload.trip_number.trim()}`
    : payload.os_number;
  doc.text(`OS: ${headerRef}`, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissão: ${fmtDate(new Date().toISOString())}`, PW - MR, 19, { align: 'right' });

  return H + 2 + 6;
}

function drawStatusBadge(doc: PdfDoc, y: number): number {
  const badgeH = 8;
  doc.setFillColor(...C.successLight);
  doc.roundedRect(ML, y, CW, badgeH, 2, 2, 'F');
  doc.setFillColor(...C.success);
  doc.roundedRect(ML, y, 3, badgeH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.success);
  doc.text('ENTREGA CONFIRMADA — Canhoto assinado anexo', ML + 6, y + 5.5);
  return y + badgeH + 4;
}

function drawInfoGrid(doc: PdfDoc, payload: PodPdfPayload, y: number): number {
  const rows: string[][] = [
    ['Cliente / Destinatário', payload.client_name, 'Embarcador', payload.shipper_name ?? '—'],
  ];

  if (payload.shipper_2_name?.trim()) {
    rows.push(['', '', 'Embarcador 2', payload.shipper_2_name]);
  }

  rows.push(
    ['Origem', payload.origin, 'Destino', payload.destination],
    ['Motorista', payload.driver_name ?? '—', 'Placa', payload.vehicle_plate ?? '—'],
    ['Data de Entrega', fmtDate(payload.eta), '', '']
  );

  if (payload.cte_number || payload.nfe_number) {
    rows.push(['CT-e', payload.cte_number ?? '—', 'NF-e', payload.nfe_number ?? '—']);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    tableWidth: CW,
    body: rows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: C.muted, cellWidth: 38 },
      1: { textColor: C.text, cellWidth: CW / 2 - 38 },
      2: { fontStyle: 'bold', textColor: C.muted, cellWidth: 38 },
      3: { textColor: C.text, cellWidth: CW / 2 - 38 },
    },
    alternateRowStyles: {
      fillColor: C.light,
    },
    didDrawPage: () => {},
  });

  return (doc as PdfDoc).lastAutoTable?.finalY ?? y + rows.length * 8;
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function drawContainedImage(doc: PdfDoc, imageDataUrl: string, y: number, maxH: number): number {
  if (maxH < 12) return y;
  try {
    const props = doc.getImageProperties(imageDataUrl);
    const fitted = fitImageContain(props.width, props.height, CW, maxH);
    const x = ML + (CW - fitted.width) / 2;
    const ext = imageFormat(imageDataUrl);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.rect(x, y, fitted.width, fitted.height);
    doc.addImage(imageDataUrl, ext, x, y, fitted.width, fitted.height, undefined, 'FAST');
    return y + fitted.height + 3;
  } catch {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('[Imagem do canhoto não disponível]', ML, y + 6);
    return y + 12;
  }
}

function drawPodImages(doc: PdfDoc, imageDataUrls: string[], y: number): number {
  const urls = imageDataUrls.map((u) => u.trim()).filter(Boolean);
  const sectionTitleY = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(
    urls.length > 1 ? 'CANHOTOS ASSINADOS (Fotos do POD)' : 'CANHOTO ASSINADO (Foto do POD)',
    ML,
    sectionTitleY
  );

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, sectionTitleY + 1.5, PW - MR, sectionTitleY + 1.5);

  let imgY = sectionTitleY + 4;
  if (urls.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('[Imagem do canhoto não disponível]', ML, imgY + 6);
    return imgY + 12;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 0; i < urls.length; i++) {
    const remain = pageHeight - imgY - POD_FOOTER_RESERVE_MM;
    const left = urls.length - i;
    const slot = Math.min(POD_IMAGE_MAX_HEIGHT_MM, remain / left - (left > 1 ? 3 : 0));
    if (slot < 10) break;
    imgY = drawContainedImage(doc, urls[i]!, imgY, slot);
  }
  return imgY;
}

function drawFooter(doc: PdfDoc, payload: PodPdfPayload): void {
  const ph = doc.internal.pageSize.getHeight();
  const fy = ph - 10;

  doc.setFillColor(...C.navy);
  doc.rect(0, ph - 12, PW, 12, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 215, 235);
  const footerRef = payload.trip_number?.trim()
    ? `OS ${payload.os_number} · ${payload.trip_number.trim()}`
    : `OS ${payload.os_number}`;
  doc.text(
    `Documento gerado por Vectra Cargo TMS em ${fmtDate(new Date().toISOString())} • ${footerRef}`,
    ML,
    fy + 0.5
  );
  doc.text('Documento de uso interno — não substitui CT-e ou NF-e originais', PW - MR, fy + 0.5, {
    align: 'right',
  });
}

async function renderPodPdf(
  payload: PodPdfPayload,
  logoBase64: string | null,
  fileName: string
): Promise<PodPdfFile> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;

  let y = drawHeader(doc, payload, logoBase64);
  y = drawStatusBadge(doc, y);
  y = drawInfoGrid(doc, payload, y + 2);
  const rawImages =
    payload.pod_images && payload.pod_images.length > 0
      ? payload.pod_images
      : payload.pod_image_data_url
        ? [payload.pod_image_data_url]
        : [];
  const images = await Promise.all(rawImages.map((url) => cropReceiptDataUrl(url)));
  y = drawPodImages(doc, images, y + 4);
  drawFooter(doc, payload);

  return {
    blob: doc.output('blob'),
    fileName,
    shipper_name: payload.shipper_name,
  };
}

export async function generatePodPdf(payload: PodPdfPayload): Promise<PodPdfFile[]> {
  const logoBase64 =
    payload.logoBase64Override !== undefined ? payload.logoBase64Override : await loadLogoBase64();

  const shippers = fallbackShippers(payload);
  const split = shouldSplitPodByShipper({
    os_number: payload.os_number,
    trip_number: payload.trip_number,
    shippers,
  });

  if (split) {
    const code = podPdfCode(payload.os_number, payload.trip_number);
    const files: PodPdfFile[] = [];
    for (const slice of shippers) {
      files.push(
        await renderPodPdf(
          payloadForSlice(payload, slice),
          logoBase64,
          podPdfFileName(code, slice.name)
        )
      );
    }
    return files;
  }

  return [await renderPodPdf(payload, logoBase64, singlePodPdfFileName(payload.os_number))];
}

export function downloadPodPdfFiles(files: PodPdfFile[]): void {
  files.forEach((file, index) => {
    window.setTimeout(() => {
      const objectUrl = URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }, index * 400);
  });
}
