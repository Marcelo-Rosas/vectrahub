import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';

type QuotePdfMode = 'simplified' | 'detailed';

export interface QuotePdfPayload {
  id: string;
  quote_code: string | null;
  client_name: string;
  origin: string | null;
  destination: string | null;
  value: number | null;
  cargo_type: string | null;
  weight: number | null;
  volume: number | null;
  km_distance: number | null;
  estimated_loading_date: string | null;
  validity_date?: string | null;
  notes?: string | null;
  created_at: string | null;
  updated_at: string | null;
  payment_term_name?: string | null;
  payment_method_label?: string | null;
  antt_compliance?: { piso: number; below: boolean; modality: string };
  pricing_breakdown?: StoredPricingBreakdown | null;
  freight_modality?: 'lotacao' | 'fracionado' | null;
  freight_type?: string | null;
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
};

const PW = 210;
const ML = 12;
const MR = 12;
const CW = PW - ML - MR;

const VECTRA = {
  name: 'VECTRA HUB',
  cnpj: '62.188.748/0001-17',
  ie: '263768406',
  address: 'RODOVIA JORGE LACERDA',
  number: '725',
  city: 'ITAJAI',
  uf: 'SC',
  phone: '(47) 98850-9714',
  email: 'marcelo.rosas@vectracargo.com.br',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const safe = (v: string | number | null | undefined): string => {
  if (v == null || v === '') return '—';
  return String(v);
};

const fmtNum = (v: number | null | undefined): string => {
  if (v == null) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v));
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  try {
    return formatDate(d);
  } catch {
    return '';
  }
};

const formatWeight = (raw: number | null | undefined): string => {
  if (raw == null) return '—';
  const kg = Number(raw);
  return kg >= 1000
    ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(kg / 1000)} t`
    : `${new Intl.NumberFormat('pt-BR').format(kg)} kg`;
};

const fmtUnit = (raw: number | null | undefined, unit: string): string => {
  if (raw == null) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(raw))} ${unit}`;
};

const humanizeCargoType = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  return raw.replace(/_/g, ' ').toUpperCase();
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

// ── Drawers (padrão OC/POD) ────────────────────────────────────────────────────

function drawWatermark(doc: PdfDoc, text: string): void {
  const ph = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.setTextColor(220, 38, 38);
  doc.setGState(
    new (doc as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 0.15 })
  );
  doc.text(text, PW / 2, ph / 2, { align: 'center', angle: 30 });
  doc.restoreGraphicsState();
}

