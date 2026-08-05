import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_BASE64 } from '../_shared/logo-base64.ts';
import { patchFont, patchPageDrawText } from '../_shared/pdf-sanitize.ts';
import {
  buildClause52IncludedItems,
  buildPaymentTermsDescription,
  formatBrlReais,
  formatCnpjForContract,
  fmtTodayBr,
  resolveContractContratante,
} from './contract-clause-helpers.ts';

// Paleta Vectra
const NAVY = rgb(0.106, 0.165, 0.29);
const ORANGE = rgb(0.91, 0.459, 0.102);
const TEXT = rgb(0.118, 0.137, 0.176);
const MUTED = rgb(0.392, 0.431, 0.51);
const WHITE = rgb(1, 1, 1);
const LIGHT_FILL = rgb(0.965, 0.972, 0.98);
const GOVBR_SIGN_AREA_H = 52;

const PW = 595; // A4 width in pt
const PH = 842; // A4 height in pt
const ML = 50;
const MR = 50;
const CW = PW - ML - MR;
const LINE_H = 14;

function buildAddress(client: Record<string, unknown>): string {
  const parts: string[] = [];
  if (client.address) parts.push(String(client.address));
  if (client.address_number) parts.push(String(client.address_number));
  if (client.address_complement) parts.push(String(client.address_complement));
  if (client.address_neighborhood) parts.push(String(client.address_neighborhood));
  if (client.city) parts.push(String(client.city));
  if (client.state) parts.push(String(client.state));
  if (client.zip_code) parts.push(String(client.zip_code_mask || client.zip_code));
  return parts.join(', ') || '[endereço não informado]';
}

function buildCompanyAddress(company: Record<string, unknown>): string {
  const parts: string[] = [];
  if (company.address_street) parts.push(String(company.address_street));
  if (company.address_number) parts.push(String(company.address_number));
  if (company.address_complement) parts.push(String(company.address_complement));
  if (company.address_neighborhood) parts.push(String(company.address_neighborhood));
  if (company.address_city) parts.push(`${company.address_city} - ${company.address_state}`);
  if (company.address_zip) parts.push(String(company.address_zip));
  return parts.join(', ');
}

class PdfWriter {
  private doc!: PDFDocument;
  private page!: ReturnType<PDFDocument['addPage']>;
  private fonts!: {
    regular: Awaited<ReturnType<PDFDocument['embedFont']>>;
    bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    italic: Awaited<ReturnType<PDFDocument['embedFont']>>;
  };
  private y = PH - 50;
  private pageNum = 1;
  private totalPages = 0;
  private pages: Array<ReturnType<PDFDocument['addPage']>> = [];

  async init() {
    this.doc = await PDFDocument.create();
    this.fonts = {
      regular: patchFont(await this.doc.embedFont(StandardFonts.Helvetica)),
      bold: patchFont(await this.doc.embedFont(StandardFonts.HelveticaBold)),
      italic: patchFont(await this.doc.embedFont(StandardFonts.HelveticaOblique)),
    };
    this.newPage();
  }

