/**
 * Smoke: Hub calculate-freight (toll_value=0, metodologia atual) vs pedágio feira
 * (toll_percent × frete_peso, fallback 12%).
 *
 *   npx tsx scripts/smoke-fair-toll-capitals.ts
 *
 * Carga fixa: M2-1009 (321.25 kg, 1.89 m³, NF R$ 500.000). Origem Itajaí-SC.
 * KM: matriz rodoviária aproximada (Fortaleza=3558 homologado na UI feira).
 * Não chama WebRouter — compara fórmula % vs Hub sem placa.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { invokeCalculateFreightAsUser, loadSupabaseScriptEnv } from './lib/load-supabase-env';
import type { CalculateFreightResponse } from '../src/types/freight';

const FALLBACK_TOLL_PERCENT = 12;
const WEIGHT_KG = 321.25;
const VOLUME_M3 = 1.89;
const CARGO_VALUE = 500_000;
const ORIGIN = 'Itajaí - SC';

/** KM rodoviário aproximado Itajaí-SC → capital. Fortaleza = 3558 (UI feira). */
const CAPITALS: { uf: string; city: string; km: number }[] = [
  { uf: 'AC', city: 'Rio Branco', km: 4120 },
  { uf: 'AL', city: 'Maceió', km: 2980 },
  { uf: 'AP', city: 'Macapá', km: 4450 },
  { uf: 'AM', city: 'Manaus', km: 4380 },
  { uf: 'BA', city: 'Salvador', km: 2480 },
  { uf: 'CE', city: 'Fortaleza', km: 3558 },
  { uf: 'DF', city: 'Brasília', km: 1680 },
  { uf: 'ES', city: 'Vitória', km: 1420 },
  { uf: 'GO', city: 'Goiânia', km: 1580 },
  { uf: 'MA', city: 'São Luís', km: 3320 },
  { uf: 'MT', city: 'Cuiabá', km: 2180 },
  { uf: 'MS', city: 'Campo Grande', km: 1480 },
  { uf: 'MG', city: 'Belo Horizonte', km: 1180 },
  { uf: 'PA', city: 'Belém', km: 3680 },
  { uf: 'PB', city: 'João Pessoa', km: 3180 },
  { uf: 'PR', city: 'Curitiba', km: 380 },
  { uf: 'PE', city: 'Recife', km: 3080 },
  { uf: 'PI', city: 'Teresina', km: 3120 },
  { uf: 'RJ', city: 'Rio de Janeiro', km: 920 },
  { uf: 'RN', city: 'Natal', km: 3280 },
  { uf: 'RS', city: 'Porto Alegre', km: 620 },
  { uf: 'RO', city: 'Porto Velho', km: 3680 },
  { uf: 'RR', city: 'Boa Vista', km: 4980 },
  { uf: 'SC', city: 'Florianópolis', km: 180 },
  { uf: 'SP', city: 'São Paulo', km: 560 },
  { uf: 'SE', city: 'Aracaju', km: 2680 },
  { uf: 'TO', city: 'Palmas', km: 2480 },
];

type TablePick = {
  id: string;
  name: string;
  modality: string | null;
  methodology: string | null;
};

function pickDefaultLotacao(tables: TablePick[]): TablePick | null {
  const pool = tables.filter(
    (t) => t.modality === 'lotacao' && t.methodology !== 'fracionado_parceiro'
  );
  return pool.find((t) => t.methodology === 'lotacao') ?? pool[0] ?? null;
}

