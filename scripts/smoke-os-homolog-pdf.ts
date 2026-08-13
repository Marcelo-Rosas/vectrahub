/**
 * Smoke homolog PDF — OS-2026-08-0001
 *
 * Gera Ordem de Coleta com dados reais da OS (Hub) + cabeçalho VECTRA HUB
 * para validação visual/homologação. Sem motorista/placa na OS → placeholders.
 *
 *   npx tsx scripts/smoke-os-homolog-pdf.ts
 *
 * Saídas:
 *   docs/homolog/OS-2026-08-0001-oc.pdf
 *   docs/homolog/OS-2026-08-0001-assert.json
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'docs', 'homolog');
const LOGO = join(ROOT, 'src', 'assets', 'logo_vectra_cargo.jpg');
const ANTT_SMOKE = join(ROOT, 'docs', 'ANTT', 'smoke-rntrc-raw.json');

mkdirSync(OUT, { recursive: true });

const logoBase64 = `data:image/jpeg;base64,${readFileSync(LOGO).toString('base64')}`;

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const url = typeof input === 'string' ? input : ((input as { url?: string }).url ?? '');
  if (url.includes('logo_vectra_cargo')) {
    return new Response(readFileSync(LOGO), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  }
  return originalFetch(input as Parameters<typeof originalFetch>[0], init as RequestInit);
}) as typeof fetch;

type SmokeAntt = {
  situacao: string;
  situacao_raw?: string;
  rntrc?: string | null;
  transportador?: string;
  cpf_cnpj_mask?: string;
  cadastrado_desde?: string;
  municipio_uf?: string;
  apto?: boolean;
  comprovante_url?: string | null;
};

function parseTransportador(raw: string | undefined): { type: 'TAC' | 'ETC' | null; name: string } {
  if (!raw) return { type: null, name: '' };
  const m = raw.match(/^\s*(TAC|ETC)\s*[-–—]\s*(.+)$/i);
  if (m) return { type: m[1].toUpperCase() as 'TAC' | 'ETC', name: m[2].trim() };
  return { type: null, name: raw.trim() };
}

function assertPdfContains(buf: Buffer, needles: string[]): { ok: string[]; missing: string[] } {
  const latin = buf.toString('latin1');
  const ok: string[] = [];
  const missing: string[] = [];
  for (const n of needles) {
    if (latin.includes(n)) ok.push(n);
    else missing.push(n);
  }
  return { ok, missing };
}

async function main() {
  const anttRaw = JSON.parse(readFileSync(ANTT_SMOKE, 'utf8')) as SmokeAntt;
  const parsed = parseTransportador(anttRaw.transportador);

  const mod = await import('../src/lib/generateCollectionOrderPdf');
  const { generateCollectionOrderPdf } = mod;

  // Snapshot OS-2026-08-0001 (Hub, 2026-08-01) — stage documentacao, sem motorista/placa
  const sender = {
    name: 'BOOST EQUIPAMENT',
    cnpj: '61.602.891/0001-40',
    cpf: null,
    phone: '85 9181-4983',
    email: 'adm@boostequipment.com.br',
    address: 'HEROIS DO ACRE',
    address_number: '445',
    address_complement: null,
    address_neighborhood: 'PASSARE',
    zip_code: '60743760',
    city: 'FORTALEZA',
    state: 'CE',
  };

  const recipient = {
    name: 'INOVE ACADEMIA LTDA',
    cnpj: '24.436.976/0001-70',
    cpf: null,
    phone: '9137296720',
    email: null,
    address: 'RUA GILBERTO RODRIGUES - PROMISSAO RES OLGA MOREIRA - PARQUE III',
    address_number: '110',
    address_complement: null,
    address_neighborhood: 'PROMISSAO RES OLGA MOREIRA - PARQUE III',
    zip_code: '68628520',
    city: 'PARAGOMINAS',
    state: 'PA',
  };

  const driver = {
    name: 'HOMOLOG — MOTORISTA PENDENTE',
    cpf: null,
    cnh: null,
    antt: anttRaw.rntrc ?? null,
    phone: null,
  };

  const vehicle = {
    plate: 'SVC2F44',
    trailer_plate: null,
    vehicle_type: 'Lotacao (homolog)',
    brand: null,
    model: null,
  };

  const cargo = {
    weight_kg: 907,
    volume_m3: 0,
    cargo_value: 68665,
    cargo_type: 'EQUIPAMENTOS',
  };

  const antt = {
    situacao: anttRaw.situacao,
    situacao_raw: anttRaw.situacao_raw ?? null,
    rntrc_registry_type: parsed.type,
    rntrc: anttRaw.rntrc ?? null,
    transportador: parsed.name || anttRaw.transportador || null,
    cpf_cnpj_mask: anttRaw.cpf_cnpj_mask ?? null,
    cadastrado_desde: anttRaw.cadastrado_desde ?? null,
    municipio_uf: anttRaw.municipio_uf ?? null,
    apto: anttRaw.apto ?? null,
    veiculo_na_frota: true,
    comprovante_url: null,
    comprovante_storage_path: null,
    checked_at: new Date().toISOString(),
  };

  const { blob, fileName } = await generateCollectionOrderPdf({
    oc_number: 'OC-HOMOLOG-OS-2026-08-0001',
    issued_at: new Date().toISOString(),
    issued_by_name: 'homolog-pdf-smoke',
    sender,
    recipient,
    driver,
    vehicle,
    cargo,
    antt,
    pickup_date: null,
    delivery_date: null,
    observation:
      'Homolog PDF — OS-2026-08-0001 (COT-2026-08-0001). Motorista ainda não atribuído na OS.',
    additional_info:
      'Fortaleza/CE → Paragominas/PA · 1515 km · lotação · valor frete R$ 9.800,00. Cabeçalho VECTRA HUB.',
    logoBase64Override: logoBase64,
  });

  const buf = Buffer.from(await blob.arrayBuffer());
  const pdfPath = join(OUT, 'OS-2026-08-0001-oc.pdf');
  writeFileSync(pdfPath, buf);

  const needles = [
    'VECTRA HUB',
    '62.188.748',
    '263768406',
    '98850-9714',
    'marcelo.rosas@vectracargo.com.br',
    'JORGE LACERDA',
    'BOOST EQUIPAMENT',
    'INOVE ACADEMIA',
    'CONSULTA ANTT / RNTRC',
    '059734055',
    'ATIVO',
    'EQUIPAMENTOS',
    'OC-HOMOLOG-OS-2026-08-0001',
  ];
  const pdfAssert = assertPdfContains(buf, needles);

  const report = {
    generated_at: new Date().toISOString(),
    os_number: 'OS-2026-08-0001',
    quote_code: 'COT-2026-08-0001',
    os_id: '6632e313-a56b-4d5c-88d7-d2b7a709a40b',
    stage_at_snapshot: 'documentacao',
    notes: [
      'OS sem driver_id/vehicle_plate — PDF usa placeholder motorista + placa frota Hub SVC2F44',
      'ANTT block = smoke Hub RNTRC (emitente), não consulta do carreteiro da OS',
    ],
    pdf: { path: pdfPath, fileName, bytes: buf.length, ...pdfAssert },
    pass: pdfAssert.missing.length === 0,
  };

  writeFileSync(join(OUT, 'OS-2026-08-0001-assert.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error('[smoke-os-homolog-pdf] FAIL');
    process.exitCode = 1;
    return;
  }
  console.log('[smoke-os-homolog-pdf] PASS');
}

main().catch((err) => {
  console.error('[smoke-os-homolog-pdf] FALHOU:', err);
  process.exitCode = 1;
});
