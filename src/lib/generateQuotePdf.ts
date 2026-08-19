import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatCurrency,
  formatDate,
  formatCnpjDisplay,
  formatCpfDisplay,
  formatPhoneDisplay,
} from '@/lib/formatters';
import type { StoredPricingBreakdown } from '@/lib/freightCalculator';
import { loadVectraPdfLogo } from '@/lib/pdfLogo';
import { buildCanonicalFilename, resolveFreightPayerName } from '@/lib/canonical-doc-ref';

type QuotePdfMode = 'simplified' | 'detailed';

export interface QuotePdfParty {
  name: string;
  cnpj?: string | null;
  cpf?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  address_number?: string | null;
  address_neighborhood?: string | null;
  zip_code?: string | null;
}

/** @deprecated use QuotePdfParty */
export type QuotePdfShipper = QuotePdfParty & {
  trade_name?: string | null;
  cnae_main_code?: string | null;
  cnae_main_description?: string | null;
  legal_representative_name?: string | null;
  partners?: unknown;
};

export interface QuotePdfRouteStop {
  sequence: number;
  stop_type: 'origin' | 'stop' | 'destination' | string;
  name?: string | null;
  cnpj?: string | null;
  cep?: string | null;
  city_uf?: string | null;
  label?: string | null;
  planned_km_from_prev?: number | null;
}

export interface QuotePdfPayload {
  id: string;
  quote_code: string | null;
  client_name: string;
  origin: string | null;
  destination: string | null;
  origin_cep?: string | null;
  destination_cep?: string | null;
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
  /** Cliente (cadastro clients) — mesmo layout do embarcador */
  client?: QuotePdfParty | null;
  client_email_fallback?: string | null;
  /** Embarcador (cadastro shippers / Shippers.tsx) */
  shipper?: QuotePdfParty | null;
  shipper_name_fallback?: string | null;
  shipper_email_fallback?: string | null;
  /** Paradas intermediárias persistidas em quote_route_stops */
  route_stops?: QuotePdfRouteStop[];
  event_flag?: string | null;
  pedagio_estimado?: number | null;
  fair_disclaimer?: boolean;
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
  name: 'VECTRA HUB LTDA',
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

async function loadLogoBase64(): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  return loadVectraPdfLogo();
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
  logo: { dataUrl: string; format: 'JPEG' | 'PNG' } | null
): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, ML, 3, 22, 22);
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
  } else if (payload.event_flag) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.orangeLight);
    doc.text(payload.event_flag, PW - MR, 23, { align: 'right' });
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
  // gap abaixo da barra — evita texto colado/sobreposto
  return y + 8;
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
    const lines = doc.splitTextToSize(upper(cell.value), innerW) as string[];
    doc.text(lines[0] ?? '', x + 2, y + 10.5);
  });

  return y + height + 1;
}

function upper(v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  return String(v).toLocaleUpperCase('pt-BR');
}

function formatDocId(cnpj?: string | null, cpf?: string | null | number): string {
  if (cpf != null && String(cpf).trim() !== '') {
    return formatCpfDisplay(String(cpf)) || String(cpf);
  }
  if (cnpj) return formatCnpjDisplay(cnpj) || cnpj;
  return '—';
}

