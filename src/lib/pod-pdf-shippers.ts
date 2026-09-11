import { slugifyPayer } from '@/lib/canonical-doc-ref';
import { nfeEmitCnpjFromChave, nfeNumeroFromChave } from '@/lib/cte-nfe-split';

/** Fatia de um embarcador para o POD (origem, NFs e CT-es só dele). */
export interface PodShipperSlice {
  name: string;
  origin: string | null;
  nfe_numbers: string[];
  cte_numbers: string[];
  cnpj?: string | null;
  weight_kg?: number | null;
  shipper_id?: string | null;
  /** Data URL do canhoto deste embarcador (VG: um por PDF). */
  pod_image_data_url?: string | null;
}

export interface PodCanhotoRef {
  dataUrl: string;
  shipper_id?: string | null;
  shipper_name?: string | null;
  file_name?: string | null;
}

export interface PodAdditionalShipperInput {
  name: string;
  shipper_id?: string;
  origin?: string | null;
  cnpj?: string | null;
  weight_kg?: number | null;
}

export interface PodNfeRef {
  key: string;
}

export interface PodCteRef {
  numero: number;
  status: string;
  remetente_name?: string | null;
  remetente_cnpj?: string | null;
}

export function isVgPodReference(...codes: Array<string | null | undefined>): boolean {
  return codes.some((code) => /^VG-/i.test(String(code ?? '').trim()));
}

