import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { loadVectraPdfLogo } from '@/lib/pdfLogo';
import { buildCanonicalFilename } from '@/lib/canonical-doc-ref';
import type { TollPlaza } from '@/lib/freightCalculator';
import { extractUfFromText, type RotaUfChain } from '@/lib/uf-percurso';
import { isVpoReciboOk, type VpoReciboViagem } from '@/lib/vpo-recibo';
import { labelVpoTipoViagem } from '@/lib/vpo-emissores';

export interface RotaPdfStop {
  sequence: number;
  stop_type: 'origin' | 'stop' | 'destination' | string;
  name?: string | null;
  city_uf?: string | null;
  cep?: string | null;
}

export interface RotaPdfPayload {
  os_number: string;
  quote_code?: string | null;
  freight_type?: string | null;
  payer_name?: string | null;
  issued_at?: string | null;
  issued_by_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  km_distance?: number | null;
  driver_name?: string | null;
  vehicle_plate?: string | null;
  vehicle_label?: string | null;
  antt?: string | null;
  axes_count?: number | null;
  vpo_emissor?: string | null;
  vpo_tag?: string | null;
  vpo_tipo_vale?: string | null;
  vpo_tipo_viagem?: string | null;
  vpo_id_antt?: string | null;
  vpo_codigo_viagem?: string | null;
  vpo_recibo?: VpoReciboViagem | null;
  plazas: TollPlaza[];
  stops: RotaPdfStop[];
  uf_chain: RotaUfChain;
  toll_total?: number | null;
  toll_tag_total?: number | null;
}

type PdfDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

const C = {
  navy: [27, 42, 74] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
  orangeLight: [249, 200, 150] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [30, 35, 45] as [number, number, number],
  muted: [100, 110, 130] as [number, number, number],
  light: [246, 248, 251] as [number, number, number],
  border: [200, 206, 214] as [number, number, number],
  chipMid: [58, 58, 58] as [number, number, number],
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

const safe = (v: string | number | null | undefined): string => {
  if (v == null || v === '') return '—';
  return String(v);
};

const upper = (v: string | null | undefined): string => {
  if (v == null || v === '') return '—';
  return String(v).toLocaleUpperCase('pt-BR');
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  try {
    return formatDate(d);
  } catch {
    return '';
  }
};

const fmtKm = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(v))} km`;
};

/** SemParar "IVECO CAT>1 ECTECTOR - CAT 03- 03 EIXOS ROD DUPLA" → "IVECO ECTECTOR". */
export function vehicleBrandModel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  s = s.replace(/\s*[-–]\s*CAT\b.*$/i, '');
  s = s.replace(/\bCAT\s*>\s*\d+\b/gi, '');
  s = s.replace(/\bCAT\s*\d+(?:\s*[-–]\s*\d+)?\b/gi, '');
  s = s.replace(/\b\d+\s*EIXOS?\b/gi, '');
  s = s.replace(/\bROD(?:ADO)?\s*DUPLA\b/gi, '');
  s = s.replace(/[()]/g, ' ');
  s = s.replace(/\s*[-–/,.]+\s*$/g, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s || null;
}

type EnsureSpace = (y: number, needMm: number) => number;

const HEADER_H = 32;
const FOOTER_H = 18;
/** Título seção (5.5) + folga + 1ª linha de conteúdo. */
const SECTION_TITLE_H = 8;

function makeEnsureSpace(
  doc: PdfDoc,
  payload: RotaPdfPayload,
  logo: { dataUrl: string; format: 'JPEG' | 'PNG' } | null
): EnsureSpace {
  return (y, needMm) => {
    const ph = doc.internal.pageSize.getHeight();
    if (y + needMm <= ph - FOOTER_H) return y;
    doc.addPage();
    return drawHeader(doc, payload, logo);
  };
}

function drawHeader(
  doc: PdfDoc,
  payload: RotaPdfPayload,
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
  doc.text('ROTA', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`No ${payload.os_number}`, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissao: ${fmtDate(payload.issued_at ?? new Date().toISOString())}`, PW - MR, 19, {
    align: 'right',
  });
  if (payload.issued_by_name) {
    doc.text(`Usuario: ${payload.issued_by_name}`, PW - MR, 23, { align: 'right' });
  }

  return H + 4;
}

