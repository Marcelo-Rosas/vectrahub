import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';

/**
 * Espelho Vectra do CT-e — NÃO substitui o DACTE oficial (SEFAZ/Focus).
 * Corpo segue a ordem de blocos do DACTE (modelo 57); cabeçalho e rodapé
 * usam o padrão visual OC / OS / COT (navy + laranja Vectra).
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

export interface CtePdfQuantidade {
  tipo_medida?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
}

export interface CtePdfDocOrig {
  tipo?: string | null;
  numero?: string | null;
  data_emissao?: string | null;
  valor?: number | null;
  chave_nfe?: string | null;
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
  data_emissao?: string | null;
  tipo_documento?: number | string | null;
  tipo_servico?: number | string | null;
  modal?: string | null;
  tomador_label?: string | null;
  remetente: CtePdfParty;
  destinatario: CtePdfParty;
  expedidor?: CtePdfParty | null;
  recebedor?: CtePdfParty | null;
  valor_total?: number | null;
  valor_receber?: number | null;
  componentes?: CtePdfComponente[];
  icms_cst?: string | null;
  icms_base?: number | null;
  icms_aliquota?: number | null;
  icms_valor?: number | null;
  valor_carga?: number | null;
  produto_predominante?: string | null;
  quantidades?: CtePdfQuantidade[];
  rntrc?: string | null;
  documentos?: CtePdfDocOrig[];
  municipio_inicio?: string | null;
  uf_inicio?: string | null;
  municipio_fim?: string | null;
  uf_fim?: string | null;
  municipio_envio?: string | null;
  uf_envio?: string | null;
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

const TIPO_CTE: Record<string, string> = {
  '0': 'CT-e Normal',
  '1': 'CT-e de Complemento',
  '2': 'CT-e de Anulação',
  '3': 'CT-e Substituto',
};

const TIPO_SERV: Record<string, string> = {
  '0': 'Normal',
  '1': 'Subcontratação',
  '2': 'Redespacho',
  '3': 'Redespacho Intermediário',
  '4': 'Serviço Vinculado a Multimodal',
};

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

const fmtChave = (c: string | null | undefined): string =>
  !c
    ? ''
    : c
        .replace(/\D/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim();

function partyHasContent(p?: CtePdfParty | null): boolean {
  if (!p) return false;
  return Boolean(p.name || p.cnpj || p.cpf || p.city);
}

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

/** Cabeçalho padrão OC / OS / COT. */
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
  doc.text('DACTE (ESPELHO VECTRA)', PW - MR, 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`No ${p.numero}  Serie ${p.serie}  Mod. 57`, PW - MR, 14.5, { align: 'right' });
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
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text);
  const vx = x + (labelW || doc.getTextWidth(label) + 1.5);
  const lines = doc.splitTextToSize(value || '—', Math.max(20, PW - MR - vx));
  doc.text(lines[0] ?? '—', vx, y);
}

