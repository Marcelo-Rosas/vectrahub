import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadVectraPdfLogo } from '@/lib/pdfLogo';
import { buildCanonicalFilename } from '@/lib/canonical-doc-ref';

export interface MdfeComprovanteCte {
  numero?: number | string | null;
  serie?: number | string | null;
  chave: string;
  os_number?: string | null;
  municipio_destino?: string | null;
  uf_destino?: string | null;
}

export interface MdfeComprovanteCiot {
  number: string;
  cnpjResponsavel?: string | null;
}

export interface MdfeComprovanteVpo {
  idVpo: string;
  cnpjPagador?: string | null;
  cnpjFornecedora?: string | null;
  valorReais?: number | null;
}

export interface MdfeComprovantePayload {
  mdfe_numero: number | string;
  mdfe_serie?: number | string | null;
  chave_mdfe: string;
  protocolo?: string | null;
  status?: string | null;
  uf_inicio?: string | null;
  uf_fim?: string | null;
  data_autorizacao?: string | null;
  vehicle_plate?: string | null;
  vehicle_plate_2?: string | null;
  driver_name?: string | null;
  driver_cpf?: string | null;
  trip_number?: string | null;
  os_numbers?: string[];
  ciots: MdfeComprovanteCiot[];
  vpo?: MdfeComprovanteVpo | null;
  ctes: MdfeComprovanteCte[];
  issued_at?: string | null;
}

type PdfDoc = jsPDF & { lastAutoTable?: { finalY?: number } };

