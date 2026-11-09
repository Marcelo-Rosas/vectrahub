#!/usr/bin/env npx tsx
/** Regera PDF feira a partir de feira.quotes + valida texto. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { extractText, getDocumentProxy } from 'unpdf';
import { generateQuotePdf } from '../src/lib/generateQuotePdf.ts';
import { fairPdfDisclaimer } from '../src/lib/fair-hub-clone.ts';
import { companyRowToTenant } from '../src/lib/fair-tenant.ts';
import { formatFairCep } from '../src/lib/fair-client.ts';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env.ts';

const QUOTE_ID = process.argv[2] ?? 'bda34c7d-8939-4038-a24c-cb43fdce935b';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/homolog');
mkdirSync(outDir, { recursive: true });

const env = loadSupabaseScriptEnv();
const sb = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: quote, error: qErr } = await sb
  .schema('feira')
  .from('quotes')
  .select('*')
  .eq('id', QUOTE_ID)
  .single();
if (qErr || !quote) throw qErr ?? new Error('quote not found');

const { data: client } = await sb
  .schema('feira')
  .from('clients')
  .select('*')
  .eq('id', quote.client_id ?? '')
  .maybeSingle();

const { data: company } = await sb
  .schema('feira')
  .from('companies')
  .select('*')
  .eq('id', quote.company_id)
  .single();

if (client && !client.neighborhood) {
  await sb
    .schema('feira')
    .from('clients')
    .update({ neighborhood: 'Bonsucesso' })
    .eq('id', client.id);
  client.neighborhood = 'Bonsucesso';
  console.log('[patch] client.neighborhood = Bonsucesso');
}

const tenant = companyRowToTenant(company);
const docCnpj = client?.cnpj ?? '';

const { blob, fileName } = await generateQuotePdf({
  quote: {
    id: quote.id,
    quote_code: quote.quote_code,
    client_name: client?.legal_name ?? '—',
    origin: quote.origin,
    destination: quote.destination,
    origin_cep: tenant.originCep,
    destination_cep: client?.zip_code ?? null,
    value: Number(quote.total_exibido),
    cargo_type: 'Equipamentos fitness',
    cargo_value: Number(quote.cargo_value),
    weight: Number(quote.weight_kg),
    volume: Number(quote.volume_m3),
    km_distance: Number(quote.km_distance),
    estimated_loading_date: null,
    notes: fairPdfDisclaimer(),
    created_at: quote.created_at,
    updated_at: quote.created_at,
    freight_modality: (quote.freight_modality as 'lotacao' | 'fracionado' | null) ?? 'lotacao',
    freight_type: quote.freight_type_label ?? 'Dedicado',
    suggested_vehicle_label: quote.vehicle_type_code ? String(quote.vehicle_type_code) : null,
    shipper_name_fallback: tenant.name,
    shipper: {
      name: tenant.name,
      cnpj: '15.563.385/0001-72',
      city: tenant.originCity,
      state: tenant.originUf,
      address: 'Rodovia Jorge Lacerda',
      address_number: '725',
      zip_code: formatFairCep(tenant.originCep),
    },
    client: {
      name: client?.legal_name ?? '—',
      cnpj: docCnpj.length === 14 ? docCnpj : null,
      email: client?.email ?? null,
      city: client?.city ?? null,
      state: client?.state ?? null,
      address: client?.address ?? null,
      address_neighborhood: client?.neighborhood ?? null,
      zip_code: client?.zip_code ?? null,
    },
    event_flag: quote.event_flag,
    pedagio_estimado: Number(quote.pedagio_estimado),
    fair_freight_total: Number(quote.hub_total_cliente),
    fair_disclaimer: true,
  },
  mode: 'simplified',
});

const outPath = join(outDir, fileName);
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(outPath, buf);
console.log('[write]', outPath);

const pdf = await getDocumentProxy(new Uint8Array(buf));
const { text } = await extractText(pdf, { mergePages: true });
const flat = (typeof text === 'string' ? text : text.join('\n')).replace(/\s+/g, ' ');
const checks: [string, RegExp][] = [
  ['codigo', /FEIRA-2026-08-0001/],
  ['cnpj cliente', /50\.902\.729\/0001-21/],
  ['valor mercadoria', /1\.354\.668,30/],
  ['frete', /25\.778,48/],
  ['pedagio incluso', /Ped[aá]gio.*Incluso no valor/i],
  ['sem pedagio estimado valor', /Ped[aá]gio estimado\s+R\$/i],
  ['total', /27\.868,33/],
  ['embarcador cnpj', /15\.563\.385\/0001-72/],
  ['tipo frete', /Dedicado.*LOTA/i],
  ['disclaimer incluso', /Ped[aá]gio incluso no valor cotado/i],
  ['rota ascii', /ORIGEM -> DESTINO/],
];
let failed = 0;
for (const [label, re] of checks) {
  const ok = label.startsWith('sem ') ? !re.test(flat) : re.test(flat);
  if (!ok) failed += 1;
  console.log(ok ? '[ok]' : '[FAIL]', label);
}
if (failed > 0) {
  throw new Error(`${failed} PDF text check(s) failed`);
}
