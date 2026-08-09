/** Recibo oficial AILOG/WebRouter (getReciboViagem / emitirReciboViagem). Sem PDF binário. */
export type VpoReciboViagem = {
  id: number | null;
  emissor: string | null;
  idViagemOSA: number | null;
  codigoViagemOSA: string | null;
  descricaoCategoria: string | null;
  cnpjEmissor: string | null;
  nomeEmissor: string | null;
  cnpjTransportador: string | null;
  nomeTransportador: string | null;
  dataCompra: string | null;
  dataHoraExportacao: string | null;
  dataViagem: string | null;
  urlLogo: string | null;
  nomeRota: string | null;
  status: string | null;
  tipo: string | null;
  valorTotal: number | null;
};

export function parseVpoReciboViagem(raw: unknown): VpoReciboViagem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
  const recibo: VpoReciboViagem = {
    id: num(o.id),
    emissor: str(o.emissor),
    idViagemOSA: num(o.idViagemOSA),
    codigoViagemOSA: str(o.codigoViagemOSA),
    descricaoCategoria: str(o.descricaoCategoria),
    cnpjEmissor: str(o.cnpjEmissor),
    nomeEmissor: str(o.nomeEmissor),
    cnpjTransportador: str(o.cnpjTransportador),
    nomeTransportador: str(o.nomeTransportador),
    dataCompra: str(o.dataCompra),
    dataHoraExportacao: str(o.dataHoraExportacao),
    dataViagem: str(o.dataViagem),
    urlLogo: str(o.urlLogo),
    nomeRota: str(o.nomeRota),
    status: str(o.status),
    tipo: str(o.tipo),
    valorTotal: num(o.valorTotal),
  };
  const hasSignal =
    recibo.status != null ||
    recibo.valorTotal != null ||
    recibo.id != null ||
    recibo.codigoViagemOSA != null ||
    recibo.dataCompra != null;
  return hasSignal ? recibo : null;
}

export function isVpoReciboOk(recibo: VpoReciboViagem | null | undefined): boolean {
  if (!recibo) return false;
  const status = String(recibo.status ?? '').toUpperCase();
  return status === 'SUCESSO' || recibo.valorTotal != null || Boolean(recibo.codigoViagemOSA);
}
