import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { extractText, getDocumentProxy } from 'unpdf';
import { parseKonnenOrderText } from '../src/lib/fair-order-pdf-konnen.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';

const QUOTE_ID = 'bda34c7d-8939-4038-a24c-cb43fdce935b';
const PDF_PATH =
  process.argv[2] ?? 'C:/Users/marce/Downloads/FEIRA-2026-08-0001-CLIENTE-DG_ACADEMIAS_LTDA.pdf';

const env = loadSupabaseScriptEnv();
const sb = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const bytes = readFileSync(PDF_PATH);
const pdf = await getDocumentProxy(new Uint8Array(bytes));
const { text } = await extractText(pdf, { mergePages: true });
const pdfText = typeof text === 'string' ? text : text.join('\n');
writeFileSync('docs/homolog/_feira-pdf-0001-extract.txt', pdfText, 'utf8');

const { data: quote, error: qErr } = await sb
  .schema('feira')
  .from('quotes')
  .select('*')
  .eq('id', QUOTE_ID)
  .maybeSingle();
if (qErr) throw qErr;

const { data: lines, error: lErr } = await sb
  .schema('feira')
  .from('quote_lines')
  .select('*')
  .eq('quote_id', QUOTE_ID)
  .order('sku');
if (lErr) throw lErr;

console.log('=== DB QUOTE ===');
console.log(JSON.stringify(quote, null, 2));
console.log('=== DB LINES', lines?.length, '===');
console.log(JSON.stringify(lines, null, 2));
console.log('=== PDF TEXT (first 3000) ===');
console.log(pdfText.slice(0, 3000));

// Compare with konnen order if source PDF available
const orderPdf = 'C:/Users/marce/Downloads/8144_4_TOP UP COMETA - Clicksign.pdf';
try {
  const orderBytes = readFileSync(orderPdf);
  const orderProxy = await getDocumentProxy(new Uint8Array(orderBytes));
  const orderExtract = await extractText(orderProxy, { mergePages: false });
  const orderText = (
    Array.isArray(orderExtract.text) ? orderExtract.text : [String(orderExtract.text)]
  ).join('\n\n--- PAGE ---\n\n');
  const parsed = parseKonnenOrderText(orderText);
  console.log('=== KONNEN ORDER PARSE ===');
  console.log({
    orderNo: parsed.orderNo,
    client: parsed.client,
    cargoValue: parsed.cargoValue,
    lineCount: parsed.lines.length,
    sample: parsed.lines.slice(0, 5),
  });
} catch {
  console.log('Konnen order PDF not found — skip parse compare');
}
