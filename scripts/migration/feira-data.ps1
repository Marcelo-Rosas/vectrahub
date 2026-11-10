<#
  Migração dos DADOS do schema feira: Hub antigo (lrbtbrpoklgwaaclbufz) -> Hub novo (ztyqoufakcxbhabknujd).
  O schema (tabelas, RLS, funções) já existe no novo; aqui só copia linhas.

  Conexões em .env.migration (gitignored, raiz do repo) — NUNCA colar no chat:
    OLD_DB_URL=postgresql://postgres.lrbtbrpoklgwaaclbufz:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
    NEW_DB_URL=postgresql://postgres.ztyqoufakcxbhabknujd:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
  (Dashboard > Connect > Session pooler. Requer Docker rodando.)

  Passos (nesta ordem):
    .\scripts\migration\feira-data.ps1 -Step count    # contagem nos dois (só leitura)
    .\scripts\migration\feira-data.ps1 -Step dump     # pg_dump --data-only -n feira do ANTIGO
    .\scripts\migration\feira-data.ps1 -Step restore  # carrega no NOVO (aborta se já houver dados)
    .\scripts\migration\feira-data.ps1 -Step verify   # contagens iguais + usuários de user_company existem no novo
#>
param([Parameter(Mandatory)][ValidateSet('count', 'dump', 'restore', 'verify')][string]$Step)
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$envFile = Join-Path $root '.env.migration'
if (-not (Test-Path $envFile)) { throw ".env.migration não encontrado em $root (ver cabeçalho do script)." }
$cfg = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$' } | ForEach-Object {
  $cfg[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
}
$OLD = $cfg['OLD_DB_URL']; $NEW = $cfg['NEW_DB_URL']
if (-not $OLD -or -not $NEW) { throw 'OLD_DB_URL e NEW_DB_URL obrigatórios em .env.migration.' }
if ($OLD -notmatch 'lrbtbrpoklgwaaclbufz') { throw 'OLD_DB_URL não é o Hub antigo (lrbtbrpoklgwaaclbufz).' }
if ($NEW -notmatch 'ztyqoufakcxbhabknujd') { throw 'NEW_DB_URL não é o Hub novo (ztyqoufakcxbhabknujd).' }

$work = Join-Path $env:TEMP 'feira-migration'
New-Item -ItemType Directory -Force $work | Out-Null
$dumpFile = Join-Path $work 'feira-data.sql'
$img = 'postgres:17-alpine'

function Psql([string]$url, [string[]]$extra) {
  & docker run --rm -v "${work}:/w" $img psql $url -v ON_ERROR_STOP=1 -X -q @extra
  if ($LASTEXITCODE -ne 0) { throw "psql falhou (exit $LASTEXITCODE)" }
}

$countSql = @'
select string_agg(format('%s=%s', t, n), ' ' order by t) from (
  select c.relname t,
    (xpath('/row/n/text()', query_to_xml(format('select count(*) n from feira.%I', c.relname), false, true, '')))[1]::text::int n
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'feira' and c.relkind = 'r'
) x
'@

function Counts([string]$url) {
  $out = Psql $url @('-At', '-c', $countSql)
  $h = [ordered]@{}
  foreach ($kv in ("$out".Trim() -split ' ')) { if ($kv) { $p = $kv -split '='; $h[$p[0]] = [int]$p[1] } }
  return $h
}

switch ($Step) {
  'count' {
    'ANTIGO:'; (Counts $OLD) | Format-Table -AutoSize | Out-String
    'NOVO:'; (Counts $NEW) | Format-Table -AutoSize | Out-String
  }
  'dump' {
    & docker run --rm -v "${work}:/w" $img pg_dump $OLD --data-only --schema=feira --no-owner --no-privileges -f /w/feira-data.sql
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (exit $LASTEXITCODE)" }
    $kb = [math]::Round((Get-Item $dumpFile).Length / 1KB, 1)
    "Dump OK: $dumpFile ($kb KB)"
    'Tabelas com dados no dump:'
    Select-String -Path $dumpFile -Pattern '^COPY feira\.(\S+)' | ForEach-Object { '  ' + $_.Matches[0].Groups[1].Value }
  }
  'restore' {
    if (-not (Test-Path $dumpFile)) { throw 'Rode -Step dump antes.' }
    $novo = Counts $NEW
    $comDados = $novo.GetEnumerator() | Where-Object { $_.Value -gt 0 }
    if ($comDados) { throw "NOVO já tem dados em feira ($(($comDados | ForEach-Object { $_.Key }) -join ', ')). Abortado para não duplicar." }
    # Transação única; triggers/FKs desligados durante a carga (dados vêm consistentes do antigo).
    Set-Content -Path (Join-Path $work 'restore.sql') -Encoding utf8 -Value @'
SET session_replication_role = replica;
\i /w/feira-data.sql
SET session_replication_role = origin;
'@
    Psql $NEW @('-1', '-f', '/w/restore.sql')
    'Restore OK. Rode -Step verify.'
  }
  'verify' {
    $a = Counts $OLD; $n = Counts $NEW; $ok = $true
    foreach ($k in $a.Keys) {
      $flag = if ($a[$k] -eq $n[$k]) { 'ok' } else { $ok = $false; 'DIFERENTE' }
      '{0,-22} antigo={1,6}  novo={2,6}  {3}' -f $k, $a[$k], $n[$k], $flag
    }
    $orf = Psql $NEW @('-At', '-c', 'select count(*) from feira.user_company uc left join auth.users u on u.id = uc.user_id where u.id is null')
    "user_company sem usuário no auth novo: $("$orf".Trim())"
    if ($ok -and "$orf".Trim() -eq '0') { 'VERIFICAÇÃO OK' } else { 'VERIFICAÇÃO COM PENDÊNCIAS' }
  }
}
