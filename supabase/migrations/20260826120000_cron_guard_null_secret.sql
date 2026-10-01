-- ═══════════════════════════════════════════════════════
-- Hardening: guarda NULL-secret nos cron jobs pg_net
-- ═══════════════════════════════════════════════════════
-- Contexto: todo cron monta a URL como
--   (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/...'
-- Regra do SQL: NULL || texto = NULL. Se o secret 'supabase_url' NAO existe no
-- Vault deste projeto, a URL vira NULL e net.http_post(url := NULL) viola o
-- NOT NULL de extensions.http_request_queue → SQLSTATE 23502, repetido a cada
-- tick do job (ex.: process-workflow-events a cada 2 min).
--
-- IMPORTANTE (nota operacional — item 2 do plano de hardening):
--   Estes secrets NAO sao criados por migration — sao CONFIG MANUAL por projeto.
--   Todo projeto (Hub, Cargo, branch nova, restore) precisa ter no Vault:
--     - 'supabase_url'      → ex.: https://lrbtbrpoklgwaaclbufz.supabase.co (Hub)
--     - 'service_role_key'  → Dashboard → Settings → API → service_role (JWT eyJ…)
--   Criar/atualizar via vault.create_secret / vault.update_secret. Sem eles os
--   cron jobs abaixo viram no-op silencioso (ver guarda WHERE), sem spammar 23502.
--
-- Esta migration re-agenda os 6 jobs existentes (cron.schedule faz upsert pelo
-- nome) adicionando a guarda: so enfileira o http_post quando AMBOS os secrets
-- existem. url NULL → 0 linhas (sem 23502); key NULL → 0 linhas (sem 401 em massa).
-- ═══════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Daily Operational Report — 07:00 BRT (10:00 UTC) ──
SELECT cron.schedule(
  'daily-operational-report',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ai-operational-agent',
    body := '{"analysisType":"operational_report","reportType":"daily"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);

-- ── Weekly Regulatory Scan — Monday 08:00 BRT (11:00 UTC) ──
SELECT cron.schedule(
  'weekly-regulatory-scan',
  '0 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ai-operational-agent',
    body := '{"analysisType":"regulatory_update"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);

-- ── Workflow Event Processor — every 2 minutes ──
SELECT cron.schedule(
  'process-workflow-events',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/workflow-orchestrator',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);

-- ── Notification Batch Processor — every 5 minutes ──
SELECT cron.schedule(
  'process-pending-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/notification-hub',
    body := '{"batch":true}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);

-- ── News Agent — 08:00 e 18:00 BRT (11:00 e 21:00 UTC) ──
SELECT cron.schedule(
  'news-agent-scan',
  '0 11,21 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/news-agent',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);

-- ── NTC Ingest — Segunda-feira 08:10 BRT (11:10 UTC) ──
SELECT cron.schedule(
  'ntc-ingest-weekly',
  '10 11 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ntc-ingest',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  )
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') IS NOT NULL
    AND (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key') IS NOT NULL;
  $$
);
