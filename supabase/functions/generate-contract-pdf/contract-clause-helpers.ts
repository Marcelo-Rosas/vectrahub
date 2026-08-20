/** Helpers para cláusulas dinâmicas do contrato (pagamento e itens inclusos). */

const MANDATORY_INCLUDED = ['Impostos', 'Pedágio', 'Seguro'] as const;

/** CNPJ mascarado para o PDF (aceita valor só com dígitos). */
export function formatCnpjForContract(value: string | null | undefined): string {
  if (!value) return '';
  const d = String(value).replace(/\D/g, '').slice(0, 14);
  if (d.length !== 14) return String(value).trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

export function formatBrlReais(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDateBr(iso: string | null | undefined): string {
  if (!iso) return '___/___/______';
  const datePart = iso.includes('T') ? iso.split('T')[0] : iso.slice(0, 10);
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '___/___/______';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function fmtTodayBr(): string {
  const now = new Date();
  return fmtDateBr(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  );
}

/**
 * Resolve a parte CONTRATANTE do contrato conforme o tipo de frete.
 *
 * Regra comercial: em operação **CIF** o frete é de responsabilidade do
 * embarcador (remetente), portanto o embarcador (`shippers`) figura como
 * CONTRATANTE e pagador. Em **FOB** (ou CIF sem embarcador cadastrado) o
 * CONTRATANTE é o cliente (`clients`).
 */
export function resolveContractContratante(quote: Record<string, unknown>): {
  party: Record<string, unknown>;
  name: string;
  isCif: boolean;
  source: 'shipper' | 'client';
} {
  const freightType = String(quote.freight_type ?? '')
    .trim()
    .toUpperCase();
  const isCif = freightType === 'CIF';
  const client = (quote.clients as Record<string, unknown> | null) ?? {};
  const shipper = (quote.shippers as Record<string, unknown> | null) ?? {};
  const shipperHasData = Boolean(
    (shipper.name && String(shipper.name).trim()) || (shipper.cnpj && String(shipper.cnpj).trim())
  );

  if (isCif && shipperHasData) {
    return {
      party: shipper,
      name: String(quote.shipper_name ?? shipper.name ?? '[embarcador não informado]'),
      isCif: true,
      source: 'shipper',
    };
  }

  return {
    party: client,
    name: String(client.name ?? quote.client_name ?? '[cliente não informado]'),
    isCif,
    source: 'client',
  };
}

/**
 * Deriva o código CTR do contrato a partir do `quote_code`.
 * Com sequence → sufixo `-01`, `-02`.
 */
export function ctrCodeFromQuoteCode(
  quoteCode: string | null | undefined,
  sequence?: number
): string {
  const code = String(quoteCode ?? '').trim();
  let base = 'CTR';
  if (code) {
    base = /^COT-/i.test(code) ? code.replace(/^COT-/i, 'CTR-') : `CTR-${code}`;
  }
  if (sequence == null || sequence < 1) return base;
  return `${base}-${String(sequence).padStart(2, '0')}`;
}

/** CONTRATANTE a partir de um pagador explícito do split (multi-payer). */
export function resolveContractContratanteFromSplit(
  quote: Record<string, unknown>,
  split: {
    party_type: 'client' | 'shipper';
    name: string;
    party: Record<string, unknown>;
  }
): {
  party: Record<string, unknown>;
  name: string;
  isCif: boolean;
  source: 'shipper' | 'client';
} {
  const freightIsCif =
    String(quote.freight_type ?? '')
      .trim()
      .toUpperCase() === 'CIF';
  return {
    party: split.party,
    name: split.name,
    isCif: freightIsCif && split.party_type === 'shipper',
    source: split.party_type === 'shipper' ? 'shipper' : 'client',
  };
}

/** Contratos emitidos antes da regra CTR canônica (prefixo COT no filename). */
export function isLegacyContractFilename(fileName: string | null | undefined): boolean {
  const name = String(fileName ?? '').trim();
  if (!name) return false;
  if (/^CTR-/i.test(name)) return false;
  return /^COT-/i.test(name) || /_contrato_v/i.test(name);
}

/** Slug da razão social do pagador para nome de arquivo (ASCII, maiúsculo). */
export function slugifyPayer(name: string | null | undefined): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
    .slice(0, 80);
}

/**
 * Referência canônica exibida no documento: `CÓDIGO — RAZÃO SOCIAL DO PAGADOR`.
 * A razão social do pagador fica SEMPRE após o número (regra canônica).
 */
export function buildCanonicalReference(
  code: string,
  payerName: string | null | undefined
): string {
  const c = String(code ?? '').trim() || '[SEM CÓDIGO]';
  const p = String(payerName ?? '').trim();
  return p ? `${c} — ${p}` : c;
}

/** Nome de arquivo canônico: `CÓDIGO-RAZAO_SOCIAL_SLUG.ext` (pagador após o número). */
export function buildCanonicalFilename(
  code: string,
  payerName: string | null | undefined,
  ext = 'pdf'
): string {
  const c =
    String(code ?? '')
      .trim()
      .replace(/[^\w-]+/g, '_') || 'documento';
  const slug = slugifyPayer(payerName);
  return slug ? `${c}-${slug}.${ext}` : `${c}.${ext}`;
}

/** 5.3 — condição de pagamento com prazo/parcelas quando disponíveis. */
export function buildPaymentTermsDescription(
  quote: Record<string, unknown>,
  paymentTerm: Record<string, unknown> | null
): string {
  const name = String(paymentTerm?.name ?? 'condição não informada');
  const advancePercent = paymentTerm?.advance_percent as number | null | undefined;
  const days = paymentTerm?.days as number | undefined;
  const advanceDate = quote.advance_due_date as string | null | undefined;
  const balanceDate = quote.balance_due_date as string | null | undefined;

  const parts: string[] = [name];

  if (advancePercent != null && advancePercent > 0) {
    parts.push(`com entrada de ${advancePercent}%`);
    if (advanceDate) parts.push(`vencimento da entrada em ${fmtDateBr(advanceDate)}`);
    if (balanceDate) parts.push(`saldo em ${fmtDateBr(balanceDate)}`);
  } else if (days != null && days > 0) {
    parts.push(`prazo de ${days} dias corridos`);
  }

  return parts.join(', ');
}

type LineItem = {
  name?: string;
  code?: string;
  total?: number;
  quantity?: number;
  selected?: boolean;
};

function normalizeKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function humanizeFeeKey(key: string): string {
  if (/^[0-9a-f-]{36}$/i.test(key)) return 'Taxa adicional';
  const cleaned = key.replace(/_/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isMaoDeObraLabel(name: string): boolean {
  return /m[aã]o\s*de\s*obra/i.test(name);
}

function isCargaDescargaLabel(name: string): boolean {
  const n = normalizeKey(name);
  return n.includes('carga') && n.includes('descarga');
}

/** 5.2 — obrigatórios + itens extras detectados no pricing_breakdown da cotação. */
export function buildClause52IncludedItems(quote: Record<string, unknown>): {
  allItems: string[];
  optionalItems: string[];
  text: string;
} {
  const items: string[] = [...MANDATORY_INCLUDED];
  const seen = new Set(MANDATORY_INCLUDED.map((s) => normalizeKey(s)));

  const add = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    items.push(trimmed);
  };

  const pb = quote.pricing_breakdown as Record<string, unknown> | null | undefined;
  if (pb && typeof pb === 'object') {
    const components = pb.components as Record<string, number> | undefined;
    const meta = pb.meta as Record<string, unknown> | undefined;
    const profitability = pb.profitability as Record<string, number> | undefined;

    const unloading = (meta?.unloadingCost as LineItem[] | undefined) ?? [];
    for (const row of unloading) {
      const total = Number(row.total ?? 0);
      const qty = Number(row.quantity ?? 0);
      if (total <= 0 && qty <= 0) continue;
      const name = String(row.name ?? row.code ?? '').trim();
      if (!name) continue;
      if (isMaoDeObraLabel(name)) {
        add('Mão de Obra');
      } else if (isCargaDescargaLabel(name)) {
        add('Carga e Descarga');
      } else {
        add(name);
      }
    }

    if (unloading.length === 0 && Number(profitability?.custosDescarga ?? 0) > 0) {
      add('Carga e Descarga');
    }

    const equipment = (meta?.equipmentRental as LineItem[] | undefined) ?? [];
    for (const row of equipment) {
      const selected = row.selected !== false;
      const total = Number(row.total ?? 0);
      const qty = Number(row.quantity ?? 0);
      if (!selected || (total <= 0 && qty <= 0)) continue;
      add(String(row.name ?? 'Aluguel de Máquinas'));
    }

    if (Number(components?.aluguelMaquinas ?? 0) > 0) {
      add('Aluguel de Máquinas');
    }
    if (Number(components?.waitingTimeCost ?? 0) > 0) {
      add('Estadia / Tempo de Espera');
    }
    if (Number(components?.tde ?? 0) > 0) add('TDE');
    if (Number(components?.tear ?? 0) > 0) add('TEAR (NTC)');
    if (Number(components?.dispatchFee ?? 0) > 0) add('Taxa de Despacho');

    const condPb = pb.conditionalFeesBreakdown as Record<string, number> | undefined;
    if (condPb && typeof condPb === 'object') {
      for (const [key, val] of Object.entries(condPb)) {
        if (Number(val) > 0) add(humanizeFeeKey(key));
      }
    }
  }

  const quoteCond = quote.conditional_fees_breakdown as Record<string, number> | undefined;
  if (quoteCond && typeof quoteCond === 'object') {
    for (const [key, val] of Object.entries(quoteCond)) {
      if (Number(val) > 0) add(humanizeFeeKey(key));
    }
  }

  const optionalItems = items.filter(
    (i) => !MANDATORY_INCLUDED.some((m) => normalizeKey(m) === normalizeKey(i))
  );

  const listText = items.join(', ');
  const text =
    optionalItems.length > 0
      ? `5.2. O valor do frete informado contempla os itens obrigatórios (Impostos, Pedágio e Seguro) e, quando aplicáveis à operação, também: ${optionalItems.join(', ')}.`
      : `5.2. O valor do frete informado contempla os itens obrigatórios: ${listText}.`;

  return { allItems: items, optionalItems, text };
}
