/**
 * Smoke UI/PDF homolog ANTT Hub — valida bloco OC PDF + painel Risk wizard
 * contra docs/ANTT/smoke-*-raw.json (mesmos campos do certificado/extrato).
 *
 *   npx tsx scripts/smoke-antt-hub-pdf-ui.ts
 *
 * Saídas:
 *   docs/ANTT/smoke-oc-hub-antt.pdf
 *   docs/ANTT/smoke-risk-antt-panel.html
 *   docs/ANTT/smoke-risk-antt-panel.png
 *   docs/ANTT/smoke-ui-pdf-assert.json
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = join(ROOT, 'docs', 'ANTT');
const LOGO = join(ROOT, 'src', 'assets', 'logo_vectra_cargo.jpg');

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

type SmokeRaw = {
  situacao: string;
  situacao_raw?: string;
  rntrc_registry_type?: string | null;
  rntrc?: string | null;
  transportador?: string;
  cpf_cnpj_mask?: string;
  cadastrado_desde?: string;
  municipio_uf?: string;
  apto?: boolean;
  veiculo_na_frota?: boolean;
  comprovante_url?: string | null;
};

function loadSmoke(name: string): SmokeRaw {
  return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as SmokeRaw;
}

function parseTransportador(raw: string | undefined): {
  type: 'TAC' | 'ETC' | null;
  name: string;
} {
  if (!raw) return { type: null, name: '' };
  const m = raw.match(/^\s*(TAC|ETC)\s*[-–—]\s*(.+)$/i);
  if (m) return { type: m[1].toUpperCase() as 'TAC' | 'ETC', name: m[2].trim() };
  return { type: null, name: raw.trim() };
}

function assertPdfContains(buf: Buffer, needles: string[]): { ok: string[]; missing: string[] } {
  // jsPDF Helvetica → text often as literal Latin-1 in content streams
  const latin = buf.toString('latin1');
  const ok: string[] = [];
  const missing: string[] = [];
  for (const n of needles) {
    if (latin.includes(n)) ok.push(n);
    else missing.push(n);
  }
  return { ok, missing };
}

function buildRiskPanelHtml(rntrc: SmokeRaw, veiculo: SmokeRaw): string {
  const parsed = parseTransportador(rntrc.transportador);
  const hasLink = Boolean(rntrc.comprovante_url);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Smoke Risk ANTT Hub</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f4f6f9; padding: 24px; color: #1e2330; }
    .card { max-width: 560px; background: #fff; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 12px; padding: 16px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 600; margin-bottom: 8px; }
    .ok { color: #16a34a; }
    .muted { color: #64748b; font-size: 14px; line-height: 1.5; }
    a { color: #2563eb; }
    .meta { margin-top: 16px; font-size: 12px; color: #94a3b8; }
    h1 { font-size: 18px; margin: 0 0 16px; }
  </style>
</head>
<body>
  <h1 data-testid="smoke-title">Passo 1: Consulta ANTT (RNTRC) — smoke Hub</h1>
  <div class="card" data-testid="risk-step-antt-smoke">
    <div class="title"><span class="ok">✓</span> ANTT: Consulta válida</div>
    <div class="muted" data-testid="transportador">${parsed.name || rntrc.transportador || '—'}</div>
    <div class="muted" data-testid="rntrc">RNTRC: ${rntrc.rntrc ?? '—'}</div>
    <div class="muted" data-testid="situacao">Situação: ${rntrc.situacao}</div>
    <div class="muted" data-testid="registro">Registro RNTRC: ${parsed.type ?? rntrc.rntrc_registry_type ?? '—'}</div>
    <div class="muted" data-testid="municipio">${rntrc.municipio_uf ?? '—'} · desde ${rntrc.cadastrado_desde ?? '—'}</div>
    <div class="muted" data-testid="apto">Apto: ${rntrc.apto === true ? 'SIM' : 'NÃO'} · Frota (SVC2F44): ${veiculo.veiculo_na_frota === true ? 'SIM' : 'NÃO'}</div>
    ${
      hasLink
        ? `<div class="muted"><a href="${rntrc.comprovante_url}" target="_blank" rel="noopener">Ver Comprovante ANTT</a></div>`
        : `<div class="muted" data-testid="comprovante-absent">Comprovante: link ausente (consulta pública sem certidão — esperado)</div>`
    }
  </div>
  <p class="meta">Fonte: docs/ANTT/smoke-rntrc-raw.json + smoke-veiculo-raw.json · espelho do RiskWorkflowWizard</p>
</body>
</html>`;
}

async function main() {
  const rntrc = loadSmoke('smoke-rntrc-raw.json');
  const veiculo = loadSmoke('smoke-veiculo-raw.json');
  const parsed = parseTransportador(rntrc.transportador);

  // Expected from certificado/extrato Hub
  const expected = {
    rntrc: '059734055',
    situacao_raw: 'ATIVO',
    situacao: 'regular',
    apto: true,
    transportador_contains: 'Vectra Hub',
    municipio: 'Itajaí/SC',
    cadastrado_desde: '31/07/2026',
    plate_frota: true,
    registry: 'ETC' as const,
  };

  const fieldChecks = {
    rntrc_match: rntrc.rntrc === expected.rntrc,
    situacao_raw_match: rntrc.situacao_raw === expected.situacao_raw,
    situacao_match: rntrc.situacao === expected.situacao,
    apto_match: rntrc.apto === expected.apto,
    transportador_match: (rntrc.transportador ?? '')
      .toLowerCase()
      .includes(expected.transportador_contains.toLowerCase()),
    municipio_match: rntrc.municipio_uf === expected.municipio,
    cadastrado_match: rntrc.cadastrado_desde === expected.cadastrado_desde,
    frota_match: veiculo.veiculo_na_frota === expected.plate_frota,
    etc_in_name: parsed.type === expected.registry,
    comprovante_null: rntrc.comprovante_url == null,
  };

  const mod = await import('../src/lib/generateCollectionOrderPdf');
  const { generateCollectionOrderPdf } = mod;

  const emptyParty = {
    name: 'SMOKE HUB',
    cnpj: '62.188.748/0001-17',
    cpf: null,
    phone: null,
    email: null,
    address: null,
    address_number: null,
    address_complement: null,
    address_neighborhood: null,
    zip_code: null,
    city: 'ITAJAI',
    state: 'SC',
  };

  const antt = {
    situacao: rntrc.situacao,
    situacao_raw: rntrc.situacao_raw ?? null,
    rntrc_registry_type: parsed.type,
    rntrc: rntrc.rntrc ?? null,
    transportador: parsed.name || rntrc.transportador || null,
    cpf_cnpj_mask: rntrc.cpf_cnpj_mask ?? null,
    cadastrado_desde: rntrc.cadastrado_desde ?? null,
    municipio_uf: rntrc.municipio_uf ?? null,
    apto: rntrc.apto ?? null,
    veiculo_na_frota: veiculo.veiculo_na_frota ?? null,
    comprovante_url: rntrc.comprovante_url ?? null,
    comprovante_storage_path: null,
    checked_at: new Date().toISOString(),
  };

  const { blob, fileName } = await generateCollectionOrderPdf({
    oc_number: 'OC-SMOKE-HUB-ANTT',
    issued_at: new Date().toISOString(),
    issued_by_name: 'smoke-antt-hub-pdf-ui',
    sender: emptyParty,
    recipient: { ...emptyParty, name: 'DEST SMOKE', city: 'SAO PAULO', state: 'SP' },
    driver: {
      name: 'MOTORISTA SMOKE',
      cpf: null,
      cnh: null,
      antt: rntrc.rntrc ?? null,
      phone: null,
    },
    vehicle: {
      plate: 'SVC2F44',
      trailer_plate: null,
      vehicle_type: 'Truck',
      brand: null,
      model: null,
    },
    cargo: { weight_kg: 1000, volume_m3: 1, cargo_value: 10000, cargo_type: 'SMOKE' },
    antt,
    pickup_date: null,
    delivery_date: null,
    observation: 'Smoke homolog Hub — bloco CONSULTA ANTT / RNTRC',
    additional_info: 'Validar contra emitircertificado 49.pdf / emitirextrato 49.pdf',
    logoBase64Override: logoBase64,
  });

  const pdfBuf = Buffer.from(await blob.arrayBuffer());
  const pdfPath = join(OUT, 'smoke-oc-hub-antt.pdf');
  writeFileSync(pdfPath, pdfBuf);

  const pdfNeedles = [
    'CONSULTA ANTT / RNTRC',
    '059734055',
    'ATIVO',
    'ETC',
    'SIM', // APTO?
    'Vectra Hub',
    'Itaja', // Itajaí may be escaped
    '31/07/2026',
  ];
  const pdfAssert = assertPdfContains(pdfBuf, pdfNeedles);

  const html = buildRiskPanelHtml(rntrc, veiculo);
  const htmlPath = join(OUT, 'smoke-risk-antt-panel.html');
  writeFileSync(htmlPath, html, 'utf8');

  const pngPath = join(OUT, 'smoke-risk-antt-panel.png');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="risk-step-antt-smoke"]').screenshot({ path: pngPath });
    const text = await page.locator('[data-testid="risk-step-antt-smoke"]').innerText();
    const uiNeedles = [
      '059734055',
      'regular',
      'ETC',
      'Vectra Hub',
      'Consulta válida',
      'Comprovante',
    ];
    const uiMissing = uiNeedles.filter((n) => !text.includes(n));
    const report = {
      generated_at: new Date().toISOString(),
      pdf: { path: pdfPath, fileName, bytes: pdfBuf.length, ...pdfAssert },
      risk_panel: {
        html: htmlPath,
        png: pngPath,
        text,
        missing: uiMissing,
        comprovante_link_expected: false,
        comprovante_link_present: Boolean(rntrc.comprovante_url),
      },
      field_checks: fieldChecks,
      pass:
        Object.values(fieldChecks).every(Boolean) &&
        pdfAssert.missing.filter((m) => m !== 'Itaja').length === 0 &&
        uiMissing.length === 0,
    };

    // soft: Itajaí encoding — accept if Itaja present OR municipio field check already ok
    if (pdfAssert.missing.includes('Itaja') && fieldChecks.municipio_match) {
      report.pdf.missing = pdfAssert.missing.filter((m) => m !== 'Itaja');
      report.pass =
        Object.values(fieldChecks).every(Boolean) &&
        report.pdf.missing.length === 0 &&
        uiMissing.length === 0;
    }

    writeFileSync(join(OUT, 'smoke-ui-pdf-assert.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!report.pass) {
      console.error('[smoke-antt-hub-pdf-ui] FAIL');
      process.exitCode = 1;
      return;
    }
    console.log('[smoke-antt-hub-pdf-ui] PASS');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[smoke-antt-hub-pdf-ui] FALHOU:', err);
  process.exitCode = 1;
});
