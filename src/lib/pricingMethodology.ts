export const PRICE_TABLE_METHODOLOGIES = [
  'lotacao',
  'fracionado_ntc',
  'fracionado_parceiro',
] as const;

export type PriceTableMethodology = (typeof PRICE_TABLE_METHODOLOGIES)[number];

export const METHODOLOGY_LABELS: Record<PriceTableMethodology, string> = {
  lotacao: 'Lotação',
  fracionado_ntc: 'Fracionado NTC',
  fracionado_parceiro: 'Fracionado Parceiro',
};

export function isPriceTableMethodology(v: unknown): v is PriceTableMethodology {
  return typeof v === 'string' && (PRICE_TABLE_METHODOLOGIES as readonly string[]).includes(v);
}

export function modalityFromMethodology(m: PriceTableMethodology): 'lotacao' | 'fracionado' {
  return m === 'lotacao' ? 'lotacao' : 'fracionado';
}

export function marginKeyForMethodology(m: PriceTableMethodology): string {
  switch (m) {
    case 'lotacao':
      return 'profit_margin_lotacao_percent';
    case 'fracionado_ntc':
      return 'profit_margin_fracionado_percent';
    case 'fracionado_parceiro':
      return 'profit_margin_parceiro_fracionado_percent';
  }
}

export function methodologyHasHubFiscal(m: PriceTableMethodology): boolean {
  return m === 'lotacao' || m === 'fracionado_ntc';
}
