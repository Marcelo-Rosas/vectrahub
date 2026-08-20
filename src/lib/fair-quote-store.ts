import type { FairClientDraft } from '@/lib/fair-client';

export type FairSavedQuote = {
  id: string;
  code: string;
  createdAt: string;
  tenantSlug: string;
  eventFlag: string;
  sellerEmail: string | null;
  client: FairClientDraft;
  origin: string;
  destination: string;
  km: number;
  cargoValue: number;
  lines: { sku: string; quantity: number; selectedBoxTypes?: string[] }[];
  weightKg: number;
  volumeM3: number;
  boxesCount: number;
  freightWeight: number;
  hubTotalCliente: number;
  pedagioEstimado: number;
  totalExibido: number;
  kmBandLabel: string | null;
};

const KEY = 'feira-saved-quotes';

export function loadFairQuotes(): FairSavedQuote[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FairSavedQuote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistFairQuote(quote: FairSavedQuote): FairSavedQuote {
  const list = loadFairQuotes().filter((q) => q.id !== quote.id);
  list.unshift(quote);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
  return quote;
}

export function nextFairQuoteCode(existing = loadFairQuotes()): string {
  const stamp = new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, '0');
  const d = String(stamp.getDate()).padStart(2, '0');
  const seq = String(existing.length + 1).padStart(4, '0');
  return `FEIRA-${y}${m}${d}-${seq}`;
}
