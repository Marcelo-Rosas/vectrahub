export const AVERBA_MS_TO_DEFAULT = [
  'operacional.cargo@fairfax.com.br',
  'kevin.cercal@msseguros.com',
  'Fellipe.medeiros@msseguros.com',
  'Ruan.nascimento@msseguros.com',
];

export const AVERBA_MS_CC_DEFAULT = ['marcelo.rosas@vectracargo.com.br'];

export type AverbaMsRow = {
  data: string;
  cte: number | string;
  placa: string;
  ufOrigem: string;
  ufDestino: string;
  valorMercadoria: number;
  dest: string;
};

export function parseEmailList(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '');
  return text
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV ; (Excel BR) + BOM UTF-8. */
export function buildAverbaMsCsv(rows: AverbaMsRow[]): Uint8Array {
  const header = [
    'DATA',
    'CTE',
    'PLACA',
    'UF ORIGEM',
    'UF DESTINO',
    'VALOR MERCADORIA',
    'DESTINATARIO',
  ];
  const lines = [
    header.join(';'),
    ...rows.map((r) =>
      [
        csvCell(r.data),
        csvCell(r.cte),
        csvCell(r.placa),
        csvCell(r.ufOrigem),
        csvCell(r.ufDestino),
        csvCell(
          Number(r.valorMercadoria).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        ),
        csvCell(r.dest),
      ].join(';')
    ),
  ];
  const text = `\uFEFF${lines.join('\r\n')}`;
  return new TextEncoder().encode(text);
}

export function formatPtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatBRL(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildAverbaMsHtml(input: {
  quoteCode: string;
  plate: string;
  rows: AverbaMsRow[];
}): string {
  const rowsHtml = input.rows
    .map(
      (r) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #d6dce5">${r.cte}</td>
          <td style="padding:6px 8px;border:1px solid #d6dce5">${r.dest}</td>
          <td style="padding:6px 8px;border:1px solid #d6dce5">${r.ufOrigem}→${r.ufDestino}</td>
          <td style="padding:6px 8px;border:1px solid #d6dce5;text-align:right">${formatBRL(r.valorMercadoria)}</td>
        </tr>`
    )
    .join('');
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;color:#1e2330;font-size:14px">
  <p>Boa tarde,</p>
  <p>Segue averbação <strong>manual Fairfax / MS</strong> da cotação <strong>${input.quoteCode}</strong>, placa <strong>${input.plate || '—'}</strong>.</p>
  <p>CT-es autorizados SEFAZ (XML + planilha em anexo):</p>
  <table style="border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#1b2a4a;color:#fff">
        <th style="padding:6px 8px;text-align:left">CT-e</th>
        <th style="padding:6px 8px;text-align:left">Destinatário</th>
        <th style="padding:6px 8px;text-align:left">UFs</th>
        <th style="padding:6px 8px;text-align:right">Valor mercadoria</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="margin-top:16px">Atenciosamente,<br/>Vectra Hub LTDA</p>
</body></html>`;
}
