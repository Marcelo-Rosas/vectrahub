import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from '@/lib/formatters';
import type {
  CollectionOrderAnttData,
  CollectionOrderCargoData,
  CollectionOrderDriverData,
  CollectionOrderPartyData,
  CollectionOrderVehicleData,
} from '@/types/collectionOrder';

export interface CollectionOrderPdfPayload {
  oc_number: string;
  /** Razão social do pagador do frete (regra canônica — após o número). */
  payer_name?: string | null;
  issued_at: string;
  issued_by_name: string | null;
  sender: CollectionOrderPartyData;
  /** Coleta adicional (ex.: segundo embarcador da cotação) */
  sender_2?: CollectionOrderPartyData | null;
  recipient: CollectionOrderPartyData;
  driver: CollectionOrderDriverData;
  vehicle: CollectionOrderVehicleData;
  cargo: CollectionOrderCargoData;
  antt?: CollectionOrderAnttData | null;
  pickup_date: string | null;
  delivery_date: string | null;
  observation: string | null;
  additional_info: string | null;
  cancelled?: boolean;
  /** Logo ja codificado em base64 (data URL). Quando ausente, faz fetch
   *  do asset Vite — usado em smoke tests Node onde nao ha bundler. */
  logoBase64Override?: string | null;
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

// Vectra HUB emissora — fixo (tenant Hub)
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

const fmtNum = (v: number | null | undefined): string => {
  if (v == null) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v));
};