function pickParceiro(tables: TablePick[]): TablePick | null {
  return (
    tables.find((t) => t.methodology === 'fracionado_parceiro') ??
    tables.find((t) => t.modality === 'fracionado' && /parceiro|rvl/i.test(t.name)) ??
    null
  );
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const env = loadSupabaseScriptEnv();
  const sr = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false } });

  const { data: tables, error: tErr } = await sr
    .from('price_tables')
    .select('id, name, modality, methodology, active')
    .eq('active', true);
  if (tErr) throw new Error(tErr.message);

  const lotacao = pickDefaultLotacao((tables ?? []) as TablePick[]);
  const parceiro = pickParceiro((tables ?? []) as TablePick[]);
  if (!lotacao) throw new Error('Nenhuma tabela lotação ativa');

  console.log('lotacao', lotacao.name, lotacao.id, lotacao.methodology);
  console.log('parceiro', parceiro ? `${parceiro.name} ${parceiro.id}` : '(ausente — só lotação)');

  const tableForFair = parceiro ?? lotacao;
  const { data: rows, error: rErr } = await sr
    .from('price_table_rows')
    .select('id, km_from, km_to, toll_percent, cost_per_ton')
    .eq('price_table_id', tableForFair.id)
    .order('km_from', { ascending: true });
  if (rErr) throw new Error(rErr.message);

  const filledToll = (rows ?? []).filter(
    (r) => r.toll_percent != null && Number(r.toll_percent) > 0
  );
  console.log(
    `linhas ${tableForFair.name}: ${rows?.length ?? 0} | toll_percent preenchido: ${filledToll.length}`
  );

  type ResultRow = {
    uf: string;
    dest: string;
    km: number;
    band: string;
    hub_status: string;
    hub_frete_peso: number;
    hub_toll: number;
    hub_total: number;
    toll_percent: number | null;
    toll_source: 'table' | 'fallback_12';
    fair_toll: number;
    delta_brl: number;
    delta_pct: number | null;
    error: string | null;
  };

  const out: ResultRow[] = [];

  for (const cap of CAPITALS) {
    const dest = `${cap.city} - ${cap.uf}`;
    const priceRow =
      (rows ?? []).find((r) => Number(r.km_from) <= cap.km && Number(r.km_to) >= cap.km) ?? null;
    const tablePct =
      priceRow?.toll_percent != null && Number(priceRow.toll_percent) > 0
        ? Number(priceRow.toll_percent)
        : null;
    const tollPercent = tablePct ?? FALLBACK_TOLL_PERCENT;
    const tollSource: 'table' | 'fallback_12' = tablePct != null ? 'table' : 'fallback_12';

    const { data, errorMessage } = await invokeCalculateFreightAsUser(env, {
      origin: ORIGIN,
      destination: dest,
      km_distance: cap.km,
      weight_kg: WEIGHT_KG,
      volume_m3: VOLUME_M3,
      cargo_value: CARGO_VALUE,
      price_table_id: lotacao.id,
      payment_term_code: 'D30',
    });

    if (errorMessage || !data) {
      out.push({
        uf: cap.uf,
        dest,
        km: cap.km,
        band: priceRow ? `${priceRow.km_from}-${priceRow.km_to}` : 'sem-faixa',
        hub_status: 'ERROR',
        hub_frete_peso: 0,
        hub_toll: 0,
        hub_total: 0,
        toll_percent: tablePct,
        toll_source: tollSource,
        fair_toll: 0,
        delta_brl: 0,
        delta_pct: null,
        error: errorMessage ?? 'sem resposta',
      });
      console.log(`FAIL ${cap.uf} ${errorMessage}`);
      await sleep(200);
      continue;
    }

    const res = data as CalculateFreightResponse;
    const fretePeso = Number(res.components?.base_cost ?? res.components?.base_freight ?? 0);
    const hubToll = Number(res.components?.toll ?? 0);
    const hubTotal = Number(res.totals?.total_cliente ?? 0);
    const fairToll = round2(fretePeso * (tollPercent / 100));
    const delta = round2(fairToll - hubToll);
    const deltaPct = hubToll > 0 ? round2((delta / hubToll) * 100) : fairToll > 0 ? 100 : 0;

    out.push({
      uf: cap.uf,
      dest,
      km: cap.km,
      band: res.meta?.km_band_label ?? (priceRow ? `${priceRow.km_from}-${priceRow.km_to}` : '-'),
      hub_status: res.status,
      hub_frete_peso: round2(fretePeso),
      hub_toll: round2(hubToll),
      hub_total: round2(hubTotal),
      toll_percent: tablePct,
      toll_source: tollSource,
      fair_toll: fairToll,
      delta_brl: delta,
      delta_pct: deltaPct,
      error: res.error ?? null,
    });

    console.log(
      `${cap.uf.padEnd(2)} ${cap.km.toString().padStart(4)}km  HubToll=${brl(hubToll)}  Fair=${brl(fairToll)} (${tollSource} ${tollPercent}%)  total=${brl(hubTotal)}  ${res.status}`
    );
    await sleep(250);
  }

  const csvLines = [
    [
      'uf',
      'destino',
      'km',
      'faixa',
      'hub_status',
      'hub_frete_peso',
      'hub_toll',
      'hub_total',
      'toll_percent_tabela',
      'toll_source',
      'fair_toll',
      'delta_brl',
      'delta_pct',
      'error',
    ].join(','),
    ...out.map((r) =>
      [
        r.uf,
        `"${r.dest}"`,
        r.km,
        r.band,
        r.hub_status,
        r.hub_frete_peso,
        r.hub_toll,
        r.hub_total,
        r.toll_percent ?? '',
        r.toll_source,
        r.fair_toll,
        r.delta_brl,
        r.delta_pct ?? '',
        r.error ? `"${r.error.replace(/"/g, "'")}"` : '',
      ].join(',')
    ),
  ];

  const csvPath = join(process.cwd(), 'docs/homolog/_smoke-fair-toll-capitals.csv');
  writeFileSync(csvPath, csvLines.join('\n'), 'utf8');
  writeFileSync(
    join(process.cwd(), 'docs/homolog/_smoke-fair-toll-capitals.json'),
    JSON.stringify(
      {
        lotacao,
        parceiro,
        fallback: FALLBACK_TOLL_PERCENT,
        carga: { WEIGHT_KG, VOLUME_M3, CARGO_VALUE },
        rows: out,
      },
      null,
      2
    ),
    'utf8'
  );

  const ok = out.filter((r) => r.hub_status === 'OK');
  const fallbackN = out.filter((r) => r.toll_source === 'fallback_12').length;
  const tableN = out.filter((r) => r.toll_source === 'table').length;
  console.log('\n--- RESUMO ---');
  console.log(
    `OK ${ok.length}/${out.length}  toll_percent tabela=${tableN}  fallback 12%=${fallbackN}`
  );
  console.log(`CSV ${csvPath}`);
  if (ok.length) {
    const avgFair = ok.reduce((s, r) => s + r.fair_toll, 0) / ok.length;
    const avgHubToll = ok.reduce((s, r) => s + r.hub_toll, 0) / ok.length;
    console.log(`média pedágio Hub ${brl(avgHubToll)} vs feira ${brl(avgFair)}`);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
