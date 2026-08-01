import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';
import type { NfeItem, NfeParty } from '@/lib/parseNfeXml';

export interface NfItemsReportPayload {
  os_number: string;
  nf_number: string;
  serie: string;
  issued_at: string;
  access_key: string | null;
  emit: NfeParty;
  dest: NfeParty;
  items: NfeItem[];
  /** Logo já em base64 (data URL). Quando ausente, faz fetch do asset Vite. */
  logoBase64Override?: string | null;
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
};

const PW = 210;
const ML = 12;
const MR = 12;
const CW = PW - ML - MR;

// Vectra HUB emissora — fixo (mesmo padrão da Ordem de Coleta)
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
  if (v == null || v === '') return '';
  return String(v);
};

/** Quantidade: inteiro quando exato, senão até 3 casas (sem zeros à direita). */
const fmtQty = (v: number | null | undefined): string => {
  if (v == null) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number(v));
};

const fmtCnpj = (v: string): string => {
  const d = (v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v || '';
};

const fmtCep = (v: string): string => {
  const d = (v || '').replace(/\D/g, '');
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : v || '';
};

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  try {
    return formatDate(d);
  } catch {
    return '';
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

// ── Drawers ────────────────────────────────────────────────────────────────────

function drawHeader(doc: PdfDoc, payload: NfItemsReportPayload, logoBase64: string | null): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', ML, 3, 22, 22);
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
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text('RELATORIO DE ITENS DA NF', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  const nf = payload.serie
    ? `NF ${payload.nf_number} / Serie ${payload.serie}`
    : `NF ${payload.nf_number}`;
  doc.text(nf, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissao: ${fmtDate(payload.issued_at) || '—'}`, PW - MR, 19, { align: 'right' });
  if (payload.os_number) {
    doc.text(`OS: ${payload.os_number}`, PW - MR, 23, { align: 'right' });
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

/** Bloco de "parte" (remetente/destinatário) — mesmo layout da Ordem de Coleta. */
function drawPartyBlock(doc: PdfDoc, party: NfeParty, y: number): number {
  const H = 22;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  const label = (t: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(t, x, yy);
  };
  const value = (t: string, x: number, yy: number, size = 8) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...C.text);
    doc.text(t, x, yy);
  };

  // Linha 1 — Razão social + telefone
  label('RAZAO SOCIAL:', ML + 2, y + 4);
  value(safe(party.name), ML + 26, y + 4, 8.5);
  label('TELEFONE:', PW - MR - 50, y + 4);
  value(safe(party.phone), PW - MR - 30, y + 4, 8.5);

  // Linha 2 — CNPJ/CPF + Endereço + Nº
  label('CNPJ/CPF:', ML + 2, y + 9);
  value(fmtCnpj(party.cnpj_cpf), ML + 18, y + 9);
  label('ENDERECO:', ML + 64, y + 9);
  const addr = doc.splitTextToSize(safe(party.address), 76) as string[];
  value(addr[0] ?? '', ML + 82, y + 9);
  label('No:', PW - MR - 22, y + 9);
  value(safe(party.address_number), PW - MR - 14, y + 9);

  // Linha 3 — CEP + Bairro + Cidade + UF
  label('CEP:', ML + 2, y + 14);
  value(fmtCep(party.zip), ML + 12, y + 14);
  label('BAIRRO:', ML + 40, y + 14);
  value(safe(party.neighborhood), ML + 54, y + 14);
  label('CIDADE:', ML + 110, y + 14);
  value(safe(party.city), ML + 124, y + 14);
  label('UF:', PW - MR - 14, y + 14);
  value(safe(party.uf), PW - MR - 8, y + 14);

  // Linha 4 — IE + Email
  label('IE:', ML + 2, y + 19);
  value(safe(party.ie) || 'ISENTO', ML + 12, y + 19);
  if (party.email) {
    label('EMAIL:', ML + 64, y + 19);
    value(safe(party.email), ML + 82, y + 19);
  }

  return y + H + 1;
}

function drawFooter(doc: PdfDoc, pageCurrent: number, pageTotal: number): void {
  const ph = doc.internal.pageSize.getHeight();
  const fh = 9;
  doc.setFillColor(...C.navy);
  doc.rect(0, ph - fh, PW, fh, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, ph - fh, PW, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 195, 215);
  doc.text('VECTRA HUB - Itajai/SC', ML, ph - 3);
  doc.text(`Pagina ${pageCurrent}/${pageTotal}`, PW - MR, ph - 3, { align: 'right' });
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function generateNfItemsReportPdf(payload: NfItemsReportPayload): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = payload.logoBase64Override ?? (await loadLogoBase64());

  let y = drawHeader(doc, payload, logo);
  y += 2;

  y = drawSectionTitle(doc, 'REMETENTE (EMITENTE DA NF)', y);
  y = drawPartyBlock(doc, payload.emit, y);

  y = drawSectionTitle(doc, 'DESTINATARIO', y);
  y = drawPartyBlock(doc, payload.dest, y);

  y += 1;
  y = drawSectionTitle(doc, 'ITENS DA NOTA FISCAL', y);

  const totalQty = payload.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

  autoTable(doc, {
    startY: y + 1,
    margin: { left: ML, right: MR },
    head: [['Codigo', 'Descricao', 'Qtd.']],
    body: payload.items.map((it) => [
      safe(it.code),
      safe(it.description),
      `${fmtQty(it.quantity)}${it.unit ? ` ${it.unit}` : ''}`,
    ]),
    foot: [['', `TOTAL — ${payload.items.length} item(ns)`, fmtQty(totalQty)]],
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 1.8,
      textColor: C.text,
      lineColor: C.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: C.navy,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    footStyles: { fillColor: C.light, textColor: C.navy, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 26, halign: 'right' },
    },
    didDrawPage: () => {
      // footer desenhado ao final com contagem real de páginas
    },
  });

  // Footer com numeração correta em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    drawFooter(doc, p, pages);
  }

  const fileName = `relatorio-itens-nf-${safe(payload.nf_number) || 's-n'}-${payload.os_number}.pdf`;
  doc.save(fileName);
}
