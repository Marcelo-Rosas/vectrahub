export type FairDocKind = 'cnpj' | 'cpf';

export type FairClientDraft = {
  kind: FairDocKind;
  document: string;
  name: string;
  zipCode: string;
  address: string;
  email: string;
  city: string;
  state: string;
  /** Entrega ≠ cadastro Receita/CEP — libera cidade + CEP de entrega. */
  deliveryDifferent: boolean;
  deliveryZip: string;
  deliveryCity: string;
  deliveryState: string;
};

export const EMPTY_FAIR_CLIENT: FairClientDraft = {
  kind: 'cnpj',
  document: '',
  name: '',
  zipCode: '',
  address: '',
  email: '',
  city: '',
  state: '',
  deliveryDifferent: false,
  deliveryZip: '',
  deliveryCity: '',
  deliveryState: '',
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectFairDocKind(document: string): FairDocKind | null {
  const d = digitsOnly(document);
  if (d.length === 14) return 'cnpj';
  if (d.length === 11) return 'cpf';
  return null;
}

export function formatFairDocument(kind: FairDocKind, raw: string): string {
  if (kind === 'cnpj') {
    const d = digitsOnly(raw).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
    if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatFairCep(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function composeFairAddress(parts: {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const line = [parts.street, parts.number, parts.neighborhood].filter(Boolean).join(', ');
  const cityUf = [parts.city, parts.state].filter(Boolean).join(' - ');
  return [line, cityUf].filter(Boolean).join(' · ');
}

export function isFairClientReady(client: FairClientDraft): boolean {
  const doc = digitsOnly(client.document);
  const docOk = client.kind === 'cnpj' ? doc.length === 14 : doc.length === 11;
  return docOk && client.name.trim().length > 1;
}

export function fairCadastroCityUf(client: FairClientDraft): string {
  if (!client.city.trim()) return '';
  return client.state.trim()
    ? `${client.city.trim()} - ${client.state.trim().toUpperCase()}`
    : client.city.trim();
}

/** Destino da rota: cadastro CNPJ/CEP, ou cidade de entrega se marcado diferente. */
export function fairDestinationLabel(client: FairClientDraft): string {
  if (client.deliveryDifferent) {
    if (!client.deliveryCity.trim()) return '';
    return client.deliveryState.trim()
      ? `${client.deliveryCity.trim()} - ${client.deliveryState.trim().toUpperCase()}`
      : client.deliveryCity.trim();
  }
  return fairCadastroCityUf(client);
}

export function fairDestinationCep(client: FairClientDraft): string {
  return digitsOnly(client.deliveryDifferent ? client.deliveryZip : client.zipCode);
}

export function fairDestinationUf(client: FairClientDraft): string {
  const uf = client.deliveryDifferent ? client.deliveryState : client.state;
  return uf.trim().toUpperCase().slice(0, 2);
}
