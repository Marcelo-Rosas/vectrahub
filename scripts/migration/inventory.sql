-- Inventário da migração do Hub (Task 1 / Task 9). Só leitura.
-- Rodar no SQL Editor do projeto antigo e do novo; exportar o resultado (CSV/JSON) e comparar.
-- Saída: secao | chave | valor

-- 1. Linhas por tabela (contagem real, não a estimativa do painel)
select 'linhas' as secao,
       table_schema || '.' || table_name as chave,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text as valor
from information_schema.tables
where table_type = 'BASE TABLE'
  and table_schema in ('public', 'feira', 'auth', 'storage')

union all
-- 2. Arquivos por bucket
select 'storage', bucket_id, count(*)::text
from storage.objects
group by bucket_id

union all
-- 3. Contadores fiscais (próximo número = last_numero + 1)
select 'cte_sequence', ambiente::text || '/serie ' || serie, last_numero::text from public.cte_sequence
union all
select 'mdfe_sequence', ambiente::text || '/serie ' || serie, last_numero::text from public.mdfe_sequence
union all
select 'cte_emitido_max', ambiente::text || '/serie ' || serie, max(numero)::text from public.cte_emissions group by ambiente, serie
union all
select 'mdfe_emitido_max', ambiente::text || '/serie ' || serie, max(numero)::text from public.mdfe_emissions group by ambiente, serie

union all
-- 4. Sequências do Postgres (códigos COT/OS/viagem/coleta e ids seriais)
select 'sequence', schemaname || '.' || sequencename, coalesce(last_value::text, 'nunca usada')
from pg_sequences
where schemaname in ('public', 'feira')

union all
-- 5. Cron jobs
select 'cron', jobname, schedule || ' | ativo=' || active::text
from cron.job

union all
-- 6. Extensões instaladas
select 'extensao', extname, extversion
from pg_extension

union all
-- 7. Funções e triggers (presença)
select 'funcao', n.nspname || '.' || p.proname, pg_get_function_identity_arguments(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'feira')
union all
select 'trigger', event_object_schema || '.' || event_object_table, trigger_name
from information_schema.triggers
where event_object_schema in ('public', 'feira')
group by event_object_schema, event_object_table, trigger_name

union all
-- 8. Nomes no Vault (sem valores)
select 'vault', name, 'presente'
from vault.secrets

union all
-- 9. Histórico de migrations registrado (Task 2: comparar com supabase/migrations/)
select 'migration', version, coalesce(name, '')
from supabase_migrations.schema_migrations

order by 1, 2, 3;