const C = {
  navy: [27, 42, 74] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
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

const safe = (v: string | number | null | undefined): string => {
  if (v == null || v === '') return '—';
  return String(v);
};

function formatCnpj(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length !== 14) return safe(raw);
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCpf(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length !== 11) return safe(raw);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

function formatChave(raw: string): string {
  const d = String(raw).replace(/\D/g, '');
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
}

/**
 * Comprovante operacional do MDF-e (não substitui o DAMDFE Focus).
 * Lista CIOT, VPO e chaves dos CT-es agregados — o DAMDFE oficial omite isso.
 */
export async function generateMdfeComprovantePdf(
  payload: MdfeComprovantePayload
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = await loadVectraPdfLogo();

  // Header
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, 18, 'F');
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, ML, 2, 14, 14);
  }
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('VECTRA HUB  ·  CARGO', ML + (logo ? 18 : 0), 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(170, 187, 204);
  doc.text('Comprovante operacional de MDF-e', ML + (logo ? 18 : 0), 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.orange);
  doc.text('Pag. 1', PW - MR, 10, { align: 'right' });

  let y = 26;
  doc.setTextColor(...C.orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('COMPROVANTE OPERACIONAL — MANIFESTO', ML, y);
  y += 7;
  doc.setTextColor(...C.text);
  doc.setFontSize(16);
  doc.text(`MDF-e nº ${safe(payload.mdfe_numero)} / série ${safe(payload.mdfe_serie ?? 1)}`, ML, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  const meta = [
    `Emitido: ${safe(payload.issued_at ?? new Date().toLocaleString('pt-BR'))}`,
    payload.trip_number ? `Viagem: ${payload.trip_number}` : null,
    payload.os_numbers?.length ? `OS: ${payload.os_numbers.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(meta, ML, y);
  y += 5;

  // Resumo
  doc.setFillColor(255, 243, 232);
  doc.rect(ML, y, CW, 14, 'F');
  doc.setDrawColor(...C.orange);
  doc.setLineWidth(0.8);
  doc.line(ML, y, ML, y + 14);
  doc.setTextColor(...C.text);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo:', ML + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Documento auxiliar interno. Complementa o DAMDFE Focus (que não imprime CIOT nem chaves dos CT-es). ` +
      `Chave MDF-e e vínculos abaixo conferem com o XML autorizado na SEFAZ.`,
    ML + 3,
    y + 10,
    { maxWidth: CW - 6 }
  );
  y += 20;

  // Identificação
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: C.text, lineColor: C.border },
    headStyles: { fillColor: C.orange, textColor: C.white, fontStyle: 'bold' },
    bodyStyles: { fillColor: C.white },
    alternateRowStyles: { fillColor: C.light },
    head: [['Campo', 'Valor']],
    body: [
      ['Chave MDF-e', formatChave(payload.chave_mdfe)],
      ['Status', safe(payload.status)],
      ['Protocolo', safe(payload.protocolo)],
      ['Autorizado em', safe(payload.data_autorizacao)],
      ['UF início → fim', `${safe(payload.uf_inicio)} → ${safe(payload.uf_fim)}`],
      [
        'Veículo',
        [payload.vehicle_plate, payload.vehicle_plate_2].filter(Boolean).join(' + ') || '—',
      ],
      ['Condutor', `${safe(payload.driver_name)} · CPF ${formatCpf(payload.driver_cpf)}`],
    ],
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: CW - 40 } },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // CIOT
  doc.setFillColor(58, 58, 58);
  doc.rect(ML, y, CW, 7, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, 8, 7, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1', ML + 4, y + 5, { align: 'center' });
  doc.text('CIOT', ML + 11, y + 5);
  y += 10;

  if (payload.ciots.length === 0) {
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Nenhum CIOT no payload/XML deste MDF-e.', ML, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: C.text, lineColor: C.border },
      headStyles: { fillColor: C.orange, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.light },
      head: [['Nº CIOT', 'CNPJ responsável']],
      body: payload.ciots.map((c) => [c.number, formatCnpj(c.cnpjResponsavel)]),
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // VPO
  doc.setFillColor(58, 58, 58);
  doc.rect(ML, y, CW, 7, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, 8, 7, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2', ML + 4, y + 5, { align: 'center' });
  doc.text('Vale-Pedágio (VPO)', ML + 11, y + 5);
  y += 10;

  if (!payload.vpo?.idVpo) {
    doc.setTextColor(...C.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Sem VPO declarado neste MDF-e.', ML, y);
    y += 6;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: ML, right: MR },
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: C.text, lineColor: C.border },
      headStyles: { fillColor: C.orange, textColor: C.white, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: C.light },
      head: [['IdVpo / nCompra', 'Pagador', 'Fornecedora', 'Valor']],
      body: [
        [
          payload.vpo.idVpo,
          formatCnpj(payload.vpo.cnpjPagador),
          formatCnpj(payload.vpo.cnpjFornecedora),
          formatMoney(payload.vpo.valorReais),
        ],
      ],
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // CT-es
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(58, 58, 58);
  doc.rect(ML, y, CW, 7, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(ML, y, 8, 7, 'F');
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3', ML + 4, y + 5, { align: 'center' });
  doc.text(`CT-es vinculados (${payload.ctes.length})`, ML + 11, y + 5);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: C.text, lineColor: C.border },
    headStyles: { fillColor: C.orange, textColor: C.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: C.light },
    head: [['CT-e', 'OS', 'Destino', 'Chave de acesso']],
    body: payload.ctes.map((c) => [
      c.numero != null ? `#${c.numero}` : '—',
      safe(c.os_number),
      [c.municipio_destino, c.uf_destino].filter(Boolean).join(' / ') || '—',
      formatChave(c.chave),
    ]),
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 32 },
      2: { cellWidth: 36 },
      3: { cellWidth: CW - 84 },
    },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 10;

  // Nota
  doc.setDrawColor(...C.orange);
  doc.setFillColor(255, 243, 232);
  doc.roundedRect(ML, y, CW, 16, 1, 1, 'FD');
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Nota:', ML + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Este PDF é uso interno operacional. O documento fiscal oficial é o DAMDFE/XML Focus. ' +
      'Não altere o MDF-e já autorizado na SEFAZ para “incluir” estes campos na impressão.',
    ML + 3,
    y + 10,
    { maxWidth: CW - 6 }
  );

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, pageH - 14, PW - MR, pageH - 14);
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(
    'Vectra Cargo Transportes e Logística  |  Navegantes / Itajaí - SC  |  www.vectracargo.com.br',
    ML,
    pageH - 9
  );
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(204, 0, 0);
  doc.text('CONFIDENCIAL', PW - MR, pageH - 9, { align: 'right' });

  const fileName = buildCanonicalFilename(
    `MDFE-${payload.mdfe_numero}-comprovante`,
    payload.os_numbers?.[0] ?? 'VECTRA'
  );
  const blob = doc.output('blob');
  return { blob, fileName };
}
