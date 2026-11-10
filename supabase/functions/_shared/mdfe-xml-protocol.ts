/**
 * Protocolo de autorização do MDF-e a partir do XML processado (mdfeProc/protMDFe/infProt).
 * Fonte da data real de autorização (dhRecbto) quando o webhook Focus de MDF-e não grava
 * `data_autorizacao` — inclusive para MDF-e já encerrado (updated_at reflete o encerramento).
 */
export function protocolFromMdfeXml(xml: string): {
  nProt: string | null;
  dhRecbto: string | null;
} {
  const inf = xml.match(/<infProt[\s\S]*?<\/infProt>/)?.[0] ?? '';
  const nProt = inf.match(/<nProt>(\d{15})<\/nProt>/)?.[1] ?? null;
  const cStat = inf.match(/<cStat>(\d+)<\/cStat>/)?.[1] ?? null;
  const rawDh = inf.match(/<dhRecbto>([^<]+)<\/dhRecbto>/)?.[1]?.trim() ?? null;
  let dhRecbto: string | null = null;
  if (rawDh && cStat === '100') {
    const d = new Date(rawDh);
    dhRecbto = Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return { nProt, dhRecbto };
}