export function digitsOnly(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function cnpjRoot(value: string | null | undefined): string {
  return digitsOnly(value).slice(0, 8);
}

export function normalizePartyName(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function partyNamesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const x = normalizePartyName(a);
  const y = normalizePartyName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function shipperOwnsCnpj(
  shipperCnpj: string | null | undefined,
  otherCnpj: string | null | undefined
): boolean {
  const a = digitsOnly(shipperCnpj);
  const b = digitsOnly(otherCnpj);
  if (a.length < 8 || b.length < 8) return false;
  if (a === b) return true;
  return cnpjRoot(a) === cnpjRoot(b);
}

export function parsePodDocumentMeta(meta: unknown): {
  shipper_id?: string;
  shipper_name?: string;
} {
  if (!meta || typeof meta !== 'object') return {};
  const row = meta as Record<string, unknown>;
  return {
    shipper_id: typeof row.shipper_id === 'string' ? row.shipper_id : undefined,
    shipper_name: typeof row.shipper_name === 'string' ? row.shipper_name : undefined,
  };
}

export function parsePodAdditionalShippers(value: unknown): PodAdditionalShipperInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => {
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const cityUf = typeof item.city_uf === 'string' ? item.city_uf.trim() : '';
      const weight =
        typeof item.weight_kg === 'number' && Number.isFinite(item.weight_kg)
          ? item.weight_kg
          : null;
      return {
        name,
        shipper_id: typeof item.shipper_id === 'string' ? item.shipper_id : undefined,
        origin: cityUf || null,
        cnpj: typeof item.cnpj === 'string' ? item.cnpj : null,
        weight_kg: weight,
      };
    })
    .filter((item) => item.name.length > 0);
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function nfeBelongsToShipper(key: string, slice: PodShipperSlice): boolean {
  const emit = nfeEmitCnpjFromChave(key);
  return shipperOwnsCnpj(slice.cnpj, emit);
}

function cteBelongsToShipper(cte: PodCteRef, slice: PodShipperSlice): boolean {
  if (shipperOwnsCnpj(slice.cnpj, cte.remetente_cnpj)) return true;
  return partyNamesMatch(slice.name, cte.remetente_name);
}

function isAuthorizedCte(status: string): boolean {
  return (
    String(status ?? '')
      .trim()
      .toLowerCase() === 'authorized'
  );
}

/**
 * Monta uma fatia por embarcador (principal + adicionais) e atribui NF/CT-e
 * pelo CNPJ do emitente/remetente (raiz de 8 dígitos) ou pelo nome.
 */
export function buildPodShipperSlices(input: {
  primaryName: string | null | undefined;
  primaryOrigin?: string | null;
  primaryCnpj?: string | null;
  primaryShipperId?: string | null;
  additional: PodAdditionalShipperInput[];
  nfes?: PodNfeRef[];
  ctes?: PodCteRef[];
}): PodShipperSlice[] {
  const slices: PodShipperSlice[] = [];
  const primary = String(input.primaryName ?? '').trim();
  if (primary) {
    slices.push({
      name: primary,
      origin: input.primaryOrigin?.trim() || null,
      nfe_numbers: [],
      cte_numbers: [],
      cnpj: input.primaryCnpj ?? null,
      shipper_id: input.primaryShipperId ?? null,
    });
  }

  for (const extra of input.additional) {
    if (slices.some((s) => partyNamesMatch(s.name, extra.name))) continue;
    slices.push({
      name: extra.name,
      origin: extra.origin?.trim() || null,
      nfe_numbers: [],
      cte_numbers: [],
      cnpj: extra.cnpj ?? null,
      weight_kg: extra.weight_kg ?? null,
      shipper_id: extra.shipper_id ?? null,
    });
  }

  const nfes = input.nfes ?? [];
  for (const nfe of nfes) {
    const numero = nfeNumeroFromChave(nfe.key);
    if (!numero) continue;
    const owner = slices.find((s) => nfeBelongsToShipper(nfe.key, s));
    if (owner) owner.nfe_numbers = uniqueKeepOrder([...owner.nfe_numbers, numero]);
  }

  const ctes = (input.ctes ?? []).filter((c) => isAuthorizedCte(c.status));
  for (const cte of ctes) {
    const numero = String(cte.numero);
    const owner = slices.find((s) => cteBelongsToShipper(cte, s));
    if (owner) owner.cte_numbers = uniqueKeepOrder([...owner.cte_numbers, numero]);
  }

  return slices;
}

/**
 * Associa canhotos aos embarcadores: shipper_id → nome → trecho do arquivo → ordem de upload.
 */
export function assignCanhotosToShippers(
  shippers: PodShipperSlice[],
  canhotos: PodCanhotoRef[]
): PodShipperSlice[] {
  const out = shippers.map((s) => ({ ...s }));
  const used = new Set<number>();

  const take = (index: number, slice: PodShipperSlice) => {
    slice.pod_image_data_url = canhotos[index]?.dataUrl ?? null;
    used.add(index);
  };

  for (const slice of out) {
    if (slice.pod_image_data_url || !slice.shipper_id) continue;
    const idx = canhotos.findIndex(
      (c, i) => !used.has(i) && c.shipper_id && c.shipper_id === slice.shipper_id
    );
    if (idx >= 0) take(idx, slice);
  }

  for (const slice of out) {
    if (slice.pod_image_data_url) continue;
    const idx = canhotos.findIndex(
      (c, i) => !used.has(i) && partyNamesMatch(c.shipper_name, slice.name)
    );
    if (idx >= 0) take(idx, slice);
  }

  for (const slice of out) {
    if (slice.pod_image_data_url) continue;
    const slug = slugifyPayer(slice.name);
    if (!slug) continue;
    const idx = canhotos.findIndex((c, i) => {
      if (used.has(i) || !c.file_name) return false;
      const fileSlug = slugifyPayer(c.file_name);
      return fileSlug.includes(slug);
    });
    if (idx >= 0) take(idx, slice);
  }

  for (const slice of out) {
    if (slice.pod_image_data_url) continue;
    const idx = canhotos.findIndex((_, i) => !used.has(i));
    if (idx >= 0) take(idx, slice);
  }

  return out;
}

export function shouldSplitPodByShipper(input: {
  os_number?: string | null;
  trip_number?: string | null;
  shippers: PodShipperSlice[];
}): boolean {
  return isVgPodReference(input.os_number, input.trip_number) && input.shippers.length >= 2;
}

/** Código usado no nome do arquivo: VG da viagem, senão OS. */
export function podPdfCode(osNumber: string, tripNumber?: string | null): string {
  const trip = String(tripNumber ?? '').trim();
  if (isVgPodReference(trip)) return trip;
  return String(osNumber ?? '').trim() || 'OS';
}

export function podPdfFileName(code: string, shipperName?: string | null): string {
  const safeCode =
    String(code ?? '')
      .trim()
      .replace(/[^\w-]+/g, '_') || 'POD';
  const slug = slugifyPayer(shipperName);
  const base = `POD-${safeCode}`;
  return slug ? `${base}-${slug}.pdf` : `${base}.pdf`;
}

export function singlePodPdfFileName(osNumber: string): string {
  return `comprovante-entrega-${osNumber}.pdf`;
}
