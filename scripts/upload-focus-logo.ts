/**
 * Sobe logomarca Vectra no cadastro Focus NFe (aparece no DACTE/DANFE oficial).
 *
 * Focus gera o PDF oficial — logo NÃO vai no payload do CT-e.
 * Campo: PUT /v2/empresas/{id} → arquivo_logo_base64 (PNG ≤ 200×200).
 *
 * Uso:
 *   npx tsx scripts/upload-focus-logo.ts
 *   npx tsx scripts/upload-focus-logo.ts --prod
 *   npx tsx scripts/upload-focus-logo.ts --logo=public/brand/logo_vectra_focus_200.png
 *
 * Env: FOCUS_NFE_TOKEN_HOMOLOG | FOCUS_NFE_TOKEN_PROD
 * Opcional: FOCUS_NFE_EMPRESA_ID (senão lista por CNPJ 62188748000117)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: '.env' });

const CNPJ = '62188748000117';
const DEFAULT_LOGO = 'public/brand/logo_vectra_focus_200.png';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const prod = process.argv.includes('--prod');
  const ambiente = prod ? 'prod' : 'homolog';
  const base = prod ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br';
  const tokenKey = prod ? 'FOCUS_NFE_TOKEN_PROD' : 'FOCUS_NFE_TOKEN_HOMOLOG';
  const token = process.env[tokenKey];
  if (!token) {
    console.error(`Missing ${tokenKey}`);
    process.exit(1);
  }

  const logoPath = resolve(arg('logo') ?? DEFAULT_LOGO);
  if (!existsSync(logoPath)) {
    console.error(`Logo not found: ${logoPath}`);
    console.error('Gere antes: PNG 200×200 em public/brand/logo_vectra_focus_200.png');
    process.exit(1);
  }

  const b64 = readFileSync(logoPath).toString('base64');
  const auth = 'Basic ' + Buffer.from(`${token}:`).toString('base64');

  let empresaId = process.env.FOCUS_NFE_EMPRESA_ID ?? arg('empresa-id');
  if (!empresaId) {
    // GET /v2/empresas exige token master da conta Focus (token de emissão CT-e
    // costuma retornar 404/401). Sem id → falha com instrução clara.
    const listRes = await fetch(`${base}/v2/empresas?cnpj=${CNPJ}`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const listText = await listRes.text();
    if (!listRes.ok) {
      console.error('List empresas failed', listRes.status, listText.slice(0, 400));
      console.error('');
      console.error('Token de emissão NÃO gerencia empresas. Opções:');
      console.error('  1) Painel Focus → Empresa → Logomarca (PNG ≤ 200×200)');
      console.error('  2) Token master + FOCUS_NFE_EMPRESA_ID=<id>');
      console.error('     npx tsx scripts/upload-focus-logo.ts --empresa-id=<id>');
      console.error(`Logo pronto: ${logoPath}`);
      process.exit(1);
    }
    const list = JSON.parse(listText) as Array<{
      id: number;
      cnpj?: string;
      caminho_logo?: string;
    }>;
    if (!Array.isArray(list) || list.length === 0) {
      console.error('Nenhuma empresa Focus para CNPJ', CNPJ);
      process.exit(1);
    }
    empresaId = String(list[0].id);
    console.log('empresa', list[0].id, 'caminho_logo_atual=', list[0].caminho_logo ?? null);
  }

  const putRes = await fetch(`${base}/v2/empresas/${empresaId}`, {
    method: 'PUT',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ arquivo_logo_base64: b64 }),
  });
  const putText = await putRes.text();
  let body: Record<string, unknown> = {};
  try {
    body = putText ? JSON.parse(putText) : {};
  } catch {
    body = { raw: putText };
  }

  if (!putRes.ok) {
    console.error('Upload logo failed', putRes.status, body);
    process.exit(1);
  }

  console.log('OK', {
    ambiente,
    empresa_id: empresaId,
    caminho_logo: body.caminho_logo ?? null,
    logo_bytes: readFileSync(logoPath).length,
  });
  console.log('DACTE já emitidos NÃO mudam — só próximos CT-e / reconsulta PDF.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