function drawSectionTitle(
  doc: PdfDoc,
  label: string,
  y: number,
  es: EnsureSpace,
  keepWithMm = 18
): number {
  y = es(y, SECTION_TITLE_H + keepWithMm);
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text(label, ML + CW / 2, y + 3.8, { align: 'center' });
  return y + SECTION_TITLE_H;
}

function drawFieldsBlock(
  doc: PdfDoc,
  cells: { label: string; value: string; weight?: number }[],
  y: number,
  es: EnsureSpace,
  height = 14
): number {
  y = es(y, height + 2);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, height);

  const weights = cells.map((c) => (c.weight && c.weight > 0 ? c.weight : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || cells.length;
  let x = ML;
  cells.forEach((cell, i) => {
    const colW = (weights[i] / weightSum) * CW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.25);
      doc.line(x, y, x, y + height);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(cell.label, x + 2, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(upper(cell.value), colW - 4) as string[];
    doc.text(lines[0] ?? '—', x + 2, y + 10.5);
    x += colW;
  });

  return y + height + 1;
}

function stopTypeLabel(stopType: string, stopIdx: number): string {
  if (stopType === 'origin') return 'ORIGEM';
  if (stopType === 'destination') return 'DESTINO';
  return `PARADA ${stopIdx}`;
}

function buildStops(payload: RotaPdfPayload): RotaPdfStop[] {
  const mid = [...(payload.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const hasEnds = mid.some((s) => s.stop_type === 'origin' || s.stop_type === 'destination');
  if (hasEnds && mid.length > 0) return mid;
  return [
    { sequence: 0, stop_type: 'origin', city_uf: payload.origin ?? null, name: null },
    ...mid,
    { sequence: 9999, stop_type: 'destination', city_uf: payload.destination ?? null, name: null },
  ];
}

function drawUfChain(doc: PdfDoc, chain: RotaUfChain, y: number, es: EnsureSpace): number {
  y = es(y, 22);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  const boxTop = y;
  let x = ML + 2;
  const chipW = 12;
  const chipH = 8;
  let rowY = y + 3;
  const ufs = chain.full.length > 0 ? chain.full : ['—'];

  ufs.forEach((uf, i) => {
    if (x + chipW + 8 > ML + CW) {
      rowY += chipH + 3;
      x = ML + 2;
    }
    const isIni = i === 0;
    const isFim = i === ufs.length - 1 && ufs.length > 1;
    if (isIni) doc.setFillColor(...C.orange);
    else if (isFim) doc.setFillColor(...C.navy);
    else doc.setFillColor(...C.chipMid);
    doc.roundedRect(x, rowY, chipW, chipH, 1, 1, 'F');
    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(uf, x + chipW / 2, rowY + 5.4, { align: 'center' });
    x += chipW + 2;
    if (i < ufs.length - 1) {
      doc.setTextColor(...C.orange);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('>', x, rowY + 5.4);
      x += 5;
    }
  });

  const noteY = rowY + chipH + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  const destLabel = chain.destUfs.length ? chain.destUfs.join(' + ') : (chain.fim ?? '—');
  const midLabel = chain.mid.length ? chain.mid.join(' · ') : '—';
  const note = `Origem ${chain.ini ?? '—'} · destinos ${destLabel} · intermediarias UFPer: ${midLabel}`;
  const noteLines = doc.splitTextToSize(note, CW - 4) as string[];
  doc.text(noteLines, ML + 2, noteY + 3);
  const boxH = noteY + 3 + noteLines.length * 3.5 - boxTop + 2;
  doc.setDrawColor(...C.border);
  doc.rect(ML, boxTop, CW, boxH);
  return boxTop + boxH + 2;
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

export async function generateRotaPdf(
  payload: RotaPdfPayload
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = await loadVectraPdfLogo();
  const es = makeEnsureSpace(doc, payload, logo);

  let y = drawHeader(doc, payload, logo);
  y += 2;

  if (payload.payer_name?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.navy);
    doc.text(`Pagador do frete: ${payload.payer_name.trim()}`, ML, y);
    y += 4;
  }

  y = drawSectionTitle(doc, 'IDENTIFICACAO', y, es, 16);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'ORDEM DE SERVICO', value: payload.os_number, weight: 1.35 },
      { label: 'COTACAO', value: payload.quote_code ?? '—', weight: 1.25 },
      { label: 'TIPO FRETE', value: payload.freight_type ?? '—', weight: 0.55 },
      { label: 'ANTT', value: payload.antt ?? '—', weight: 0.9 },
      {
        label: 'EMISSAO',
        value: fmtDate(payload.issued_at ?? new Date().toISOString()) || '—',
        weight: 1.15,
      },
    ],
    y,
    es
  );
  y = drawFieldsBlock(
    doc,
    [
      { label: 'MOTORISTA / PROPRIETARIO', value: payload.driver_name ?? '—', weight: 2.2 },
      { label: 'PLACA', value: payload.vehicle_plate ?? '—', weight: 0.8 },
    ],
    y,
    es
  );
  y = drawFieldsBlock(doc, [{ label: 'VEICULO', value: payload.vehicle_label ?? '—' }], y, es, 12);

  y = drawSectionTitle(doc, 'PERCURSO UF', y, es, 22);
  y = drawUfChain(doc, payload.uf_chain, y, es);

  y = drawSectionTitle(doc, 'ROTEIRO', y, es, 14);
  const stops = buildStops(payload);
  let stopIdx = 0;
  stops.forEach((stop, i) => {
    if (stop.stop_type === 'stop') stopIdx += 1;
    y = drawFieldsBlock(
      doc,
      [
        { label: 'SEQ', value: String(i + 1).padStart(2, '0') },
        { label: 'TIPO', value: stopTypeLabel(stop.stop_type, stopIdx) },
        { label: 'LOCAL', value: stop.name || stop.city_uf || '—' },
        { label: 'UF', value: extractUfFromText(stop.city_uf) ?? '—' },
      ],
      y,
      es,
      12
    );
  });

  y = drawSectionTitle(doc, 'VALE PEDAGIO / TAG', y, es, 16);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'EMISSOR', value: payload.vpo_emissor ?? '—' },
      { label: 'TAG', value: payload.vpo_tag ?? '—' },
      { label: 'TIPO VALE', value: payload.vpo_tipo_vale ?? '—' },
      {
        label: 'TIPO ROTA VPO',
        value: labelVpoTipoViagem(payload.vpo_recibo?.tipo || payload.vpo_tipo_viagem),
      },
    ],
    y,
    es
  );
  const plazaCount = payload.plazas.length;
  const totalValor =
    payload.toll_total ?? payload.plazas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const totalTag =
    payload.toll_tag_total ?? payload.plazas.reduce((s, p) => s + (Number(p.valorTag) || 0), 0);
  y = drawFieldsBlock(
    doc,
    [
      {
        label: 'EIXOS',
        value: payload.axes_count != null ? String(payload.axes_count).padStart(2, '0') : '—',
      },
      { label: 'KM PREVISTO', value: fmtKm(payload.km_distance) },
      { label: 'PRACAS', value: plazaCount > 0 ? String(plazaCount) : '—' },
      { label: 'TOTAL TAG', value: plazaCount > 0 ? formatCurrency(totalTag) : '—' },
    ],
    y,
    es
  );

  y = drawSectionTitle(doc, 'COMPROVANTE VPO (RECIBO WEBROUTER)', y, es, 16);
  const recibo = payload.vpo_recibo;
  if (isVpoReciboOk(recibo)) {
    y = drawFieldsBlock(
      doc,
      [
        { label: 'STATUS', value: recibo?.status ?? '—' },
        { label: 'DATA COMPRA', value: recibo?.dataCompra ?? '—' },
        { label: 'VALOR RECIBO', value: formatCurrency(recibo?.valorTotal ?? null) },
        {
          label: 'TIPO VPO',
          value: labelVpoTipoViagem(recibo?.tipo || payload.vpo_tipo_viagem),
        },
      ],
      y,
      es
    );
    y = drawFieldsBlock(
      doc,
      [
        { label: 'EMISSOR RECIBO', value: recibo?.nomeEmissor || recibo?.emissor || '—' },
        { label: 'CNPJ EMISSOR', value: recibo?.cnpjEmissor ?? '—' },
        { label: 'TRANSPORTADOR', value: recibo?.nomeTransportador ?? '—' },
        { label: 'CNPJ TRANSPORTADOR', value: recibo?.cnpjTransportador ?? '—' },
      ],
      y,
      es
    );
    y = drawFieldsBlock(
      doc,
      [
        { label: 'IDVPO / ANTT', value: payload.vpo_id_antt ?? '—' },
        {
          label: 'COD. VIAGEM OSA',
          value: recibo?.codigoViagemOSA || payload.vpo_codigo_viagem || '—',
        },
        {
          label: 'ID VIAGEM OSA',
          value: recibo?.idViagemOSA != null ? String(recibo.idViagemOSA) : '—',
        },
        { label: 'ID RECIBO AILOG', value: recibo?.id != null ? String(recibo.id) : '—' },
      ],
      y,
      es
    );
  } else {
    y = drawFieldsBlock(
      doc,
      [
        {
          label: 'RECIBO',
          value:
            payload.vpo_id_antt || payload.vpo_codigo_viagem
              ? 'VPO emitido — recibo WebRouter ainda nao disponivel'
              : 'VPO nao emitido — emita na aba VPO para incluir o comprovante',
        },
      ],
      y,
      es,
      12
    );
  }

  y = drawSectionTitle(doc, 'PRACAS DE PEDAGIO', y, es, 28);
  if (plazaCount === 0) {
    y = drawFieldsBlock(
      doc,
      [{ label: 'PRACAS', value: 'Nenhuma praca registrada nesta OS' }],
      y,
      es,
      12
    );
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Praca', 'Cidade / UF', 'Valor', 'TAG']],
      body: payload.plazas.map((p, i) => [
        String(p.ordemPassagem || i + 1),
        safe(p.nome),
        [p.cidade, p.uf].filter(Boolean).join(' / ') || '—',
        formatCurrency(Number(p.valor) || 0),
        formatCurrency(Number(p.valorTag) || 0),
      ]),
      foot: [
        [
          '',
          '',
          `Total (${plazaCount} praca${plazaCount === 1 ? '' : 's'})`,
          formatCurrency(totalValor),
          formatCurrency(totalTag),
        ],
      ],
      theme: 'grid',
      showHead: 'everyPage',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.6,
        textColor: C.text,
        lineColor: C.border,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: C.orange,
        textColor: C.white,
        fontStyle: 'bold',
        halign: 'left',
      },
      footStyles: {
        fillColor: C.light,
        textColor: C.text,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [249, 249, 249] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
      },
      margin: { left: ML, right: MR, bottom: FOOTER_H - 2, top: HEADER_H + 2 },
      didDrawPage: (() => {
        let firstTablePage = true;
        return () => {
          if (firstTablePage) {
            firstTablePage = false;
            return;
          }
          drawHeader(doc, payload, logo);
        };
      })(),
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 3;
  }

  y = es(y, 28);
  doc.setFillColor(255, 243, 232);
  doc.setDrawColor(...C.orange);
  doc.setLineWidth(0.8);
  const note =
    'Orientacao ao motorista: passar somente na pista TAG. Nao pagar em dinheiro nas pracas listadas. ' +
    `Conferir placa ${upper(payload.vehicle_plate)} e TAG ${upper(payload.vpo_tag)} antes de sair. ` +
    'Desvio de rota fora deste percurso UF pode gerar recusa de averbacao / MDF-e. ' +
    `Em pane de TAG, ligar operacional Vectra: ${VECTRA.phone}.`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(68, 68, 68);
  const noteLines = doc.splitTextToSize(note, CW - 8) as string[];
  const noteH = noteLines.length * 3.6 + 6;
  doc.rect(ML, y, CW, noteH, 'FD');
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, 1.2, noteH, 'F');
  doc.text(noteLines, ML + 4, y + 4.5);

  drawFooter(doc);

  const fileName = buildCanonicalFilename(`ROTA-${payload.os_number}`, payload.payer_name);
  return { blob: doc.output('blob'), fileName };
}