function drawHeader(
  doc: PdfDoc,
  payload: QuotePdfPayload,
  mode: QuotePdfMode,
  logoBase64: string | null
): number {
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
  doc.text(`${VECTRA.address}, ${VECTRA.number} - ${VECTRA.city}/${VECTRA.uf}`, ix, 17.5);
  doc.text(`Fone: ${VECTRA.phone}    E-mail: ${VECTRA.email}`, ix, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('PROPOSTA COMERCIAL DE FRETE', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`No ${payload.quote_code ?? '—'}`, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissao: ${fmtDate(new Date().toISOString())}`, PW - MR, 19, { align: 'right' });

  if (mode === 'detailed') {
    doc.text('USO INTERNO', PW - MR, 23, { align: 'right' });
  }

  return H + 4;
}

function drawSectionTitle(doc: PdfDoc, label: string, y: number): number {
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text(label, ML + CW / 2, y + 3.8, { align: 'center' });
  return y + 5.5;
}

/** Bloco com pares label/value em colunas — padrão CARGA/MOTORISTA do OC */
function drawFieldsBlock(
  doc: PdfDoc,
  cells: { label: string; value: string }[],
  y: number,
  height = 14
): number {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, height);

  const colW = CW / cells.length;
  cells.forEach((cell, i) => {
    const x = ML + i * colW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.25);
      doc.line(x, y, x, y + height);
    }
    const innerW = colW - 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(cell.label, x + 2, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(cell.value, innerW) as string[];
    doc.text(lines[0] ?? '', x + 2, y + 10.5);
  });

  return y + height + 1;
}

function drawClientBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const H = 14;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CLIENTE / EMBARCADOR', ML + 2, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(payload.client_name || '—', CW - 6) as string[];
  doc.text(lines[0] ?? '', ML + 2, y + 11);

  return y + H + 1;
}

function drawRouteBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const modality = payload.freight_modality;
  const modalityLabel =
    modality === 'lotacao' ? 'LOTAÇÃO' : modality === 'fracionado' ? 'FRACIONADO' : '—';
  const freightTypeLabel = (payload.freight_type ?? '').toUpperCase() || '—';
  const tipoFrete =
    freightTypeLabel === '—'
      ? modalityLabel
      : modalityLabel === '—'
        ? freightTypeLabel
        : `${freightTypeLabel} - ${modalityLabel}`;

  return drawFieldsBlock(
    doc,
    [
      { label: 'ORIGEM', value: payload.origin ?? '—' },
      { label: 'DESTINO', value: payload.destination ?? '—' },
      { label: 'TIPO FRETE', value: tipoFrete },
      {
        label: 'DISTÂNCIA',
        value: payload.km_distance != null ? fmtUnit(payload.km_distance, 'km') : '—',
      },
    ],
    y
  );
}

function drawCargoBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  return drawFieldsBlock(
    doc,
    [
      { label: 'TIPO DE CARGA', value: humanizeCargoType(payload.cargo_type) },
      { label: 'PESO', value: formatWeight(payload.weight) },
      { label: 'VOLUME', value: payload.volume != null ? fmtUnit(payload.volume, 'm³') : '—' },
      {
        label: 'COLETA ESTIMADA',
        value: payload.estimated_loading_date
          ? fmtDate(payload.estimated_loading_date)
          : 'A CONFIRMAR',
      },
    ],
    y
  );
}

function drawPricingBlock(
  doc: PdfDoc,
  payload: QuotePdfPayload,
  mode: QuotePdfMode,
  y: number
): number {
  const bd = payload.pricing_breakdown;
  const rows: string[][] = [];

  if (bd?.components) {
    const c = bd.components;
    const p = bd.profitability;
    if ((c.toll ?? 0) > 0) rows.push(['Pedágio', formatCurrency(c.toll ?? 0)]);
    if ((c.aluguelMaquinas ?? 0) > 0)
      rows.push(['Aluguel de Equipamentos', formatCurrency(c.aluguelMaquinas ?? 0)]);
    if ((p?.custosDescarga ?? 0) > 0)
      rows.push(['Carga / Descarga', formatCurrency(p?.custosDescarga ?? 0)]);
    if ((c.waitingTimeCost ?? 0) > 0)
      rows.push(['Estadia / Hora Parada', formatCurrency(c.waitingTimeCost ?? 0)]);
    if ((c.insurance ?? 0) > 0) rows.push(['Seguro', formatCurrency(c.insurance ?? 0)]);

    if (mode === 'detailed') {
      if ((c.baseFreight ?? 0) > 0) rows.push(['Frete Base', formatCurrency(c.baseFreight ?? 0)]);
      if ((c.gris ?? 0) > 0) rows.push(['GRIS', formatCurrency(c.gris ?? 0)]);
      if ((c.tso ?? 0) > 0) rows.push(['TSO', formatCurrency(c.tso ?? 0)]);
      if ((c.rctrc ?? 0) > 0) rows.push(['RCTR-C', formatCurrency(c.rctrc ?? 0)]);
      if ((c.adValorem ?? 0) > 0) rows.push(['Ad Valorem', formatCurrency(c.adValorem ?? 0)]);
      if ((c.tde ?? 0) > 0) rows.push(['TDE', formatCurrency(c.tde ?? 0)]);
      if ((c.tear ?? 0) > 0) rows.push(['TEAR', formatCurrency(c.tear ?? 0)]);
      if ((c.dispatchFee ?? 0) > 0)
        rows.push(['Taxa de Despacho', formatCurrency(c.dispatchFee ?? 0)]);
      if ((c.conditionalFeesTotal ?? 0) > 0)
        rows.push(['Taxas Condicionais', formatCurrency(c.conditionalFeesTotal ?? 0)]);
    }
  }

  if (rows.length === 0) return y;

  const rowH = 6;
  const totalH = rows.length * rowH;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, totalH);

  rows.forEach((row, i) => {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(...C.light);
      doc.rect(ML + 0.25, ry + 0.25, CW - 0.5, rowH - 0.5, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(row[0], ML + 3, ry + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(row[1], PW - MR - 3, ry + 4, { align: 'right' });
  });

  return y + totalH + 1;
}

function drawTotalBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const H = 13;
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, 3, H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text('VALOR TOTAL DA PROPOSTA', ML + 7, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.orangeLight);
  doc.text(formatCurrency(Number(payload.value ?? 0)), PW - MR - 3, y + 9, { align: 'right' });

  return y + H + 1;
}

function drawPaymentBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  if (!payload.payment_term_name && !payload.payment_method_label) return y;
  return drawFieldsBlock(
    doc,
    [
      { label: 'CONDIÇÃO', value: payload.payment_term_name ?? '—' },
      { label: 'FORMA DE PAGAMENTO', value: payload.payment_method_label ?? '—' },
    ],
    y
  );
}

function drawValidityBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const validity = payload.validity_date
    ? `VÁLIDA ATÉ ${fmtDate(payload.validity_date)}`
    : '5 DIAS ÚTEIS A PARTIR DA EMISSÃO';

  return drawFieldsBlock(
    doc,
    [
      { label: 'EMITIDA EM', value: fmtDate(new Date().toISOString()) },
      { label: 'VALIDADE', value: validity },
    ],
    y
  );
}

function drawTextBlock(
  doc: PdfDoc,
  text: string | null | undefined,
  y: number,
  height = 18
): number {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, height);
  if (text) {
    const lines = doc.splitTextToSize(text, CW - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    doc.text(lines.slice(0, 6) as string[], ML + 3, y + 5);
  }
  return y + height + 1;
}

function drawFooter(doc: PdfDoc): void {
  const ph = doc.internal.pageSize.getHeight();
  const fh = 9;
  doc.setFillColor(...C.navy);
  doc.rect(0, ph - fh, PW, fh, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, ph - fh, PW, 1, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 195, 215);
  doc.text(
    VECTRA.email
      ? `VECTRA HUB - ${VECTRA.phone} | ${VECTRA.email}`
      : `VECTRA HUB - ${VECTRA.phone}`,
    ML,
    ph - 3
  );
  doc.text('Pagina 1/1', PW - MR, ph - 3, { align: 'right' });
}

// ── Main ───────────────────────────────────────────────────────────────────────

const toFilename = (code: string | null, mode: QuotePdfMode): string =>
  `cotacao-${(code || 'cotacao').replace(/[^\w-]+/g, '-')}-${mode === 'simplified' ? 'cliente' : 'interno'}.pdf`;

export async function generateQuotePdf({
  quote,
  mode,
}: {
  quote: QuotePdfPayload;
  mode: QuotePdfMode;
}): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = await loadLogoBase64();

  let y = drawHeader(doc, quote, mode, logo);
  y += 2;

  if (mode === 'detailed' && quote.antt_compliance?.below) {
    drawWatermark(doc, 'ABAIXO DO PISO ANTT');
  }

  y = drawSectionTitle(doc, 'CLIENTE', y);
  y = drawClientBlock(doc, quote, y);

  y = drawSectionTitle(doc, 'ROTA', y);
  y = drawRouteBlock(doc, quote, y);

  y = drawSectionTitle(doc, 'CARGA', y);
  y = drawCargoBlock(doc, quote, y);

  y = drawSectionTitle(doc, 'DETALHAMENTO DE CUSTOS', y);
  y = drawPricingBlock(doc, quote, mode, y);

  y = drawTotalBlock(doc, quote, y);

  if (quote.payment_term_name || quote.payment_method_label) {
    y = drawSectionTitle(doc, 'CONDIÇÃO DE PAGAMENTO', y);
    y = drawPaymentBlock(doc, quote, y);
  }

  y = drawSectionTitle(doc, 'VALIDADE', y);
  y = drawValidityBlock(doc, quote, y);

  if (quote.notes?.trim()) {
    y = drawSectionTitle(doc, 'OBSERVAÇÕES', y);
    y = drawTextBlock(doc, quote.notes, y, 18);
  }

  drawFooter(doc);
  void autoTable;

  return { blob: doc.output('blob'), fileName: toFilename(quote.quote_code, mode) };
}
