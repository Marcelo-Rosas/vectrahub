import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';

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
  pod_uploaded_at: string;
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

const fmtCurrency = (cents: number | null | undefined): string => {
  if (cents == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
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
  doc.text(`OS: ${payload.os_number}`, PW - MR, 14.5, { align: 'right' });

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

function drawPodImage(doc: PdfDoc, imageDataUrl: string, y: number): number {
  const sectionTitleY = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('CANHOTO ASSINADO (Foto do POD)', ML, sectionTitleY);

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, sectionTitleY + 1.5, PW - MR, sectionTitleY + 1.5);

  const imgY = sectionTitleY + 4;
  const pageHeight = doc.internal.pageSize.getHeight();
  const availH = pageHeight - imgY - 20;
  const imgW = CW;
  const imgH = Math.min(availH, 120);

  try {
    const ext = imageDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    doc.addImage(imageDataUrl, ext, ML, imgY, imgW, imgH, undefined, 'FAST');
    return imgY + imgH + 4;
  } catch {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('[Imagem do canhoto não disponível]', ML, imgY + 6);
    return imgY + 12;
  }
}

function drawFooter(doc: PdfDoc, payload: PodPdfPayload): void {
  const ph = doc.internal.pageSize.getHeight();
  const fy = ph - 10;

  doc.setFillColor(...C.navy);
  doc.rect(0, ph - 12, PW, 12, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 215, 235);
  doc.text(
    `Documento gerado por Vectra Cargo TMS em ${fmtDate(new Date().toISOString())} • OS ${payload.os_number}`,
    ML,
    fy + 0.5
  );
  doc.text('Documento de uso interno — não substitui CT-e ou NF-e originais', PW - MR, fy + 0.5, {
    align: 'right',
  });
}

export async function generatePodPdf(payload: PodPdfPayload): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;

  const logoBase64 = await loadLogoBase64();

  let y = drawHeader(doc, payload, logoBase64);
  y = drawStatusBadge(doc, y);
  y = drawInfoGrid(doc, payload, y + 2);
  y = drawPodImage(doc, payload.pod_image_data_url, y + 4);
  drawFooter(doc, payload);

  doc.save(`comprovante-entrega-${payload.os_number}.pdf`);
}