/** Bloco identificação — espelha faixa superior do DACTE (chave + ide). */
function drawIdentBlock(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const H = 32;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  kv(doc, 'CHAVE DE ACESSO', fmtChave(p.chave) || '—', ML + 2, y + 4.5, 28);
  kv(doc, 'PROTOCOLO', safe(p.protocolo) || '—', ML + 2, y + 9.5, 20);
  kv(
    doc,
    'STATUS',
    `${p.status_label}${p.status_sefaz ? ` (${p.status_sefaz})` : ''}`,
    ML + 95,
    y + 9.5,
    14
  );

  const tipo = TIPO_CTE[String(p.tipo_documento ?? '0')] ?? 'CT-e Normal';
  const serv = TIPO_SERV[String(p.tipo_servico ?? '0')] ?? 'Normal';
  kv(doc, 'TIPO CT-e', tipo, ML + 2, y + 14.5, 18);
  kv(doc, 'TIPO SERVICO', serv, ML + 70, y + 14.5, 24);
  kv(
    doc,
    'MODAL',
    safe(p.modal) === '01' || !p.modal ? 'Rodoviario' : safe(p.modal),
    ML + 140,
    y + 14.5,
    12
  );

  kv(doc, 'CFOP', safe(p.cfop) || '—', ML + 2, y + 19.5, 12);
  kv(doc, 'NATUREZA', safe(p.natureza_operacao) || '—', ML + 40, y + 19.5, 18);
  kv(doc, 'TOMADOR', safe(p.tomador_label) || '—', ML + 140, y + 19.5, 16);

  const envio = `${safe(p.municipio_envio || p.municipio_inicio)}/${safe(p.uf_envio || p.uf_inicio)}`;
  const origem = `${safe(p.municipio_inicio)}/${safe(p.uf_inicio)}`;
  const destino = `${safe(p.municipio_fim)}/${safe(p.uf_fim)}`;
  kv(doc, 'UF ENVIO', envio, ML + 2, y + 24.5, 16);
  kv(doc, 'INICIO', origem, ML + 70, y + 24.5, 14);
  kv(doc, 'TERMINO', destino, ML + 130, y + 24.5, 16);

  kv(
    doc,
    'AMBIENTE',
    p.ambiente === 'homolog' ? 'Homologacao (sem valor fiscal)' : 'Producao',
    ML + 2,
    y + 29.5,
    18
  );
  if (p.data_emissao) {
    kv(doc, 'EMISSAO', fmtDate(p.data_emissao), ML + 95, y + 29.5, 16);
  }

  return y + H + 1;
}

/** Linhas compactas (máx 4) — evita overflow da caixa. */
function partyLines(party: CtePdfParty): string[] {
  const docId = safe(party.cnpj || party.cpf) || '—';
  const ie = safe(party.ie) || 'ISENTO';
  const endereco = [
    safe(party.address),
    party.address_number ? `, ${party.address_number}` : '',
    party.neighborhood ? ` - ${party.neighborhood}` : '',
  ].join('');
  const cidadeFone = [
    party.city ? `${party.city}/${safe(party.state)}` : '',
    party.zip_code ? `CEP ${party.zip_code}` : '',
    party.phone ? `Fone ${safe(party.phone)}` : '',
  ]
    .filter(Boolean)
    .join('  ');
  return [
    safe(party.name) || '—',
    `CNPJ/CPF: ${docId}    IE: ${ie}`,
    endereco || '—',
    cidadeFone || '—',
  ];
}

const TITLE_H = 4.5;
const LINE_H = 3.6;
const CELL_PAD_BOTTOM = 2.5;

function measurePartyCellH(lineCount: number): number {
  return TITLE_H + 1.5 + lineCount * LINE_H + CELL_PAD_BOTTOM;
}

/** Caixa de parte — altura dinâmica conforme linhas. */
function drawPartyCell(
  doc: PdfDoc,
  title: string,
  party: CtePdfParty,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
  doc.setFillColor(...C.light);
  doc.rect(x, y, w, TITLE_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.navy);
  doc.text(title, x + 1.5, y + 3.2);

  const lines = partyLines(party);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.text);
  let ly = y + TITLE_H + 3.2;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, w - 3);
    doc.text(wrapped[0] ?? '', x + 1.5, ly);
    ly += LINE_H;
  }
}

/** Remetente | Destinatário lado a lado (layout DACTE). */
function drawPartyPair(
  doc: PdfDoc,
  leftTitle: string,
  left: CtePdfParty,
  rightTitle: string,
  right: CtePdfParty,
  y: number
): number {
  const gap = 1;
  const half = (CW - gap) / 2;
  const H = Math.max(
    measurePartyCellH(partyLines(left).length),
    measurePartyCellH(partyLines(right).length),
    22
  );
  drawPartyCell(doc, leftTitle, left, ML, y, half, H);
  drawPartyCell(doc, rightTitle, right, ML + half + gap, y, half, H);
  return y + H + 1.5;
}

