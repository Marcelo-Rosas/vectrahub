#!/usr/bin/env node
/**
 * Remove Cloudflare Access (Zero Trust) das URLs do TMS para login público via Supabase.
 *
 * Uso:
 *   CLOUDFLARE_ZERO_TRUST_API_TOKEN=<token Zero Trust Write> node scripts/disable-cloudflare-access-public.mjs --apply
 *   (fallback: CLOUDFLARE_API_TOKEN se tiver permissão Access)
 *
 * Token: Cloudflare Dashboard → My Profile → API Tokens → Create Token
 *   Template: "Edit Cloudflare Zero Trust" ou permissões Account → Access: Apps and Policies → Edit
 *
 * Sem --apply: apenas lista apps que seriam removidos (dry-run).
 *
 * CI: em deploy-cloudflare.yml roda com --apply após Pages deploy.
 * GitHub: secret CLOUDFLARE_ZERO_TRUST_API_TOKEN (template Edit Cloudflare Zero Trust).
 * O CLOUDFLARE_API_TOKEN do Pages deploy normalmente NÃO tem essa permissão.
 */
const DEFAULT_ACCOUNT_ID = '361e9e1383bfa8e95e1db54e6c2a3bba';
const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);

const API = 'https://api.cloudflare.com/client/v4';
const token = (
  process.env.CLOUDFLARE_ZERO_TRUST_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN
)?.trim();
const apply = process.argv.includes('--apply');

/**
 * Hosts que devem ficar públicos (login Supabase na aplicação).
 * Inclui previews PR: pr-123.cargo-flow-navigator.pages.dev
 */
const PUBLIC_HOST_PATTERNS = [
  'app.hub.vectracargo.com.br',
  'hub.vectracargo.com.br',
  'vectrahub.pages.dev',
  // legado Cargo (se Access acidentalmente cobrir previews mistos)
  'app.vectracargo.com.br',
  'cargo-flow-navigator.pages.dev',
];

function matchesPublicHost(app) {
  const hay = [app.domain, app.name, app.aud, ...(app.destinations?.map((d) => d.uri) ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return PUBLIC_HOST_PATTERNS.some((p) => hay.includes(p.toLowerCase()));
}

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok || body.success === false) {
    const msg = body.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || res.statusText;
    throw new Error(msg);
  }
  return body.result;
}

async function main() {
  if (!token) {
    console.error(
      'Defina CLOUDFLARE_ZERO_TRUST_API_TOKEN (template Edit Cloudflare Zero Trust).\n' +
        'Alternativa manual: Zero Trust → Access → Applications → excluir apps de app.vectracargo.com.br'
    );
    process.exit(1);
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
  const apps = await cf(`/accounts/${accountId}/access/apps?per_page=100`);
  const targets = (apps ?? []).filter(matchesPublicHost);

  if (targets.length === 0) {
    console.log(
      JSON.stringify(
        {
          status: 'no_matching_apps',
          message:
            'Nenhum Access app encontrado para os hosts do TMS. Domínio já pode estar público.',
          patterns: PUBLIC_HOST_PATTERNS,
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        status: apply ? 'deleting' : 'dry_run',
        account_id: accountId,
        targets: targets.map((a) => ({ id: a.id, name: a.name, domain: a.domain, type: a.type })),
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log('\nReexecute com --apply para remover os apps listados.');
    return;
  }

  for (const app of targets) {
    await cf(`/accounts/${accountId}/access/apps/${app.id}`, { method: 'DELETE' });
    console.log(`Removido: ${app.name} (${app.domain ?? app.id})`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'done',
        removed: targets.length,
        verify:
          'curl -sI https://app.vectracargo.com.br/auth | findstr /i "HTTP Cloudflare-Access Location"',
      },
      null,
      2
    )
  );
}

function isAuthOrPermissionError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|permission|forbidden|10000|9109|9103/i.test(msg);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  if (isCi && isAuthOrPermissionError(err)) {
    console.warn(
      '::warning::Configure o secret CLOUDFLARE_ZERO_TRUST_API_TOKEN (Edit Cloudflare Zero Trust) ou remova Access manualmente em Zero Trust → Access → Applications'
    );
    process.exit(0);
  }
  process.exit(2);
});