  private newPage() {
    const p = patchPageDrawText(this.doc.addPage([PW, PH]));
    this.pages.push(p);
    this.page = p;
    this.y = PH - 50;
    this.pageNum = this.pages.length;
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < 70) {
      this.newPage();
    }
  }

  drawRect(x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  text(
    content: string,
    opts: {
      x?: number;
      size?: number;
      bold?: boolean;
      italic?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'center' | 'right';
      maxWidth?: number;
    } = {}
  ) {
    const {
      x = ML,
      size = 9,
      bold = false,
      italic = false,
      color = TEXT,
      align = 'left',
      maxWidth = CW,
    } = opts;
    const font = bold ? this.fonts.bold : italic ? this.fonts.italic : this.fonts.regular;
    const textX = align === 'center' ? ML + CW / 2 : align === 'right' ? PW - MR : x;
    const anchorPoint = align === 'center' ? 'center' : align === 'right' ? 'right' : undefined;

    // Word wrap
    const words = content.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      this.ensureSpace(LINE_H);
      const lw = font.widthOfTextAtSize(l, size);
      const drawX = align === 'center' ? PW / 2 - lw / 2 : align === 'right' ? PW - MR - lw : textX;
      this.page.drawText(l, { x: drawX, y: this.y, size, font, color });
      this.y -= LINE_H;
    }
  }

  gap(pts = 8) {
    this.y -= pts;
  }

  setY(y: number) {
    this.y = y;
  }

  /** Desenha texto em coordenada fixa sem mover o cursor vertical. */
  drawTextAt(
    content: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      bold?: boolean;
      italic?: boolean;
      color?: ReturnType<typeof rgb>;
    } = {}
  ) {
    const { size = 9, bold = false, italic = false, color = TEXT } = opts;
    const font = bold ? this.fonts.bold : italic ? this.fonts.italic : this.fonts.regular;
    this.page.drawText(content, { x, y, size, font, color });
  }

  rule(color = NAVY, thickness = 0.5) {
    this.page.drawLine({
      start: { x: ML, y: this.y },
      end: { x: PW - MR, y: this.y },
      thickness,
      color,
    });
    this.y -= 6;
  }

  heading(label: string) {
    this.ensureSpace(20);
    this.gap(4);
    this.page.drawRectangle({ x: ML, y: this.y - 2, width: CW, height: 14, color: NAVY });
    this.page.drawText(label, {
      x: ML + 6,
      y: this.y + 1,
      size: 9,
      font: this.fonts.bold,
      color: WHITE,
    });
    this.y -= 16;
    this.gap(2);
  }

  clause(num: string, title: string, body: string) {
    this.ensureSpace(40);
    this.gap(6);
    this.text(`${num} – ${title}`, { bold: true, size: 9 });
    this.gap(2);
    this.text(body, { size: 8.5, maxWidth: CW });
    this.gap(4);
  }

  subItem(label: string) {
    this.text(label, { x: ML + 12, size: 8.5, maxWidth: CW - 12 });
  }

  /** Logo no canto superior esquerdo; retorna dimensões ou null. */
  async drawLogo(
    logoBase64: string | undefined,
    anchorTopY: number
  ): Promise<{ width: number; height: number } | null> {
    if (!logoBase64) return null;
    try {
      const raw = logoBase64.includes(',') ? (logoBase64.split(',')[1] ?? '') : logoBase64;
      if (!raw) return null;
      const logoBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const logoImage = await this.doc.embedPng(logoBytes);
      const maxHeight = 52;
      const scale = maxHeight / logoImage.height;
      const width = logoImage.width * scale;
      const height = logoImage.height * scale;
      this.page.drawImage(logoImage, {
        x: ML,
        y: anchorTopY - height,
        width,
        height,
      });
      return { width, height };
    } catch {
      return null;
    }
  }

  /** Cabeçalho: faixa da logo → título/referência centralizados → linha separadora. */
  async drawContractHeader(title: string, subtitle: string, logoBase64?: string) {
    const topMargin = 36;
    const anchorTop = PH - topMargin;
    const logo = await this.drawLogo(logoBase64, anchorTop);
    const logoBottom = logo ? anchorTop - logo.height : anchorTop;

    // Cursor abaixo da logo (título ocupa largura total, sem colidir com a marca)
    this.setY(logoBottom - 18);

    this.text(title, { align: 'center', bold: true, size: 11, color: NAVY, maxWidth: CW });
    this.gap(6);
    this.text(subtitle, { align: 'center', size: 8, color: MUTED });
    this.gap(10);
    this.rule(ORANGE, 0.75);
    this.gap(8);
  }

  /**
   * Coluna de assinatura (topo → base): área GOV.br → linha → papel → nome/representante.
   */
  drawSignatureColumn(
    x: number,
    width: number,
    topY: number,
    role: string,
    name: string,
    representative?: string | null
  ): number {
    const areaBottom = topY - GOVBR_SIGN_AREA_H;

    this.page.drawRectangle({
      x,
      y: areaBottom,
      width,
      height: GOVBR_SIGN_AREA_H,
      color: LIGHT_FILL,
      borderColor: MUTED,
      borderWidth: 0.5,
      borderDashArray: [4, 3],
    });

    const wmSize = 7;
    const wm1 = 'Assinatura digital';
    const wm2 = 'GOV.br';
    const cx = x + width / 2;
    const w1 = this.fonts.italic.widthOfTextAtSize(wm1, wmSize);
    const w2 = this.fonts.bold.widthOfTextAtSize(wm2, wmSize);
    this.page.drawText(wm1, {
      x: cx - w1 / 2,
      y: areaBottom + GOVBR_SIGN_AREA_H / 2 + 2,
      size: wmSize,
      font: this.fonts.italic,
      color: MUTED,
    });
    this.page.drawText(wm2, {
      x: cx - w2 / 2,
      y: areaBottom + GOVBR_SIGN_AREA_H / 2 - 8,
      size: wmSize,
      font: this.fonts.bold,
      color: MUTED,
    });

    const lineY = areaBottom - 10;
    this.page.drawLine({
      start: { x, y: lineY },
      end: { x: x + width, y: lineY },
      thickness: 0.5,
      color: TEXT,
    });

    const labelY = lineY - 14;
    this.drawTextAt(role, x, labelY, { bold: true, size: 8 });

    const nameY = labelY - 12;
    this.drawTextAt(name, x, nameY, { size: 8, color: MUTED });

    let bottomY = nameY - 14;
    if (representative) {
      const repY = nameY - 12;
      this.drawTextAt(representative, x, repY, { size: 7.5, italic: true, color: MUTED });
      bottomY = repY - 14;
    }
    return bottomY;
  }

  drawFooter(pageIndex: number, total: number) {
    const p = this.pages[pageIndex];
    p.drawRectangle({ x: 0, y: 0, width: PW, height: 22, color: NAVY });
    const footerFont = this.fonts.regular;
    p.drawText(`Página ${pageIndex + 1} de ${total}`, {
      x: ML,
      y: 7,
      size: 7,
      font: footerFont,
      color: WHITE,
    });
    const footerCenter = 'Contrato de prestação de serviços — sujeito a conferência das partes';
    const footerCenterW = footerFont.widthOfTextAtSize(footerCenter, 7);
    p.drawText(footerCenter, {
      x: PW / 2 - footerCenterW / 2,
      y: 7,
      size: 7,
      font: footerFont,
      color: WHITE,
    });
  }

  async finish(): Promise<Uint8Array> {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      this.drawFooter(i, total);
    }
    return this.doc.save();
  }
}