function formatCep(cep?: string | null): string {
  if (!cep) return '—';
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return upper(cep);
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function buildLocation(p: Partial<QuotePdfParty> | null | undefined): string {
  if (!p) return '—';
  const parts = [
    p.address,
    p.address_number,
    p.address_neighborhood,
    [p.city, p.state].filter(Boolean).join('/'),
    p.zip_code ? `CEP ${formatCep(p.zip_code)}` : null,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  const cityUf = [p.city, p.state].filter(Boolean).join('/');
  return cityUf || '—';
}

function buildContact(p: Partial<QuotePdfParty> | null | undefined): string {
  if (!p) return '—';
  const phone = formatPhoneDisplay(p.phone ?? null) || p.phone;
  const parts = [p.contact_name, phone].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

function stopTypeLabel(stopType: string, indexAmongStops: number): string {
  if (stopType === 'origin') return 'ORIGEM';
  if (stopType === 'destination') return 'DESTINO';
  return `PARADA ${indexAmongStops}`;
}

/** Quebra página se bloco não couber; retorna y atualizado. */
function ensureSpace(doc: PdfDoc, y: number, needMm: number): number {
  const ph = doc.internal.pageSize.getHeight();
  const bottom = 18;
  if (y + needMm <= ph - bottom) return y;
  doc.addPage();
  return 14;
}

function drawKeyValueRows(
  doc: PdfDoc,
  rows: { label: string; value: string }[],
  y: number
): number {
  const rowH = 7;
  const blockH = rows.length * rowH + 2;
  y = ensureSpace(doc, y, blockH);

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, blockH);

  rows.forEach((row, i) => {
    const yy = y + 5 + i * rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(row.label, ML + 2, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(upper(row.value), CW - 52) as string[];
    doc.text(lines[0] ?? '—', ML + 48, yy);
  });

  return y + blockH + 1;
}

/** Layout único: nome · cpf/cnpj · contato · e-mail · localização */
function drawPartyBlock(
  doc: PdfDoc,
  nameLabel: 'CLIENTE' | 'EMBARCADOR',
  party: QuotePdfParty | null | undefined,
  nameFallback: string,
  emailFallback: string | null | undefined,
  y: number
): number {
  const name = party?.name || nameFallback || '—';
  const rows = [
    { label: nameLabel, value: name },
    { label: 'CPF / CNPJ', value: formatDocId(party?.cnpj, party?.cpf) },
    { label: 'CONTATO', value: buildContact(party) },
    { label: 'E-MAIL', value: party?.email || emailFallback || '—' },
    { label: 'LOCALIZAÇÃO', value: buildLocation(party) },
  ];
  return drawKeyValueRows(doc, rows, y);
}

function drawClientBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  return drawPartyBlock(
    doc,
    'CLIENTE',
    payload.client,
    payload.client_name,
    payload.client_email_fallback,
    y
  );
}

function drawShipperBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  return drawPartyBlock(
    doc,
    'EMBARCADOR',
    payload.shipper,
    payload.shipper_name_fallback || '—',
    payload.shipper_email_fallback,
    y
  );
}

function buildItinerary(payload: QuotePdfPayload): QuotePdfRouteStop[] {
  const mid = [...(payload.route_stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const origin: QuotePdfRouteStop = {
    sequence: -1,
    stop_type: 'origin',
    name: payload.shipper?.name || payload.shipper_name_fallback || null,
    city_uf: payload.origin,
    cep: payload.origin_cep ?? null,
    label: 'Coleta / origem',
  };
  const destination: QuotePdfRouteStop = {
    sequence: 9999,
    stop_type: 'destination',
    name: payload.client?.name || payload.client_name,
    city_uf: payload.destination,
    cep: payload.destination_cep ?? null,
    label: 'Entrega / destino',
  };

  const hasTypedEnds = mid.some((s) => s.stop_type === 'origin' || s.stop_type === 'destination');
  if (hasTypedEnds && mid.length > 0) return mid;

  return [origin, ...mid.map((s, i) => ({ ...s, sequence: i })), destination];
}

function drawItineraryBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const points = buildItinerary(payload);
  const midCount = points.filter((p) => p.stop_type === 'stop').length;
  const legsKm = points.reduce((acc, p) => acc + (Number(p.planned_km_from_prev) || 0), 0);
  const totalKm =
    payload.km_distance != null && payload.km_distance > 0 ? Number(payload.km_distance) : legsKm;

  // subtítulo com gap claro após a barra de seção
  y = ensureSpace(doc, y, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  const caption =
    midCount > 0
      ? `ROTEIRO COM ${midCount} PARADA(S) INTERMEDIÁRIA(S) · ${points.length} PONTOS`
      : 'ROTEIRO DIRETO (ORIGEM → DESTINO)';
  doc.text(caption, ML, y + 3);
  y += 6;

  const headH = 6;
  const rowH = 8;
  const totalRowH = 7;
  y = ensureSpace(doc, y, headH + rowH + totalRowH);

  doc.setFillColor(...C.light);
  doc.rect(ML, y, CW, headH, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, headH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  const cols = [22, 42, 58, 28, 36];
  const headers = ['TIPO', 'LOCAL', 'DESTINATÁRIO / NOME', 'CEP', 'KM TRECHO'];
  let x = ML + 1.5;
  headers.forEach((h, i) => {
    doc.text(h, x, y + 4);
    x += cols[i];
  });
  y += headH;

  let stopIdx = 0;
  points.forEach((p, i) => {
    y = ensureSpace(doc, y, rowH);
    if (p.stop_type === 'stop') stopIdx += 1;
    const tipo = stopTypeLabel(p.stop_type, stopIdx);
    const local = upper(p.city_uf || p.label || '—');
    const nome = upper(p.name || '—');
    const cep = formatCep(p.cep);
    const km = p.planned_km_from_prev != null ? upper(fmtUnit(p.planned_km_from_prev, 'km')) : '—';

    if (i % 2 === 1) {
      doc.setFillColor(252, 253, 255);
      doc.rect(ML, y, CW, rowH, 'F');
    }
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH, ML + CW, y + rowH);

    const vals = [tipo, local, nome, cep, km];
    x = ML + 1.5;
    vals.forEach((v, vi) => {
      doc.setFont('helvetica', vi === 0 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      const lines = doc.splitTextToSize(v, cols[vi] - 2) as string[];
      doc.text(lines[0] ?? '—', x, y + 5.2);
      x += cols[vi];
    });
    y += rowH;
  });

  // linha total km
  y = ensureSpace(doc, y, totalRowH);
  doc.setFillColor(...C.light);
  doc.rect(ML, y, CW, totalRowH, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, totalRowH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text('TOTAL KM', ML + 1.5, y + 4.8);
  doc.text(totalKm > 0 ? upper(fmtUnit(totalKm, 'km')) : '—', ML + CW - 1.5, y + 4.8, {
    align: 'right',
  });
  y += totalRowH + 2;

  return y;
}

function drawRouteSummaryBlock(doc: PdfDoc, payload: QuotePdfPayload, y: number): number {
  const modality = payload.freight_modality;
  const modalityLabel =
    modality === 'lotacao' ? 'LOTAÇÃO' : modality === 'fracionado' ? 'FRACIONADO' : '';
  const freightTypeLabel = (payload.freight_type ?? '').trim().toUpperCase();

  let tipoFrete = '—';
  if (freightTypeLabel && modalityLabel) {
    tipoFrete = `${freightTypeLabel} · ${modalityLabel}`;
  } else if (freightTypeLabel) {
    tipoFrete = freightTypeLabel;
  } else if (modalityLabel) {
    tipoFrete = modalityLabel;
  }

  const points = buildItinerary(payload);
  const mid = points.filter((p) => p.stop_type === 'stop').length;

  return drawFieldsBlock(
    doc,
    [
      { label: 'TIPO FRETE', value: tipoFrete },
      {
        label: 'DISTÂNCIA',
        value: payload.km_distance != null ? fmtUnit(payload.km_distance, 'km') : '—',
      },
      { label: 'PONTOS', value: String(points.length) },
      { label: 'PARADAS', value: String(mid) },
    ],
    y,
    16
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

  if (payload.fair_disclaimer && (payload.pedagio_estimado ?? 0) > 0) {
    rows.push(['Pedágio estimado', formatCurrency(payload.pedagio_estimado ?? 0)]);
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
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const ph = doc.internal.pageSize.getHeight();
    const fh = 9;
    doc.setFillColor(...C.navy);
    doc.rect(0, ph - fh, PW, fh, 'F');
    doc.setFillColor(...C.orange);
    doc.rect(0, ph - fh, PW, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 195, 215);
    doc.text(`${VECTRA.name} - ${VECTRA.phone} | ${VECTRA.email}`, ML, ph - 3);
    doc.text(`Pagina ${p}/${pageCount}`, PW - MR, ph - 3, { align: 'right' });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

/** Razão social do pagador do frete (CIF → embarcador; FOB → cliente). */
const resolveQuotePayerName = (quote: QuotePdfPayload): string =>
  resolveFreightPayerName(
    quote.freight_type,
    quote.client?.name ?? quote.client_name,
    quote.shipper?.name ?? quote.shipper_name_fallback
  );

const toFilename = (quote: QuotePdfPayload, mode: QuotePdfMode): string => {
  const code = quote.quote_code || 'COT';
  const modeLabel = mode === 'simplified' ? 'CLIENTE' : 'INTERNO';
  return buildCanonicalFilename(`${code}-${modeLabel}`, resolveQuotePayerName(quote));
};

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

  // Regra canônica: razão social do pagador do frete após o número do documento.
  const payerName = resolveQuotePayerName(quote);
  if (payerName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.navy);
    doc.text(`Pagador do frete: ${payerName}`, ML, y);
    y += 4;
  }

  if (mode === 'detailed' && quote.antt_compliance?.below) {
    drawWatermark(doc, 'ABAIXO DO PISO ANTT');
  }

  y = drawSectionTitle(doc, 'CLIENTE', y);
  y = drawClientBlock(doc, quote, y);

  y = ensureSpace(doc, y, 45);
  y = drawSectionTitle(doc, 'EMBARCADOR', y);
  y = drawShipperBlock(doc, quote, y);

  y = ensureSpace(doc, y, 35);
  y = drawSectionTitle(doc, 'ROTEIRO (PARADAS)', y);
  y = drawItineraryBlock(doc, quote, y);

  y = ensureSpace(doc, y, 22);
  y = drawSectionTitle(doc, 'RESUMO DA ROTA', y);
  y = drawRouteSummaryBlock(doc, quote, y);

  y = ensureSpace(doc, y, 22);
  y = drawSectionTitle(doc, 'CARGA', y);
  y = drawCargoBlock(doc, quote, y);

  y = ensureSpace(doc, y, 30);
  y = drawSectionTitle(doc, 'DETALHAMENTO DE CUSTOS', y);
  y = drawPricingBlock(doc, quote, mode, y);

  y = drawTotalBlock(doc, quote, y);

  if (quote.payment_term_name || quote.payment_method_label) {
    y = ensureSpace(doc, y, 20);
    y = drawSectionTitle(doc, 'CONDIÇÃO DE PAGAMENTO', y);
    y = drawPaymentBlock(doc, quote, y);
  }

  y = ensureSpace(doc, y, 18);
  y = drawSectionTitle(doc, 'VALIDADE', y);
  y = drawValidityBlock(doc, quote, y);

  if (quote.notes?.trim()) {
    y = ensureSpace(doc, y, 24);
    y = drawSectionTitle(doc, 'OBSERVAÇÕES', y);
    y = drawTextBlock(doc, quote.notes, y, 18);
  }

  drawFooter(doc);
  void autoTable;

  return { blob: doc.output('blob'), fileName: toFilename(quote, mode) };
}
