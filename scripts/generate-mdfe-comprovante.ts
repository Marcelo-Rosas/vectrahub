/**
 * Gera comprovante operacional (CIOT + CT-es) do MDF-e sem reemitir.
 *
 *   npx tsx scripts/generate-mdfe-comprovante.ts
 *   npx tsx scripts/generate-mdfe-comprovante.ts --id=e621c3fc-9679-4c09-b029-574cb906fcd3
 *   npx tsx scripts/generate-mdfe-comprovante.ts --numero=3
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadSupabaseScriptEnv } from './lib/load-supabase-env';
import { generateMdfeComprovantePdf } from '../src/lib/generateMdfeComprovantePdf';

const args = process.argv.slice(2);
const ID = args.find((a) => a.startsWith('--id='))?.slice(5);
const NUMERO = args.find((a) => a.startsWith('--numero='))?.slice(9);

function digits(s: string | null | undefined): string {
  return String(s ?? '').replace(/\D/g, '');
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let q = sr.from('mdfe_emissions').select('*').order('created_at', { ascending: false }).limit(1);
  if (ID) q = sr.from('mdfe_emissions').select('*').eq('id', ID).limit(1);
  else if (NUMERO) q = sr.from('mdfe_emissions').select('*').eq('numero', Number(NUMERO)).limit(1);

  const { data: rows, error } = await q;
  if (error) throw error;
  const emission = rows?.[0];
  if (!emission) throw new Error('MDF-e não encontrado');

  const ps = (emission.payload_sent ?? {}) as Record<string, unknown>;
  const modal = (ps.modal_rodoviario ?? {}) as Record<string, unknown>;

  const ciotRaw = Array.isArray(modal.ciot) ? modal.ciot : [];
  const seenCiot = new Set<string>();
  const ciots = [];
  for (const c of ciotRaw) {
    const row = c as { ciot?: string; cnpj_responsavel?: string };
    const n = digits(row.ciot);
    const resp = digits(row.cnpj_responsavel);
    const key = `${n}|${resp}`;
    if (n.length < 8 || seenCiot.has(key)) continue;
    seenCiot.add(key);
    ciots.push({ number: n, cnpjResponsavel: resp || null });
  }

  const vpoRaw = Array.isArray(modal.dispositivos_vale_pedagio)
    ? modal.dispositivos_vale_pedagio
    : [];
  const v0 = vpoRaw[0] as
    | {
        numero_comprovante_compra?: string;
        cnpj_responsavel_pagamento?: string;
        cnpj_empresa_fornecedora?: string;
        valor_vale_pedagio?: number;
      }
    | undefined;

  const { data: links } = await sr
    .from('mdfe_cte_link')
    .select('cte_emission_id')
    .eq('mdfe_id', emission.id);
  const cteIds = (links ?? []).map((l) => l.cte_emission_id);

  const { data: cteRows } = await sr
    .from('cte_emissions')
    .select('id, numero, serie, chave_cte, order_id, payload_sent')
    .in('id', cteIds)
    .order('numero', { ascending: true });

  const orderIds = [...new Set((cteRows ?? []).map((c) => c.order_id).filter(Boolean))] as string[];
  const osMap = new Map<string, string>();
  if (orderIds.length) {
    const { data: orders } = await sr.from('orders').select('id, os_number').in('id', orderIds);
    for (const o of orders ?? []) osMap.set(o.id, o.os_number);
  }

  const ctes = (cteRows ?? []).map((c) => {
    const cps = (c.payload_sent ?? {}) as Record<string, unknown>;
    return {
      numero: c.numero,
      serie: c.serie,
      chave: digits(c.chave_cte),
      os_number: (c.order_id && osMap.get(c.order_id)) || null,
      municipio_destino: String(cps.municipio_fim ?? '') || null,
      uf_destino: String(cps.uf_fim ?? '') || null,
    };
  });

  let driverName: string | null = null;
  let driverCpf: string | null = null;
  if (emission.driver_id) {
    const { data: d } = await sr
      .from('drivers')
      .select('name, cpf')
      .eq('id', emission.driver_id)
      .maybeSingle();
    driverName = d?.name ?? null;
    driverCpf = d?.cpf ?? null;
  }

  let plate: string | null = String(modal.placa_veiculo ?? '') || null;
  let plate2: string | null = null;
  if (emission.vehicle_id) {
    const { data: v } = await sr
      .from('vehicles')
      .select('plate, plate_2')
      .eq('id', emission.vehicle_id)
      .maybeSingle();
    plate = v?.plate ?? plate;
    plate2 = v?.plate_2 ?? null;
  }

  const { data: tripLink } = await sr
    .from('trip_orders')
    .select('trip:trips(trip_number)')
    .in('order_id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000'])
    .limit(1)
    .maybeSingle();
  const tripNumber =
    (tripLink as { trip?: { trip_number?: string } | null } | null)?.trip?.trip_number ?? null;

  const osNumbers = [...new Set(ctes.map((c) => c.os_number).filter(Boolean) as string[])].sort();

  const payload = {
    mdfe_numero: emission.numero,
    mdfe_serie: emission.serie,
    chave_mdfe: digits(emission.chave_mdfe),
    protocolo: emission.protocolo,
    status: emission.status,
    uf_inicio: emission.uf_inicio,
    uf_fim: emission.uf_fim,
    data_autorizacao: emission.data_autorizacao
      ? new Date(emission.data_autorizacao).toLocaleString('pt-BR')
      : null,
    vehicle_plate: plate,
    vehicle_plate_2: plate2,
    driver_name: driverName,
    driver_cpf: driverCpf,
    trip_number: tripNumber,
    os_numbers: osNumbers,
    ciots,
    vpo: v0?.numero_comprovante_compra
      ? {
          idVpo: digits(v0.numero_comprovante_compra),
          cnpjPagador: digits(v0.cnpj_responsavel_pagamento) || null,
          cnpjFornecedora: digits(v0.cnpj_empresa_fornecedora) || null,
          valorReais: v0.valor_vale_pedagio != null ? Number(v0.valor_vale_pedagio) : null,
        }
      : null,
    ctes,
    issued_at: new Date().toLocaleString('pt-BR'),
  };

  const { blob, fileName } = await generateMdfeComprovantePdf(payload);
  const buf = Buffer.from(await blob.arrayBuffer());
  const outPath = join(homedir(), 'Downloads', fileName);
  writeFileSync(outPath, buf);
  console.log(
    JSON.stringify(
      {
        mdfe: emission.numero,
        chave: payload.chave_mdfe,
        ciots: payload.ciots,
        cte_count: payload.ctes.length,
        out: outPath,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
