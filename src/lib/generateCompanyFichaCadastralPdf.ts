import { jsPDF } from 'jspdf';
import {
  formatCnpjDisplay,
  formatCpfDisplay,
  formatDate,
  formatPhoneDisplay,
} from '@/lib/formatters';
import { loadVectraPdfLogo } from '@/lib/pdfLogo';

/** Nome do arquivo no download — descrição pedida na rota Empresa. */
export const FICHA_CADASTRAL_FILE_NAME = 'Ficha Cadastral Vectra HUB.pdf';

export type CompanyFichaCadastralPayload = {
  legal_name: string;
  trade_name?: string | null;
  cnpj: string;
  state_registration?: string | null;
  municipal_registration?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  address_neighborhood?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  legal_representative_name?: string | null;
  legal_representative_cpf?: string | null;
  legal_representative_role?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_pix_key?: string | null;
  default_jurisdiction?: string | null;
  signature_city?: string | null;
  phone?: string | null;
  email?: string | null;
};

type PdfDoc = jsPDF;

const C = {
  navy: [27, 42, 74] as [number, number, number],
  orange: [232, 117, 26] as [number, number, number],
  orangeLight: [249, 200, 150] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  text: [30, 35, 45] as [number, number, number],
  muted: [100, 110, 130] as [number, number, number],
  border: [200, 206, 214] as [number, number, number],
};

const PW = 210;
const ML = 12;
const MR = 12;
const CW = PW - ML - MR;

const HEADER_FALLBACK = {
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
  if (v == null || String(v).trim() === '') return '—';
  return String(v).trim();
};

const upper = (v: string | null | undefined): string => {
  const s = safe(v);
  if (s === '—') return s;
  return s.toLocaleUpperCase('pt-BR');
};

export function formatCepDisplay(cep?: string | null): string {
  if (!cep) return '—';
  const d = cep.replace(/\D/g, '');
  if (d.length !== 8) return upper(cep);
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function buildCompanyAddressLine(p: CompanyFichaCadastralPayload): string {
  const street = [p.address_street, p.address_number].filter(Boolean).join(', ');
  const parts = [
    street,
    p.address_complement,
    p.address_neighborhood,
    [p.address_city, p.address_state].filter(Boolean).join('/'),
    p.address_zip ? `CEP ${formatCepDisplay(p.address_zip)}` : null,
  ].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(' · ') : '—';
}

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  try {
    return formatDate(d);
  } catch {
    return '';
  }
};