const fmtCurrencyPlain = (v: number | null | undefined): string => {
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

async function loadLogoBase64(): Promise<string | null> {
  try {
    // Dynamic import com `?url` — Vite resolve em build, Node ignora (cai no
    // catch). Ambiente Node deve usar logoBase64Override no payload.
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

function drawWatermark(doc: PdfDoc, text: string): void {
  const ph = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  // Diagonal big text
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
  payload: CollectionOrderPdfPayload,
  logoBase64: string | null
): number {
  const H = 28;
  // Bg
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PW, H, 'F');
  doc.setFillColor(...C.orange);
  doc.rect(0, H, PW, 2, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', ML, 3, 22, 22);
  }

  // Issuer info
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

  // Right side title + meta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.white);
  doc.text('ORDEM DE COLETA', PW - MR, 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.orangeLight);
  doc.text(`No ${payload.oc_number}`, PW - MR, 14.5, { align: 'right' });

  doc.setTextColor(200, 215, 235);
  doc.setFontSize(7);
  doc.text(`Emissao: ${fmtDate(payload.issued_at)}`, PW - MR, 19, { align: 'right' });
  if (payload.issued_by_name) {
    doc.text(`Usuario: ${payload.issued_by_name}`, PW - MR, 23, { align: 'right' });
  }

  // Regra canônica: razão social do pagador do frete após o número.
  if (payload.payer_name?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.orangeLight);
    doc.text(`Pagador do frete: ${payload.payer_name.trim()}`, ix, 26.5);
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

/** Bloco de "parte" (remetente/destinatario) com 2 linhas de campos */
function drawPartyBlock(doc: PdfDoc, party: CollectionOrderPartyData, y: number): number {
  const H = 22;

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  // Linha 1 — Razão social + telefone
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('RAZAO SOCIAL:', ML + 2, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(party.name), ML + 26, y + 4);

  // Telefone na direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('TELEFONE:', PW - MR - 50, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(party.phone), PW - MR - 30, y + 4);

  // Linha 2 — CNPJ + Endereço + Nº
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CNPJ:', ML + 2, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.cnpj || party.cpf), ML + 12, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('ENDERECO:', ML + 60, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  const addr = doc.splitTextToSize(safe(party.address), 80);
  doc.text(addr[0] ?? '', ML + 78, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('No:', PW - MR - 22, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.address_number), PW - MR - 14, y + 9);

  // Linha 3 — CEP + Bairro + Cidade + UF
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CEP:', ML + 2, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.zip_code), ML + 12, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('BAIRRO:', ML + 38, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.address_neighborhood), ML + 52, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CIDADE:', ML + 110, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.city), ML + 124, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('UF:', PW - MR - 14, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.state), PW - MR - 8, y + 14);

  // Linha 4 — Complemento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('COMPLEMENTO:', ML + 2, y + 19);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text);
  doc.text(safe(party.address_complement), ML + 30, y + 19);

  return y + H + 1;
}

function drawDriverVehicleBlock(
  doc: PdfDoc,
  driver: CollectionOrderDriverData,
  vehicle: CollectionOrderVehicleData,
  y: number
): number {
  const H = 18;
  const half = CW / 2;

  // Outer borders
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, half, H);
  doc.rect(ML + half, y, half, H);

  // Driver
  const dx = ML + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('NOME', dx, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(driver.name), dx + 14, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CPF', dx, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(driver.cpf), dx + 14, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('CNH', dx, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(driver.cnh), dx + 14, y + 14);

  // Vehicle
  const vx = ML + half + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PLACA VEICULO', vx, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(vehicle.plate), vx + 32, y + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PLACA CARRETA', vx, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(vehicle.trailer_plate), vx + 32, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('TIPO DE VEICULO', vx, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text(safe(vehicle.vehicle_type), vx + 32, y + 14);

  return y + H + 1;
}

function drawCargoBlock(doc: PdfDoc, cargo: CollectionOrderCargoData, y: number): number {
  const H = 14;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  // 4 colunas igualmente espaçadas, mesma altura, divisões verticais consistentes
  const cells = [
    { label: 'PESO (kg)', value: cargo.weight_kg != null ? fmtNum(Number(cargo.weight_kg)) : '—' },
    {
      label: 'VOLUME (m3)',
      value: cargo.volume_m3 != null ? fmtNum(Number(cargo.volume_m3)) : '—',
    },
    {
      label: 'VALOR DE NF',
      value: cargo.cargo_value != null ? `R$ ${fmtCurrencyPlain(Number(cargo.cargo_value))}` : '—',
    },
    {
      label: 'TIPO DE CARGA',
      value: cargo.cargo_type ? safe(cargo.cargo_type).toUpperCase() : '—',
    },
  ];
  const colW = CW / cells.length;

  cells.forEach((cell, i) => {
    const x = ML + i * colW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.25);
      doc.line(x, y, x, y + H);
    }
    const innerW = colW - 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(cell.label, x + 2, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    // Trunca para caber na coluna, evitando overflow no Tipo de Carga
    const lines = doc.splitTextToSize(cell.value, innerW) as string[];
    doc.text(lines[0] ?? '', x + 2, y + 10.5);
  });

  return y + H + 1;
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

function drawSchedule(
  doc: PdfDoc,
  pickup: string | null,
  delivery: string | null,
  y: number
): number {
  const H = 14;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);
  doc.line(ML + CW / 2, y, ML + CW / 2, y + H);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PREVISAO DA COLETA', ML + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(fmtDate(pickup) || '—', ML + 3, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('PREVISAO DA ENTREGA', ML + CW / 2 + 3, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(fmtDate(delivery) || '—', ML + CW / 2 + 3, y + 10);

  return y + H + 1;
}

function drawAnttBlock(doc: PdfDoc, antt: CollectionOrderAnttData, y: number): number {
  // Linha extra para o link do comprovante quando o portal devolver URL
  const hasComprovante = !!antt.comprovante_url;
  const H = hasComprovante ? 30 : 22;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  // Cor da faixa-status (left accent) baseada na situacao
  const accent: [number, number, number] = (() => {
    const s = (antt.situacao || '').toLowerCase();
    if (s === 'regular') return [22, 101, 52]; // verde
    if (s === 'irregular') return [220, 38, 38]; // vermelho
    return [180, 130, 30]; // ambar (indeterminado)
  })();
  doc.setFillColor(...accent);
  doc.rect(ML, y, 2, H, 'F');

  // Linha 1: 4 cols (RNTRC | TIPO | SITUACAO | APTO)
  const cells: { label: string; value: string }[] = [
    { label: 'RNTRC', value: safe(antt.rntrc) || '—' },
    { label: 'TIPO', value: safe(antt.rntrc_registry_type) || '—' },
    {
      label: 'SITUACAO',
      value: (safe(antt.situacao_raw) || safe(antt.situacao) || '—').toUpperCase(),
    },
    { label: 'APTO?', value: antt.apto == null ? '—' : antt.apto ? 'SIM' : 'NAO' },
  ];
  const colW = (CW - 2) / cells.length;
  cells.forEach((c, i) => {
    const x = ML + 2 + i * colW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.line(x, y, x, y + H);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(c.label, x + 2, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(c.value, colW - 4) as string[];
    doc.text(lines[0] ?? '', x + 2, y + 10);
  });

  // Linha 2: TRANSPORTADOR | CPF/CNPJ | MUN/UF | CADASTRADO DESDE
  doc.setDrawColor(...C.border);
  doc.line(ML + 2, y + 12, ML + CW, y + 12);

  const row2: { label: string; value: string }[] = [
    { label: 'TRANSPORTADOR', value: safe(antt.transportador) || '—' },
    { label: 'CPF / CNPJ', value: safe(antt.cpf_cnpj_mask) || '—' },
    { label: 'MUNICIPIO/UF', value: safe(antt.municipio_uf) || '—' },
    {
      label: 'CADASTRADO DESDE',
      value: antt.cadastrado_desde
        ? // ISO date (owner.created_at) ou string já formatada
          /^\d{4}-\d{2}-\d{2}/.test(antt.cadastrado_desde)
          ? fmtDate(antt.cadastrado_desde) || '—'
          : antt.cadastrado_desde
        : '—',
    },
  ];
  row2.forEach((c, i) => {
    const x = ML + 2 + i * colW;
    if (i > 0) {
      doc.setDrawColor(...C.border);
      doc.line(x, y + 12, x, y + H);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(c.label, x + 2, y + 15.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.text);
    const lines = doc.splitTextToSize(c.value, colW - 4) as string[];
    doc.text(lines[0] ?? '', x + 2, y + 20);
  });

  // Linha 3 (opcional): COMPROVANTE ANTT (link clicavel)
  if (hasComprovante && antt.comprovante_url) {
    doc.setDrawColor(...C.border);
    doc.line(ML + 2, y + 22, ML + CW, y + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text('COMPROVANTE ANTT', ML + 4, y + 25.5);

    // Link clicavel (jsPDF: textWithLink)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 90, 200);
    const url = antt.comprovante_url;
    const display = url.length > 110 ? `${url.slice(0, 107)}...` : url;
    (
      doc as PdfDoc & {
        textWithLink: (text: string, x: number, y: number, options: { url: string }) => void;
      }
    ).textWithLink(display, ML + 36, y + 25.5, { url });
  }

  return y + H + 1;
}

function drawSignature(doc: PdfDoc, y: number): number {
  const H = 18;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, H);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text);
  doc.text('Recebi(emos) em: ____ / ____ / ________', ML + 4, y + 7);
  doc.text('Assinado: ______________________________________________', ML + 4, y + 14);
  return y + H + 1;
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
  doc.text('VECTRA HUB - Itajai/SC', ML, ph - 3);
  doc.text(`Pagina 1/1`, PW - MR, ph - 3, { align: 'right' });
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function generateCollectionOrderPdf(
  payload: CollectionOrderPdfPayload
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as PdfDoc;
  const logo = payload.logoBase64Override ?? (await loadLogoBase64());

  let y = drawHeader(doc, payload, logo);
  y += 2;

  if (payload.cancelled) {
    drawWatermark(doc, 'CANCELADA');
  }

  y = drawSectionTitle(doc, 'REMETENTE', y);
  y = drawPartyBlock(doc, payload.sender, y);

  if (payload.sender_2?.name?.trim()) {
    y += 1;
    y = drawSectionTitle(doc, 'REMETENTE 2', y);
    y = drawPartyBlock(doc, payload.sender_2, y);
  }

  y = drawSectionTitle(doc, 'DESTINATARIO', y);
  y = drawPartyBlock(doc, payload.recipient, y);

  // Headers lado-a-lado MOTORISTA | VEICULO
  doc.setFillColor(...C.navy);
  doc.rect(ML, y, CW / 2, 5.5, 'F');
  doc.rect(ML + CW / 2, y, CW / 2, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.white);
  doc.text('MOTORISTA', ML + CW / 4, y + 3.8, { align: 'center' });
  doc.text('VEICULO', ML + (3 * CW) / 4, y + 3.8, { align: 'center' });
  y += 5.5;
  y = drawDriverVehicleBlock(doc, payload.driver, payload.vehicle, y);

  y = drawSectionTitle(doc, 'CARGA', y);
  y = drawCargoBlock(doc, payload.cargo, y);

  if (payload.antt) {
    y = drawSectionTitle(doc, 'CONSULTA ANTT / RNTRC', y);
    y = drawAnttBlock(doc, payload.antt, y);
  }

  y = drawSectionTitle(doc, 'OBSERVACAO', y);
  y = drawTextBlock(doc, payload.observation, y, 16);

  y = drawSectionTitle(doc, 'INFORMACOES ADICIONAIS', y);
  y = drawTextBlock(doc, payload.additional_info, y, 22);

  y = drawSchedule(doc, payload.pickup_date, payload.delivery_date, y);
  y = drawSignature(doc, y);

  drawFooter(doc);

  // suprimir uso "não-usado" do autoTable importado para manter consistência futura
  void autoTable;

  const fileName = `${payload.oc_number.replace(/[^\w-]+/g, '_')}.pdf`;
  return { blob: doc.output('blob'), fileName };
}
