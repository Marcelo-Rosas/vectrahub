/**
 * Task 9 — audit migration drift Hub local/remote vs Cargo remote.
 * Uso: npx tsx scripts/audit-migration-drift.mts
 */
import { readdirSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs', 'homolog');
mkdirSync(OUT, { recursive: true });

function localVersions(): string[] {
  return readdirSync(join(ROOT, 'supabase', 'migrations'))
    .filter((f) => /^\d{14}_.*\.sql$/.test(f))
    .map((f) => f.slice(0, 14))
    .sort();
}

function hubRemoteFromCli(): { local: string; remote: string }[] {
  const raw = execSync('npx supabase migration list --linked', {
    encoding: 'utf8',
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const start = raw.indexOf('{"migrations"');
  if (start < 0) throw new Error('migration list JSON not found');
  const end = raw.lastIndexOf('}') + 1;
  return (JSON.parse(raw.slice(start, end)) as { migrations: { local: string; remote: string }[] })
    .migrations;
}

const rows = hubRemoteFromCli();
const hubLocalOnly = rows.filter((r) => r.local && !r.remote).map((r) => r.local);
const hubRemoteOnly = rows.filter((r) => r.remote && !r.local).map((r) => r.remote);
const hubMatched = rows.filter((r) => r.local && r.remote && r.local === r.remote).length;
const local = localVersions();
const hubRemoteApplied = rows.filter((r) => r.remote).map((r) => r.remote);

const cargoSnap = JSON.parse(
  readFileSync(join(OUT, 'migration-cargo-remote-versions.json'), 'utf8')
) as { versions: string[] };
const cargoRemote = cargoSnap.versions;

const cargoOnly = cargoRemote.filter((v) => !hubRemoteApplied.includes(v) && !local.includes(v));
const hubOnlyVsCargo = hubRemoteApplied.filter((v) => !cargoRemote.includes(v));
const localNotInCargo = local.filter((v) => !cargoRemote.includes(v));

const report = {
  generated_at: new Date().toISOString(),
  hub_ref: 'lrbtbrpoklgwaaclbufz',
  cargo_ref: 'epgedaiukjippepujuzc',
  counts: {
    local_files: local.length,
    hub_matched_local_remote: hubMatched,
    hub_local_only: hubLocalOnly.length,
    hub_remote_only_orphan: hubRemoteOnly.length,
    cargo_remote: cargoRemote.length,
    cargo_only_not_in_hub: cargoOnly.length,
    hub_remote_not_in_cargo: hubOnlyVsCargo.length,
  },
  hub_local_vs_remote: {
    only_local_files_not_applied: hubLocalOnly,
    only_remote_orphan_no_file: hubRemoteOnly,
  },
  cargo_vs_hub: {
    in_cargo_not_hub_local_or_remote: cargoOnly,
    in_hub_remote_not_cargo: hubOnlyVsCargo,
    in_hub_local_not_cargo: localNotInCargo,
  },
  repair_notes: [
    'Orphans remote (sem arquivo local) quebram `supabase db push` — `npx supabase migration repair --status reverted <ver>` OU arquivo stub mesmo timestamp.',
    'Local-only: aplicar após repair orphans (`db push` / MCP apply_migration com nome alinhado).',
    'Cargo-only: cherry do remote `cargo-upstream` → `supabase/migrations/` Hub → `db push` Hub.',
    'Nunca apontar CI/secrets Cargo no projeto Hub.',
  ],
};

writeFileSync(join(OUT, 'migration-drift-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