function drawHeader(
  doc: PdfDoc,
  payload: CompanyFichaCadastralPayload,
  logo: Awaited<ReturnType<typeof loadVectraPdfLogo>>
): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, ML, 3, 22, 22);
  }

  const name = safe(payload.legal_name) !== '—' ? payload.legal_name : HEADER_FALLBACK.name;
  const cnpj =
    formatCnpjDisplay(payload.cnpj) ||
    formatCnpjDisplay(HEADER_FALLBACK.cnpj) ||
    HEADER_FALLBACK.cnpj;
  const ie =
    safe(payload.state_registration) !== '—' ? payload.state_registration : HEADER_FALLBACK.ie;
  const street =
    safe(payload.address_street) !== '—' ? payload.address_street : HEADER_FALLBACK.address;
  const number =
    safe(payload.address_number) !== '—' ? payload.address_number : HEADER_FALLBACK.number;
  const city = safe(payload.address_city) !== '—' ? payload.address_city : HEADER_FALLBACK.city;
  const uf = safe(payload.address_state) !== '—' ? payload.address_state : HEADER_FALLBACK.uf;
  const phone = formatPhoneDisplay(payload.phone) || payload.phone || HEADER_FALLBACK.phone;
  const email = safe(payload.email) !== '—' ? payload.email : HEADER_FALLBACK.email;

  const ix = ML + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text(upper(name), ix, 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 215, 235);
  doc.text(`CNPJ: ${cnpj}    IE: ${ie}`, ix, 13);
  doc.text(`${upper(street)}, ${upper(number)} - ${upper(city)}/${upper(uf)}`, ix, 17.5);
  doc.text(`Fone: ${phone}    E-mail: ${email}`, ix, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('FICHA CADASTRAL', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text('VECTRA HUB', PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissao: ${fmtDate(new Date().toISOString())}`, PW - MR, 19, { align: 'right' });
  doc.text('DOCUMENTO', PW - MR, 23, { align: 'right' });

  return H + 6;
}

function drawSectionTitle(doc: PdfDoc, label: string, y: number): number {
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text(label, ML + CW / 2, y + 3.8, { align: 'center' });
  return y + 8;
}

function drawFieldsBlock(
  doc: PdfDoc,
  cells: { label: string; value: string; keepCase?: boolean }[],
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
    const display = cell.keepCase ? safe(cell.value) : upper(cell.value);
    const lines = doc.splitTextToSize(display, innerW) as string[];
    doc.text(lines.slice(0, 2), x + 2, y + 10);
  });

  return y + height + 1;
}

function drawKeyValueRows(
  doc: PdfDoc,
  rows: { label: string; value: string; keepCase?: boolean }[],
  y: number
): number {
  const rowH = 8;
  const blockH = rows.length * rowH + 2;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, blockH);

  rows.forEach((row, i) => {
    const yy = y + 5.5 + i * rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(row.label, ML + 2, yy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.text);
    const display = row.keepCase ? safe(row.value) : upper(row.value);
    const lines = doc.splitTextToSize(display, CW - 52) as string[];
    doc.text(lines[0] ?? '—', ML + 48, yy);
  });

  return y + blockH + 1;
}

function drawSignature(doc: PdfDoc, payload: CompanyFichaCadastralPayload, y: number): number {
  const H = 32;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  const city = safe(payload.signature_city) !== '—' ? payload.signature_city : payload.address_city;
  const date = fmtDate(new Date().toISOString());
  const rep = safe(payload.legal_representative_name);
  const role = safe(payload.legal_representative_role);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(`${upper(city)}, ${date}`, ML + 4, y + 8);

  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.3);
  const lineX = ML + CW / 2;
  doc.line(lineX - 40, y + 20, lineX + 40, y + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(rep === '—' ? 'REPRESENTANTE LEGAL' : upper(rep), lineX, y + 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(role === '—' ? 'Assinatura' : upper(role), lineX, y + 29, { align: 'center' });

  return y + H + 1;
}

function drawFooter(doc: PdfDoc, payload: CompanyFichaCadastralPayload): void {
  const pageCount = doc.getNumberOfPages();
  const name = safe(payload.legal_name) !== '—' ? payload.legal_name : HEADER_FALLBACK.name;
  const phone = formatPhoneDisplay(payload.phone) || payload.phone || HEADER_FALLBACK.phone;
  const email = safe(payload.email) !== '—' ? payload.email : HEADER_FALLBACK.email;

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
    doc.text(`${upper(name)} - ${phone} | ${email}`, ML, ph - 3);
    doc.text(`Pagina ${p}/${pageCount}`, PW - MR, ph - 3, { align: 'right' });
  }
}

export async function generateCompanyFichaCadastralPdf(
  payload: CompanyFichaCadastralPayload
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = await loadVectraPdfLogo();

  let y = drawHeader(doc, payload, logo);
  y += 2;

  y = drawSectionTitle(doc, 'IDENTIFICACAO', y);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'RAZAO SOCIAL', value: payload.legal_name },
      { label: 'NOME FANTASIA', value: payload.trade_name ?? '' },
    ],
    y,
    16
  );
  y = drawFieldsBlock(
    doc,
    [
      {
        label: 'CNPJ',
        value: formatCnpjDisplay(payload.cnpj) || payload.cnpj,
        keepCase: true,
      },
      { label: 'INSCRICAO ESTADUAL', value: payload.state_registration ?? '' },
      { label: 'INSCRICAO MUNICIPAL', value: payload.municipal_registration ?? '' },
    ],
    y
  );

  y = drawSectionTitle(doc, 'CONTATO', y);
  y = drawFieldsBlock(
    doc,
    [
      {
        label: 'TELEFONE',
        value: formatPhoneDisplay(payload.phone) || payload.phone || '',
        keepCase: true,
      },
      { label: 'E-MAIL', value: payload.email ?? '', keepCase: true },
    ],
    y
  );

  y = drawSectionTitle(doc, 'ENDERECO', y);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'LOGRADOURO', value: payload.address_street ?? '' },
      { label: 'NUMERO', value: payload.address_number ?? '' },
      { label: 'COMPLEMENTO', value: payload.address_complement ?? '' },
    ],
    y
  );
  y = drawFieldsBlock(
    doc,
    [
      { label: 'BAIRRO', value: payload.address_neighborhood ?? '' },
      { label: 'CIDADE', value: payload.address_city ?? '' },
      { label: 'UF', value: payload.address_state ?? '' },
      {
        label: 'CEP',
        value: formatCepDisplay(payload.address_zip),
        keepCase: true,
      },
    ],
    y
  );
  y = drawKeyValueRows(
    doc,
    [{ label: 'ENDERECO COMPLETO', value: buildCompanyAddressLine(payload) }],
    y
  );

  y = drawSectionTitle(doc, 'REPRESENTANTE LEGAL', y);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'NOME', value: payload.legal_representative_name ?? '' },
      {
        label: 'CPF',
        value:
          formatCpfDisplay(payload.legal_representative_cpf) ||
          payload.legal_representative_cpf ||
          '',
        keepCase: true,
      },
      { label: 'CARGO / FUNCAO', value: payload.legal_representative_role ?? '' },
    ],
    y,
    16
  );

  y = drawSectionTitle(doc, 'DADOS BANCARIOS', y);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'BANCO', value: payload.bank_name ?? '' },
      { label: 'AGENCIA', value: payload.bank_agency ?? '', keepCase: true },
    ],
    y
  );
  y = drawFieldsBlock(
    doc,
    [
      { label: 'CONTA CORRENTE', value: payload.bank_account ?? '', keepCase: true },
      { label: 'CHAVE PIX', value: payload.bank_pix_key ?? '', keepCase: true },
    ],
    y
  );

  y = drawSectionTitle(doc, 'FORO / ASSINATURA', y);
  y = drawFieldsBlock(
    doc,
    [
      { label: 'FORO', value: payload.default_jurisdiction ?? '' },
      { label: 'CIDADE DE ASSINATURA', value: payload.signature_city ?? '' },
    ],
    y
  );

  y += 2;
  y = drawSectionTitle(doc, 'DECLARACAO', y);
  y = drawSignature(doc, payload, y);

  drawFooter(doc, payload);

  return { blob: doc.output('blob'), fileName: FICHA_CADASTRAL_FILE_NAME };
}