function drawPartyFull(doc: PdfDoc, title: string, party: CtePdfParty, y: number): number {
  const H = Math.max(measurePartyCellH(partyLines(party).length), 22);
  drawPartyCell(doc, title, party, ML, y, CW, H);
  return y + H + 1.5;
}

/** Se y perto do rodapé → nova página (header mínimo). */
function ensureSpace(doc: PdfDoc, y: number, need: number, p: CtePdfPayload): number {
  const ph = doc.internal.pageSize.getHeight();
  const footerReserve = 16;
  if (y + need <= ph - footerReserve) return y;
  drawFooter(doc, p);
  doc.addPage();
  if (p.ambiente === 'homolog') drawWatermark(doc, 'SEM VALOR FISCAL');
  return 12;
}

function drawValores(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const comps = (p.componentes ?? []).filter((c) => c && Number(c.valor) > 0);
  const body =
    comps.length > 0
      ? comps.map((c) => [c.nome, fmtBRL(c.valor)])
      : [['Prestacao de servico', fmtBRL(p.valor_total)]];
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['COMPONENTE DO VALOR DA PRESTACAO', 'VALOR']],
    body,
    foot: [
      ['VALOR TOTAL DA PRESTACAO', fmtBRL(p.valor_total)],
      ['VALOR A RECEBER', fmtBRL(p.valor_receber ?? p.valor_total)],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      textColor: C.text,
      lineColor: C.border,
      cellPadding: 1.4,
    },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7, halign: 'left' },
    footStyles: { fillColor: C.light, textColor: C.text, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 2;
}

function drawImpostos(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const H = 12;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);
  kv(doc, 'CST ICMS', safe(p.icms_cst) || '00', ML + 2, y + 4.5, 18);
  kv(doc, 'BASE CALCULO', fmtBRL(p.icms_base), ML + 45, y + 4.5, 26);
  kv(
    doc,
    'ALIQUOTA',
    p.icms_aliquota != null ? `${Number(p.icms_aliquota).toFixed(2)}%` : '0,00%',
    ML + 100,
    y + 4.5,
    18
  );
  kv(doc, 'VALOR ICMS', fmtBRL(p.icms_valor), ML + 145, y + 4.5, 22);
  kv(doc, 'OBS', 'Simples Nacional / valores conforme payload SEFAZ', ML + 2, y + 9.5, 10);
  return y + H + 1;
}

function drawCargaModal(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const H = 18;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);
  doc.line(ML + CW * 0.55, y, ML + CW * 0.55, y + H);

  kv(
    doc,
    'PRODUTO PREDOMINANTE',
    safe(p.produto_predominante) || 'CARGA GERAL',
    ML + 2,
    y + 4.5,
    40
  );
  kv(doc, 'VALOR DA CARGA', fmtBRL(p.valor_carga), ML + 2, y + 9.5, 28);
  const q = p.quantidades?.[0];
  const qTxt = q
    ? `${safe(q.tipo_medida) || 'PESO BRUTO'}: ${Number(q.quantidade ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${safe(q.unidade) || 'KG'}`
    : '—';
  kv(doc, 'QUANTIDADE', qTxt, ML + 2, y + 14.5, 22);

  kv(doc, 'MODAL RODOVIARIO', 'RNTRC', ML + CW * 0.55 + 2, y + 4.5, 32);
  kv(doc, 'RNTRC', safe(p.rntrc) || '—', ML + CW * 0.55 + 2, y + 9.5, 14);
  return y + H + 1;
}

function drawDocumentos(doc: PdfDoc, p: CtePdfPayload, y: number): number {
  const docs = p.documentos ?? [];
  if (docs.length === 0) return y;
  const body = docs.map((d) => [
    safe(d.chave_nfe) ? 'NF-e' : safe(d.tipo) || '99',
    safe(d.chave_nfe) || safe(d.numero) || '—',
    d.data_emissao ? fmtDate(d.data_emissao) : '—',
    d.valor != null ? fmtBRL(d.valor) : '—',
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    head: [['TIPO', 'NUMERO / CHAVE', 'EMISSAO', 'VALOR']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      textColor: C.text,
      lineColor: C.border,
      cellPadding: 1.2,
    },
    headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 18 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32, halign: 'right' },
    },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 2;
}

