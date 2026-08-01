import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';

/**
 * Espelho Vectra do CT-e — NÃO é o DACTE oficial (esse é gerado pela SEFAZ/Focus
 * com layout legal fixo). Este PDF traz os MESMOS campos (do payload enviado +
 * chave/protocolo da SEFAZ) na identidade visual Vectra, para o cliente.
 * Layout espelhado do generateCollectionOrderPdf.ts (mesma família COT/OC/POD).
 */

export interface CtePdfParty {
  name?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  ie?: string | null;
  address?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
}

export interface CtePdfComponente {
  nome: string;
  valor: number;
}

/** Emitente (Vectra) — vem de company_settings (/empresa); não hardcoded. */
export interface CtePdfEmitente {
  name?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  address?: string | null;
  number?: string | null;
  city?: string | null;
  uf?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CtePdfPayload {
  /** Emitente; se ausente/campo vazio, cai no default Vectra. */
  emitente?: CtePdfEmitente;
  numero: number | string;
  serie: number | string;
  chave?: string | null;
  protocolo?: string | null;
  status_label: string;
  status_sefaz?: string | null;
  ambiente: 'homolog' | 'prod';
  cfop?: number | string | null;
  natureza_operacao?: string | null;
  data_autorizacao?: string | null;
  /** Rótulo do tomador (Remetente/Expedidor/Recebedor/Destinatário). */
  tomador_label?: string | null;
  remetente: CtePdfParty;
  destinatario: CtePdfParty;
  valor_total?: number | null;
  valor_receber?: number | null;
  componentes?: CtePdfComponente[];
  valor_carga?: number | null;
  produto_predominante?: string | null;
  municipio_inicio?: string | null;
  uf_inicio?: string | null;
  municipio_fim?: string | null;
  uf_fim?: string | null;
  os_number?: string | null;
  quote_code?: string | null;
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

// Fallback do emitente — usado só quando company_settings (/empresa) não traz o campo.
const VECTRA_DEFAULT = {
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

/** Resolve cada campo do emitente: usa company_settings se não-vazio, senão default. */
function resolveEmitente(e?: CtePdfEmitente): typeof VECTRA_DEFAULT {
  const pick = (v: string | null | undefined, def: string) =>
    v != null && String(v).trim() !== '' ? String(v) : def;
  return {
    name: pick(e?.name, VECTRA_DEFAULT.name),
    cnpj: pick(e?.cnpj, VECTRA_DEFAULT.cnpj),
    ie: pick(e?.ie, VECTRA_DEFAULT.ie),
    address: pick(e?.address, VECTRA_DEFAULT.address),
    number: pick(e?.number, VECTRA_DEFAULT.number),
    city: pick(e?.city, VECTRA_DEFAULT.city),
    uf: pick(e?.uf, VECTRA_DEFAULT.uf),
    phone: pick(e?.phone, VECTRA_DEFAULT.phone),
    email: pick(e?.email, VECTRA_DEFAULT.email),
  };
}

const safe = (v: string | number | null | undefined): string =>
  v == null || v === '' ? '' : String(v);

const fmtBRL = (v: number | null | undefined): string =>
  v == null
    ? 'R$ 0,00'
    : `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))}`;

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '';
  try {
    return formatDate(d);
  } catch {
    return '';
  }
};

/** Formata a chave de 44 dígitos em blocos de 4 para leitura. */
const fmtChave = (c: string | null | undefined): string =>
  !c
    ? ''
    : c
        .replace(/\D/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim();

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

function drawWatermark(doc: PdfDoc, text: string): void {
  const ph = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(60);
  doc.setTextColor(180, 130, 30);
  doc.setGState(
    new (doc as unknown as { GState: new (o: object) => unknown }).GState({ opacity: 0.12 })
  );
  doc.text(text, PW / 2, ph / 2, { align: 'center', angle: 30 });
  doc.restoreGraphicsState();
}

function drawHeader(doc: PdfDoc, p: CtePdfPayload, logo: string | null): number {
  const H = 28;
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  if (logo) doc.addImage(logo, 'PNG', ML, 3, 22, 22);

  const v = resolveEmitente(p.emitente);
  const ix = ML + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text(v.name, ix, 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 215, 235);
  doc.text(`CNPJ: ${v.cnpj}    IE: ${v.ie}`, ix, 12.5);
  doc.text(`${v.address}, ${v.number} - ${v.city}/${v.uf}`, ix, 16.5);
  const contato = [v.phone ? `Fone: ${v.phone}` : '', v.email ? `E-mail: ${v.email}` : '']
    .filter(Boolean)
    .join('    ');
  doc.text(contato, ix, 20.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text('CONHECIMENTO DE TRANSPORTE (CT-e)', PW - MR, 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`No ${p.numero}  Serie ${p.serie}`, PW - MR, 14.5, { align: 'right' });
  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  if (p.data_autorizacao) {
    doc.text(`Autorizado: ${fmtDate(p.data_autorizacao)}`, PW - MR, 19, { align: 'right' });
  }
  const ref = [p.os_number, p.quote_code].filter(Boolean).join('  ');
  if (ref) doc.text(ref, PW - MR, 23, { align: 'right' });

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

function kv(doc: PdfDoc, label: string, value: string, x: number, y: number, labelW = 0): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(value, x + (labelW || doc.getTextWidth(label) + 2), y);
}

function drawIdentBlock(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const H = 27;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  kv(doc, 'CHAVE DE ACESSO:', fmtChave(p.chave) || '—', ML + 2, y + 5, 30);
  kv(doc, 'PROTOCOLO:', safe(p.protocolo) || '—', ML + 2, y + 10, 22);
  kv(
    doc,
    'STATUS SEFAZ:',
    `${p.status_label}${p.status_sefaz ? ` (${p.status_sefaz})` : ''}`,
    ML + 90,
    y + 10,
    24
  );
  kv(doc, 'CFOP:', safe(p.cfop) || '—', ML + 2, y + 15, 12);
  kv(doc, 'NATUREZA:', safe(p.natureza_operacao) || '—', ML + 40, y + 15, 20);
  kv(doc, 'TOMADOR:', safe(p.tomador_label) || '—', ML + 2, y + 20, 18);
  // Seta unicode (→) não existe na fonte helvetica do jsPDF — usa ASCII. Linha
  // própria, largura cheia, para não estourar a margem direita.
  const origem = `${safe(p.municipio_inicio)}/${safe(p.uf_inicio)}`;
  const destino = `${safe(p.municipio_fim)}/${safe(p.uf_fim)}`;
  kv(doc, 'ROTA:', `${origem}  ->  ${destino}`, ML + 2, y + 25, 12);
  return y + H + 1;
}

function drawPartyBlock(doc: PdfDoc, party: CtePdfParty, y: number): number {
  const H = 16;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  kv(doc, 'RAZAO SOCIAL:', safe(party.name), ML + 2, y + 4.5, 24);
  kv(doc, 'IE:', safe(party.ie) || 'ISENTO', PW - MR - 40, y + 4.5, 6);
  kv(doc, 'CNPJ/CPF:', safe(party.cnpj || party.cpf) || '—', ML + 2, y + 9, 18);
  kv(doc, 'FONE:', safe(party.phone) || '—', PW - MR - 40, y + 9, 12);
  const endereco = [
    safe(party.address),
    party.address_number ? `, ${party.address_number}` : '',
    party.neighborhood ? ` - ${party.neighborhood}` : '',
    party.city ? ` - ${party.city}/${safe(party.state)}` : '',
    party.zip_code ? `  CEP ${party.zip_code}` : '',
  ].join('');
  kv(doc, 'ENDERECO:', endereco || '—', ML + 2, y + 13.5, 18);
  return y + H + 1;
}

function drawValores(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const comps = (p.componentes ?? []).filter((c) => c && Number(c.valor) > 0);
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['COMPONENTE DO SERVIÇO', 'VALOR']],
    body: comps.map((c) => [c.nome, fmtBRL(c.valor)]),
    foot: [
      ['VALOR TOTAL DA PRESTAÇÃO', fmtBRL(p.valor_total)],
      ['VALOR A RECEBER', fmtBRL(p.valor_receber ?? p.valor_total)],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: C.text,
      lineColor: C.border,
      cellPadding: 1.6,
    },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7.5, halign: 'left' },
    footStyles: { fillColor: C.light, textColor: C.text, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { halign: 'right', cellWidth: 45 } },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 2;
}

function drawCarga(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const H = 12;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);
  doc.line(ML + CW / 2, y, ML + CW / 2, y + H);
  kv(
    doc,
    'PRODUTO PREDOMINANTE:',
    safe(p.produto_predominante) || 'CARGA GERAL',
    ML + 2,
    y + 7.5,
    40
  );
  kv(doc, 'VALOR DA CARGA:', fmtBRL(p.valor_carga), ML + CW / 2 + 2, y + 7.5, 30);
  return y + H + 1;
}

function drawFooter(doc: PdfDoc, p: CtePdfPayload): void {
  const ph = doc.internal.pageSize.getHeight();
  const fh = 12;
  // Aviso de espelho (acima da faixa)
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  const aviso =
    p.ambiente === 'homolog'
      ? 'AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL. Documento espelho Vectra; o DACTE oficial é gerado pela SEFAZ.'
      : 'Documento espelho Vectra do CT-e. O documento fiscal oficial é o DACTE — consulte pela chave de acesso.';
  doc.text(aviso, ML, ph - fh - 1, { maxWidth: CW });

  doc.setFillColor(...C.navy);
  doc.rect(0, ph - fh + 2, PW, fh - 2, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, ph - fh + 2, PW, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 195, 215);
  doc.text('VECTRA HUB - Itajai/SC', ML, ph - 3);
  doc.text('Pagina 1/1', PW - MR, ph - 3, { align: 'right' });
}

export async function generateCtePdf(
  payload: CtePdfPayload
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = payload.logoBase64Override ?? (await loadLogoBase64());

  let y = drawHeader(doc, payload, logo);
  y += 2;

  if (payload.ambiente === 'homolog') drawWatermark(doc, 'SEM VALOR FISCAL');

  y = drawSectionTitle(doc, 'IDENTIFICAÇÃO DO CT-e', y);
  y = drawIdentBlock(doc, payload, y);

  y = drawSectionTitle(doc, 'REMETENTE', y);
  y = drawPartyBlock(doc, payload.remetente, y);

  y = drawSectionTitle(doc, 'DESTINATÁRIO', y);
  y = drawPartyBlock(doc, payload.destinatario, y);

  y = drawSectionTitle(doc, 'VALORES DA PRESTAÇÃO', y);
  y = drawValores(doc, payload, y);

  y = drawSectionTitle(doc, 'CARGA', y);
  y = drawCarga(doc, payload, y);

  drawFooter(doc, payload);

  const fileName = `CTe-${payload.numero}-${payload.serie}.pdf`;
  return { blob: doc.output('blob'), fileName };
}
