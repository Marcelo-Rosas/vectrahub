# SaaS Security Audit — Design Spec

**Date:** 2026-08-19  
**Package:** `tools/security-audit/`  
**Runtime:** Python 3.10+

## Purpose

Dynamic Application Security Testing (DAST) complement to static [`scripts/audit-compliance.ts`](../../scripts/audit-compliance.ts). Targets Vectra Hub production safely by default.

## Modes

| Mode | Use case | Scanners |
|------|----------|----------|
| `passive` (default) | Production | CORS, clickjacking, PII (redacted), JWT audit, user enum (2 pairs), rate limit observational (5–10 req) |
| `active` | Staging / authorized pentest | All passive + SQLi, IDOR, rate burst (100+) |

Active mode requires `--mode active --i-am-authorized`. Blocks `*.vectracargo.com.br` in active unless `--allow-prod-active`.

## Critical stop

SQLi or IDOR confirmed → abort run, exit code 2, partial report with CRITICAL finding.

## Vectra preset

- SPA: `app.vectracargo.com.br`, `app.feira.vectracargo.com.br`
- Supabase: `lrbtbrpoklgwaaclbufz.supabase.co`
- Known CORS risk: [`supabase/functions/_shared/cors.ts`](../../supabase/functions/_shared/cors.ts) fallback `*` off allowlist

## Ethics

- Never commit tokens; use `SAAS_AUDIT_TOKEN` env
- Redact Authorization/cookies in reports
- Internal rate limit default 5 RPS
- SQLi/IDOR only on authorized environments

## OWASP mapping

Each scanner maps to OWASP Top 10 2021 categories via `saas_audit/owasp.py`.

## Outputs

`report.json`, `report.html`, `report.csv`, `executive_summary.md`, `technical_summary.md`

## CI

Weekly passive workflow; exit 1 on high/critical, exit 2 on critical_stop.