/** Rodapé padrão OC / OS / COT + aviso de espelho. */
function drawFooter(doc: PdfDoc, p: CtePdfPayload): void {
  const ph = doc.internal.pageSize.getHeight();
  const fh = 9;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  const aviso =
    p.ambiente === 'homolog'
      ? 'AMBIENTE DE HOMOLOGACAO — SEM VALOR FISCAL. Espelho Vectra; o DACTE oficial e gerado pela SEFAZ/Focus.'
      : 'Espelho Vectra do CT-e. Documento fiscal oficial = DACTE SEFAZ (botao DACTE oficial).';
  doc.text(aviso, ML, ph - fh - 2, { maxWidth: CW });

  doc.setFillColor(...C.navy);
  doc.rect(0, ph - fh, PW, fh, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, ph - fh, PW, 1, 'F');
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

  y = ensureSpace(doc, y, 40, payload);
  y = drawSectionTitle(doc, 'IDENTIFICACAO DO CT-e', y);
  y = drawIdentBlock(doc, payload, y);

  y = ensureSpace(doc, y, 30, payload);
  y = drawSectionTitle(doc, 'REMETENTE / DESTINATARIO', y);
  y = drawPartyPair(doc, 'REMETENTE', payload.remetente, 'DESTINATARIO', payload.destinatario, y);

  if (partyHasContent(payload.expedidor) || partyHasContent(payload.recebedor)) {
    y = ensureSpace(doc, y, 30, payload);
    y = drawSectionTitle(doc, 'EXPEDIDOR / RECEBEDOR', y);
    y = drawPartyPair(
      doc,
      'EXPEDIDOR',
      payload.expedidor ?? {},
      'RECEBEDOR',
      payload.recebedor ?? {},
      y
    );
  }

  if (payload.tomador_label) {
    const tomaParty =
      payload.tomador_label === 'Destinatário'
        ? payload.destinatario
        : payload.tomador_label === 'Remetente'
          ? payload.remetente
          : payload.tomador_label === 'Expedidor'
            ? (payload.expedidor ?? payload.remetente)
            : payload.tomador_label === 'Recebedor'
              ? (payload.recebedor ?? payload.destinatario)
              : payload.remetente;
    y = ensureSpace(doc, y, 32, payload);
    y = drawSectionTitle(doc, `TOMADOR DO SERVICO — ${payload.tomador_label.toUpperCase()}`, y);
    y = drawPartyFull(doc, 'TOMADOR', tomaParty, y);
  }

  y = ensureSpace(doc, y, 40, payload);
  y = drawSectionTitle(doc, 'COMPONENTES DO VALOR DA PRESTACAO', y);
  y = drawValores(doc, payload, y);

  y = ensureSpace(doc, y, 22, payload);
  y = drawSectionTitle(doc, 'INFORMACOES RELATIVAS AO IMPOSTO', y);
  y = drawImpostos(doc, payload, y);

  y = ensureSpace(doc, y, 28, payload);
  y = drawSectionTitle(doc, 'INFORMACOES DA CARGA / MODAL', y);
  y = drawCargaModal(doc, payload, y);

  if ((payload.documentos ?? []).length > 0) {
    y = ensureSpace(doc, y, 30, payload);
    y = drawSectionTitle(doc, 'DOCUMENTOS ORIGINARIOS', y);
    y = drawDocumentos(doc, payload, y);
  }

  drawFooter(doc, payload);

  const fileName = `CTe-${payload.numero}-${payload.serie}.pdf`;
  return { blob: doc.output('blob'), fileName };
}
