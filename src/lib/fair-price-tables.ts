export type FairPriceTableRow = {
  id: string;
  active: boolean | null;
  modality: string | null;
  methodology?: string | null;
};

export function pickDefaultLotacaoTableId(tables: FairPriceTableRow[]): string {
  const pool = tables.filter(
    (t) => t.active && t.modality === 'lotacao' && t.methodology !== 'fracionado_parceiro'
  );
  const lot = pool.find((t) => t.methodology === 'lotacao');
  return lot?.id || pool[0]?.id || '';
}

export function pickDefaultFracionadoNtcTableId(tables: FairPriceTableRow[]): string {
  const pool = tables.filter(
    (t) => t.active && t.modality === 'fracionado' && t.methodology === 'fracionado_ntc'
  );
  const ntc = pool.find((t) => t.methodology !== 'fracionado_parceiro');
  return ntc?.id || pool[0]?.id || '';
}

export function pickFairPriceTableId(
  tables: FairPriceTableRow[],
  hubModality: 'lotacao' | 'fracionado'
): string {
  return hubModality === 'lotacao'
    ? pickDefaultLotacaoTableId(tables)
    : pickDefaultFracionadoNtcTableId(tables);
}