// ── Main renderer ──────────────────────────────────────────────────────────────

export async function renderContractPdf(ctx: {
  quote: Record<string, unknown>;
  company: Record<string, unknown>;
  version: number;
}): Promise<Uint8Array> {
  const { quote, company, version } = ctx;
  const paymentTerm = (quote.payment_terms as Record<string, unknown> | null) ?? {};

  // CONTRATANTE = embarcador (shipper) quando CIF; cliente quando FOB.
  const contratante = resolveContractContratante(quote);
  const contratanteParty = contratante.party;

  const w = new PdfWriter();
  await w.init();

  // ── Header ───────────────────────────────────────────────────────────────────
  await w.drawContractHeader(
    'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE RODOVIÁRIO DE CARGAS',
    `Referência: ${String(quote.quote_code ?? '')}  —  Versão ${version}`,
    LOGO_BASE64
  );

  w.text('Pelo presente instrumento particular, de um lado:', {
    italic: true,
    size: 8.5,
    color: MUTED,
  });
  w.gap(6);

  // ── CONTRATADA ────────────────────────────────────────────────────────────────
  w.heading('CONTRATADA');
  w.text(
    `${String(company.legal_name ?? '')}, pessoa jurídica de direito privado, inscrita no CNPJ nº ${formatCnpjForContract(company.cnpj as string)}, ` +
      `com sede na ${buildCompanyAddress(company)}, doravante denominada CONTRATADA.`,
    { size: 8.5 }
  );
  w.gap(8);

  // ── CONTRATANTE ───────────────────────────────────────────────────────────────
  w.heading('CONTRATANTE');
  const contratanteName = contratante.name;
  const contratanteCnpj = formatCnpjForContract(contratanteParty.cnpj as string);
  const contratanteAddr = buildAddress(contratanteParty);
  const contratanteQualificacao = contratante.isCif
    ? ', na qualidade de embarcador/remetente da carga (frete CIF)'
    : '';
  w.text(
    `${contratanteName}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${contratanteCnpj || '[CNPJ não informado]'}, ` +
      `com sede na ${contratanteAddr}${contratanteQualificacao}, doravante denominada CONTRATANTE.`,
    { size: 8.5 }
  );
  w.gap(6);
  w.text('As partes ajustam o presente contrato, mediante as cláusulas e condições seguintes:', {
    italic: true,
    size: 8.5,
    color: MUTED,
  });
  w.gap(8);

  // ── Cláusulas ─────────────────────────────────────────────────────────────────

  w.clause(
    'CLÁUSULA 1ª',
    'DO OBJETO',
    '1.1. O presente contrato tem por objeto a prestação de serviços de transporte rodoviário de cargas, podendo a CONTRATADA executar os serviços diretamente ou por meio de transportadores autônomos de cargas – TAC, empresas terceirizadas ou agregados, regularmente constituídos e habilitados.'
  );
  w.text(
    '1.2. A CONTRATADA atua como operadora logística e intermediadora do transporte, não sendo proprietária, necessariamente, dos veículos utilizados nas operações.',
    { size: 8.5, x: ML + 12 }
  );

  w.clause(
    'CLÁUSULA 2ª',
    'DA FORMA DE EXECUÇÃO DOS SERVIÇOS',
    '2.1. A CONTRATADA poderá, a seu exclusivo critério, subcontratar, intermediar ou repassar a execução do transporte a TACs ou transportadores terceirizados, nos termos da Lei nº 11.442/2007.'
  );
  w.subItem(
    '2.2. A escolha, contratação, remuneração e fiscalização dos transportadores terceirizados são de responsabilidade exclusiva da CONTRATADA, inexistindo qualquer vínculo jurídico direto entre o CONTRATANTE e os referidos terceiros.'
  );
  w.subItem(
    '2.3. O CONTRATANTE reconhece e concorda que não poderá interferir, negociar ou efetuar pagamentos diretamente a motoristas, TACs ou transportadores subcontratados.'
  );
  w.subItem(
    '2.4. O CONTRATANTE declara ciência de que o tipo de veículo a ser utilizado na operação será definido em conjunto com a CONTRATADA, em razão da dificuldade de acesso ao local de entrega, podendo a CONTRATADA realizar os ajustes operacionais necessários para a adequada execução dos serviços. Na hipótese de existirem restrições de acesso, exigências específicas do local, necessidade de veículo especial, transbordo, redespacho ou qualquer outra medida operacional extraordinária que gere custos adicionais, tais valores serão previamente informados pela CONTRATADA ao CONTRATANTE e somente poderão ser cobrados e/ou executados mediante aprovação expressa e por escrito do CONTRATANTE.'
  );

  w.clause('CLÁUSULA 3ª', 'DAS OBRIGAÇÕES DA CONTRATADA', 'A CONTRATADA obriga-se a:');
  w.subItem(
    'a) Coordenar e intermediar a operação de transporte, observando a legislação vigente aplicável ao transporte rodoviário de cargas;'
  );
  w.subItem(
    'b) Exigir dos transportadores terceirizados a regularidade documental mínima exigida por lei (ANTT, CNH, veículo, quando aplicável);'
  );
  w.subItem(
    'c) Cumprir os prazos de coleta e entrega ajustados, os quais possuem caráter estimativo, não se configurando como prazos fatais, não respondendo por atrasos decorrentes de fatos alheios à sua atuação, incluindo, mas não se limitando a: (i) atraso na liberação, carregamento ou descarregamento da mercadoria; (ii) indisponibilidade de motorista terceirizado por motivo justificado; (iii) atraso ou inadimplemento do pagamento de entrada ou sinal do frete; (iv) informações incorretas ou incompletas fornecidas pelo CONTRATANTE; (v) caso fortuito ou força maior (art. 393 do Código Civil);'
  );
  w.subItem(
    'd) Nas hipóteses acima, os prazos serão automaticamente prorrogados, sem aplicação de penalidades.'
  );

  w.clause('CLÁUSULA 4ª', 'DAS OBRIGAÇÕES DO CONTRATANTE', '4.1. O CONTRATANTE obriga-se a:');
  w.subItem(
    'a) Fornecer informações corretas e completas sobre a carga, locais, prazos e exigências operacionais;'
  );
  w.subItem('b) Garantir que a mercadoria esteja adequadamente acondicionada e regularizada;');
  w.subItem('c) Efetuar os pagamentos exclusivamente à CONTRATADA, nos prazos acordados;');
  w.subItem('d) Abster-se de manter qualquer relação direta com motoristas ou TACs.');

  // Cláusula 5 — Pagamento (com dados dinâmicos)
  const freightValue =
    typeof quote.value === 'number' ? formatBrlReais(quote.value) : '[valor não informado]';
  const paymentDescription = buildPaymentTermsDescription(quote, paymentTerm);
  const clause52 = buildClause52IncludedItems(quote);

  w.clause(
    'CLÁUSULA 5ª',
    'DO PAGAMENTO',
    `5.1. O pagamento do frete deverá ser realizado exclusivamente em conta bancária de titularidade jurídica da CONTRATADA, no valor total de ${freightValue}.`
  );
  if (contratante.isCif) {
    w.subItem(
      'Por se tratar de operação na modalidade CIF, o frete é de responsabilidade do embarcador (remetente da carga), ora CONTRATANTE, a quem compete efetuar o pagamento à CONTRATADA nos termos desta cláusula.'
    );
  }
  w.subItem(clause52.text);
  w.subItem(
    `5.3. O pagamento será realizado conforme a condição negociada: ${paymentDescription}.`
  );
  w.subItem(
    `5.4. O pagamento deverá ser efetuado através dos seguintes dados bancários da ${String(company.legal_name ?? 'CONTRATADA')}:`
  );
  w.gap(2);
  w.text(`CNPJ: ${formatCnpjForContract(company.cnpj as string)}`, { x: ML + 24, size: 8.5 });
  w.text(`Banco: ${String(company.bank_name ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Agência: ${String(company.bank_agency ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Conta Corrente: ${String(company.bank_account ?? '')}`, { x: ML + 24, size: 8.5 });
  w.text(`Chave (PIX): ${String(company.bank_pix_key ?? '')}`, { x: ML + 24, size: 8.5 });
  w.gap(4);
  w.subItem(
    '5.5. O inadimplemento autoriza a CONTRATADA a suspender, reter ou cancelar a operação, sem caracterizar descumprimento contratual.'
  );

  w.clause(
    'CLÁUSULA 6ª',
    'DA VEDAÇÃO A PAGAMENTOS DIRETOS E MULTA',
    '6.1. É estritamente vedado ao CONTRATANTE efetuar pagamentos diretos a motoristas, TACs, agregados ou transportadores subcontratados.'
  );
  w.subItem(
    '6.2. O descumprimento desta cláusula acarretará multa compensatória equivalente a 30% (trinta por cento) do valor do frete, além da obrigação de pagamento integral do frete contratado, nos termos dos arts. 408, 409, 410 e 416 do Código Civil, que autorizam a estipulação de cláusula penal para o caso de inadimplemento, sem prejuízo das demais medidas cabíveis para resguardar o cumprimento das obrigações assumidas.'
  );

  w.clause(
    'CLÁUSULA 7ª',
    'DA RESPONSABILIDADE E LIMITAÇÕES',
    '7.1. A responsabilidade da CONTRATADA limita-se à intermediação e coordenação do transporte, nos termos da Lei nº 11.442/2007.'
  );
  w.subItem(
    '7.2. A CONTRATADA não responde solidária ou subsidiariamente por obrigações trabalhistas, previdenciárias ou fiscais dos transportadores terceirizados.'
  );
  w.subItem(
    '7.3. A CONTRATADA não será responsável por prejuízos decorrentes de: a) vício próprio da carga; b) embalagem inadequada; c) atos/erros de terceiros; d) força maior ou caso fortuito.'
  );

  w.clause(
    'CLÁUSULA 8ª',
    'DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA',
    '8.1. Não existe qualquer vínculo empregatício, societário ou solidário entre o CONTRATANTE e os motoristas, TACs ou transportadores terceirizados utilizados na operação.'
  );
  w.subItem(
    '8.2. Qualquer tentativa de caracterização de vínculo será de inteira responsabilidade de quem a der causa.'
  );

  w.clause(
    'CLÁUSULA 9ª',
    'DA VIGÊNCIA E RESCISÃO',
    '9.1. O presente contrato terá prazo determinado, iniciando-se na data de sua assinatura e encerrando-se automaticamente com o cumprimento integral do serviço contratado.'
  );
  w.subItem(
    '9.2. Poderá ser rescindido mediante aviso prévio de 30 dias, mantendo-se exigíveis os valores pendentes.'
  );

  const jurisdiction = String(company.default_jurisdiction ?? 'Navegantes/SC');
  const signatureCity = String(company.signature_city ?? 'Navegantes');

  w.clause(
    'CLÁUSULA 10ª',
    'DO FORO',
    `10.1. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de ${jurisdiction}, com renúncia expressa a qualquer outro, por mais privilegiado que seja. E, por estarem justas e contratadas, firmam o presente instrumento em duas vias de igual teor e forma.`
  );

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  w['ensureSpace'](160);
  w.gap(16);
  w.text(`${signatureCity}, ${fmtTodayBr()}`, {
    align: 'center',
    size: 9,
    color: MUTED,
  });
  w.gap(24);

  const colGap = 36;
  const colW = (CW - colGap) / 2;
  const leftX = ML;
  const rightX = ML + colW + colGap;
  const lineW = colW - 8;
  const blockTop = w['y'];

  const contratanteRep = contratanteParty.legal_representative_name
    ? String(contratanteParty.legal_representative_name)
    : null;
  const companyRep = company.legal_representative_name
    ? String(company.legal_representative_name)
    : null;

  const leftBottom = w.drawSignatureColumn(
    leftX,
    lineW,
    blockTop,
    'CONTRATANTE',
    contratanteName,
    contratanteRep
  );
  const rightBottom = w.drawSignatureColumn(
    rightX,
    lineW,
    blockTop,
    'CONTRATADA',
    String(company.legal_name ?? ''),
    companyRep
  );

  w['y'] = Math.min(leftBottom, rightBottom);
  w.gap(8);
  w.text(
    `Documento gerado em ${new Date().toLocaleString('pt-BR')} — Ref. ${String(quote.quote_code ?? '')} v${version}`,
    {
      align: 'center',
      size: 7,
      color: MUTED,
    }
  );

  return w.finish();
}
