/** Parser determinístico para Proposta Comercial Buckler (PDF). */

import { isBucklerExcludedOrderSku } from '@/lib/buckler-catalog-sku';

export type BucklerClientDraft = {
  document: string;
  name: string;
  zipCode: string;
  city: string;
  state: string;
  address: string;
  email: string;
};

export type BucklerLineDraft = {
  sku: string;
  quantity: number;
};

export type BucklerParseResult = {
  client: BucklerClientDraft;
  cargoValue: number;
  lines: BucklerLineDraft[];
  orderNo: string;
};

const ITEM_LINE_RE =
  /\b(FM-\d{4}[A-Z]?|PF-\d{4}|LD-\d{4}[A-Z]?|FW-\d{4}[A-Z]?|M2-\d{4}[A-Z]?|GL-\d{4}|S\d{3,4}|RS-\d{3,4})\b[\s\S]*?R\$\s*[\d.]+\s*,\d{2}\s+R\$\s*[\d.]+\s*,\d{2}\s+(\d+)\s+R\$/gi;

/** Remove rodapé Buckler / bloco legal. */
export function stripBucklerNoise(text: string): string {
  const markers = [
    /Este documento constitui parte integrante/i,
    /MEDIDA PROVISÓRIA No 2\.200-2/i,
    /Documento assinado com validade jurídica/i,
  ];
  let end = text.length;
  for (const re of markers) {
    const idx = text.search(re);
    if (idx >= 0 && idx < end) end = idx;
  }
  let cleaned = text.slice(0, end).replace(/--- PAGE ---/g, '\n');
  cleaned = cleaned
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^@bucklerfit/i.test(t)) return false;
      if (/^\+ 55\(11\)/.test(t)) return false;
      if (/^\/buckler-fit/i.test(t)) return false;
      return true;
    })
    .join('\n');
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

export function parseBucklerOrderNo(text: string): string {
  return text.match(/Proposta nº\s*([\d.]+)/i)?.[1]?.replace(/\./g, '') ?? '';
}

export function parseBucklerCargoValue(text: string): number {
  const m = text.match(/Valor Total[\s\S]{0,60}?R\$\s*([\d.]+,\d{2})/i);
  if (!m) return 0;
  return Number(m[1].replace(/\./g, '').replace(',', '.')) || 0;
}

export function parseBucklerClient(text: string): BucklerClientDraft {
  const name =
    text.match(/Nome Fantasia\s*([^\n]+)/i)?.[1]?.trim() ??
    text.match(/Razão Social\s*([^\n]+)/i)?.[1]?.trim() ??
    '';
  const email =
    text
      .match(/E-mail\s*(\S+@\S+)/i)?.[1]
      ?.trim()
      .replace(/[^\w@.-]/g, '') ?? '';
  const document =
    text.match(/CNPJ[\s\S]{0,120}?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i)?.[1]?.replace(/\D/g, '') ??
    text.match(/CPF[\s\S]{0,80}?(\d{3}\.\d{3}\.\d{3}-\d{2})/i)?.[1]?.replace(/\D/g, '') ??
    '';
  const cep = text.match(/CEP[\s\S]{0,40}?(\d{5}-?\d{3})/i)?.[1]?.replace(/\D/g, '') ?? '';
  return {
    document,
    name,
    zipCode: cep,
    city: '',
    state: '',
    address: '',
    email,
  };
}

export function parseBucklerLines(text: string): BucklerLineDraft[] {
  const cleaned = stripBucklerNoise(text);
  const bySku = new Map<string, BucklerLineDraft>();
  for (const m of cleaned.matchAll(ITEM_LINE_RE)) {
    const sku = m[1]!.toUpperCase();
    const quantity = Math.max(1, Number(m[2]) || 1);
    const prev = bySku.get(sku);
    bySku.set(sku, { sku, quantity: (prev?.quantity ?? 0) + quantity });
  }
  return [...bySku.values()]
    .filter((row) => !isBucklerExcludedOrderSku(row.sku))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

export function parseBucklerOrderText(text: string): BucklerParseResult {
  return {
    client: parseBucklerClient(text),
    cargoValue: parseBucklerCargoValue(text),
    lines: parseBucklerLines(text),
    orderNo: parseBucklerOrderNo(text),
  };
}

export function bucklerClientToFairDraft(parsed: BucklerClientDraft) {
  return parsed;
}
