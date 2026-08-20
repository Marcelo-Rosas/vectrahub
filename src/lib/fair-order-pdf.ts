import {
  detectFairDocKind,
  EMPTY_FAIR_CLIENT,
  formatFairCep,
  formatFairDocument,
  type FairClientDraft,
} from '@/lib/fair-client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import type { CatalogQuoteLine } from '@/lib/shipper-product-catalog';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
  type KonnenLineDraft,
  type KonnenParseResult,
  type MatchOrderLinesResult,
} from '@/lib/fair-order-pdf-konnen';

import type { FairFreightGateResult } from '@/lib/fair-freight-gate';

export type FairOrderPdfLine = {
  sku: string;
  quantity: number;
  name?: string;
  stackWeightKg?: number;
};

export type FairOrderPdfUnmatched = {
  rawSku: string;
  quantity: number;
  hint: string;
};

export type FairOrderPdfParseResponse = {
  client: FairClientDraft;
  cargoValue: number;
  lines: FairOrderPdfLine[];
  unmatched: FairOrderPdfUnmatched[];
  meta: {
    orderNo: string;
    pageCount: number;
    adapter: 'konnen-clicksign';
    gatePreview?: FairFreightGateResult;
  };
};

export type ApplyParseToQuoteResult = {
  client: FairClientDraft;
  cargoValue: number;
  lines: CatalogQuoteLine[];
  unmatched: FairOrderPdfUnmatched[];
  meta: FairOrderPdfParseResponse['meta'];
};

export function konnenClientToFairDraft(parsed: KonnenParseResult['client']): FairClientDraft {
  const kind = detectFairDocKind(parsed.document) ?? 'cnpj';
  return {
    ...EMPTY_FAIR_CLIENT,
    kind,
    document: formatFairDocument(kind, parsed.document),
    name: parsed.name,
    zipCode: formatFairCep(parsed.zipCode),
    address: parsed.address,
    email: parsed.email,
    city: parsed.city,
    state: parsed.state,
  };
}

/** Espelho client-side do match Edge (Vitest / preview). */
export function matchParsedLines(
  parsed: KonnenLineDraft[],
  catalogSkus: Iterable<string>,
  nameBySku?: Map<string, string>
): MatchOrderLinesResult {
  const set = new Set([...catalogSkus].map((s) => s.trim().toUpperCase()));
  return matchOrderLinesToCatalog(parsed, set, nameBySku);
}

export function applyParseToQuote(response: FairOrderPdfParseResponse): ApplyParseToQuoteResult {
  return {
    client: response.client,
    cargoValue: response.cargoValue,
    lines: response.lines.map(({ sku, quantity, stackWeightKg }) => ({
      sku,
      quantity,
      stackWeightKg,
    })),
    unmatched: response.unmatched,
    meta: response.meta,
  };
}

export { parseKonnenOrderText, type KonnenParseResult };

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Falha ao ler PDF'));
        return;
      }
      const base64 = result.includes(',') ? (result.split(',')[1] ?? '') : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler PDF'));
    reader.readAsDataURL(file);
  });
}

/** Envia PDF para Edge feira-parse-order-pdf e retorna cotação parcial. */
export async function parseFairOrderPdf(file: File): Promise<FairOrderPdfParseResponse> {
  if (file.type && file.type !== 'application/pdf') {
    throw new Error('Selecione um arquivo PDF');
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF excede 10 MB');
  }
  const pdfBase64 = await readFileAsBase64(file);
  return invokeEdgeFunction<FairOrderPdfParseResponse>('feira-parse-order-pdf', {
    body: { pdfBase64, adapter: 'konnen-clicksign' },
    requireAuth: true,
  });
}
