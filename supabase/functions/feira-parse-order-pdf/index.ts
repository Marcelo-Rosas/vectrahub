import { extractText, getDocumentProxy } from 'unpdf';
import { resolveBucklerCatalogSku } from '../_shared/buckler-catalog-sku.ts';
import { fairFreightGate } from '../_shared/fair-freight-gate.ts';
import { feiraFrom } from '../_shared/feira-client.ts';
import { parseBucklerOrderText } from '../_shared/fair-order-pdf-buckler.ts';
import {
  matchOrderLinesToCatalog,
  parseKonnenOrderText,
} from '../_shared/fair-order-pdf-konnen.ts';
import { corsPreflight, jsonWithCors, resolveSupabaseContext } from '../_shared/supabase-server.ts';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type FairOrderPdfAdapter = 'konnen-clicksign' | 'buckler-proposta';

type Body = {
  pdfBase64?: string;
  adapter?: FairOrderPdfAdapter;
};

function decodeBase64Pdf(value: string): Uint8Array {
  const raw = value.includes(',') ? (value.split(',').pop() ?? value) : value;
  const bin = atob(raw.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pdfBytesToText(bytes: Uint8Array): Promise<{ pageCount: number; text: string }> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [String(text)];
  return {
    pageCount: totalPages,
    text: pages.join('\n\n--- PAGE ---\n\n'),
  };
}

function formatFairDocument(document: string): string {
  const d = document.replace(/\D/g, '');
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatFairCep(zip: string): string {
  const d = zip.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') {
    return jsonWithCors(req, { error: 'Method not allowed' }, 405);
  }

  const { data: ctx, error: authError } = await resolveSupabaseContext(req, 'user');
  if (authError || !ctx) {
    return jsonWithCors(
      req,
      { error: authError?.message ?? 'UNAUTHORIZED' },
      authError?.status ?? 401
    );
  }

  const supabase = ctx.supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return jsonWithCors(req, { error: 'UNAUTHORIZED' }, 401);

  const email = (user.email ?? '').toLowerCase();
  if (email.endsWith('@vectracargo.com.br')) {
    return jsonWithCors(req, { error: 'Staff Vectra não importa pedido feira' }, 403);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonWithCors(req, { error: 'JSON inválido' }, 400);
  }

  const pdfBase64 = (body.pdfBase64 ?? '').trim();
  if (!pdfBase64) return jsonWithCors(req, { error: 'pdfBase64 obrigatório' }, 400);

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64Pdf(pdfBase64);
  } catch {
    return jsonWithCors(req, { error: 'PDF base64 inválido' }, 400);
  }

  if (bytes.byteLength > MAX_PDF_BYTES) {
    return jsonWithCors(req, { error: 'PDF excede 10 MB' }, 413);
  }
  if (bytes.byteLength < 32) {
    return jsonWithCors(req, { error: 'PDF vazio ou corrompido' }, 400);
  }

  const { data: link, error: linkErr } = await feiraFrom(supabase, 'user_company')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (linkErr) return jsonWithCors(req, { error: linkErr.message }, 400);
  if (!link?.company_id) {
    return jsonWithCors(req, { error: 'Domínio não habilitado para feira' }, 403);
  }

  const { data: company, error: companyErr } = await feiraFrom(supabase, 'companies')
    .select('slug')
    .eq('id', link.company_id)
    .maybeSingle();

  if (companyErr) return jsonWithCors(req, { error: companyErr.message }, 400);

  const adapter: FairOrderPdfAdapter =
    body.adapter ?? (company?.slug === 'buckler' ? 'buckler-proposta' : 'konnen-clicksign');

  let pageCount = 0;
  let text = '';
  try {
    const extracted = await pdfBytesToText(bytes);
    pageCount = extracted.pageCount;
    text = extracted.text;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao extrair texto do PDF';
    return jsonWithCors(req, { error: msg }, 422);
  }

  if (!text.trim()) {
    return jsonWithCors(req, { error: 'PDF sem texto extraível (OCR não suportado na v1)' }, 422);
  }

  const parsed =
    adapter === 'buckler-proposta' ? parseBucklerOrderText(text) : parseKonnenOrderText(text);

  if (adapter === 'buckler-proposta') {
    if (!parsed.client.name.trim()) {
      return jsonWithCors(req, { error: 'Cliente não identificado no PDF Buckler' }, 422);
    }
  } else if (!parsed.client.document || parsed.client.document.length < 11) {
    return jsonWithCors(req, { error: 'Cliente não identificado no PDF Konnen' }, 422);
  }

  if (parsed.lines.length === 0) {
    return jsonWithCors(req, { error: 'Nenhuma linha de equipamento encontrada no PDF' }, 422);
  }

  const { data: products, error: productsErr } = await feiraFrom(supabase, 'products')
    .select('sku, name, weight_kg_per_unit, volume_m3_per_unit')
    .eq('company_id', link.company_id)
    .eq('active', true);

  if (productsErr) return jsonWithCors(req, { error: productsErr.message }, 400);

  const catalogSkus = new Set<string>();
  const nameBySku = new Map<string, string>();
  const prodBySku = new Map<string, { weight_kg_per_unit: number; volume_m3_per_unit: number }>();
  for (const row of products ?? []) {
    const sku = String(row.sku ?? '')
      .trim()
      .toUpperCase();
    if (!sku) continue;
    catalogSkus.add(sku);
    if (row.name) nameBySku.set(sku, String(row.name));
    prodBySku.set(sku, {
      weight_kg_per_unit: Number(row.weight_kg_per_unit) || 0,
      volume_m3_per_unit: Number(row.volume_m3_per_unit) || 0,
    });
  }

  const matched = matchOrderLinesToCatalog(
    parsed.lines,
    catalogSkus,
    nameBySku,
    adapter === 'buckler-proposta' ? resolveBucklerCatalogSku : undefined
  );

  let weightKg = 0;
  let volumeM3 = 0;
  for (const line of matched.lines) {
    const prod = prodBySku.get(line.sku.toUpperCase());
    if (!prod) continue;
    const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
    weightKg += prod.weight_kg_per_unit * qty;
    volumeM3 += prod.volume_m3_per_unit * qty;
  }

  const gatePreview = fairFreightGate({
    weightKg,
    volumeM3,
    unmatchedSkuCount: matched.unmatched.length,
    parsedLineCount: parsed.lines.length,
  });

  return jsonWithCors(req, {
    client: {
      kind: parsed.client.document.length === 14 ? 'cnpj' : 'cpf',
      document: formatFairDocument(parsed.client.document),
      name: parsed.client.name,
      zipCode: formatFairCep(parsed.client.zipCode),
      address: parsed.client.address,
      email: parsed.client.email,
      city: parsed.client.city,
      state: parsed.client.state,
      deliveryDifferent: false,
      deliveryZip: '',
      deliveryCity: '',
      deliveryState: '',
    },
    cargoValue: parsed.cargoValue,
    lines: matched.lines,
    unmatched: matched.unmatched,
    meta: {
      orderNo: parsed.orderNo,
      pageCount,
      adapter,
      gatePreview,
    },
  });
});
