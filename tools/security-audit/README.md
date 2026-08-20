# Security Audit SaaS — DAST toolkit

Python 3.10+ package for passive/active security audits of SaaS APIs and web apps.

**Default:** Vectra Hub production passive mode (safe for scheduled CI).

## Install

```bash
cd tools/security-audit
pip install -e ".[dev]"
```

## Usage

```bash
# Production passive (default)
saas-audit --preset vectra.prod --output ../../audits/security

# Specific scanners
saas-audit --preset vectra.prod --tests cors,clickjacking,pii_leak

# With JWT (logout reuse + deeper PII)
saas-audit --preset vectra.prod --token "$SAAS_AUDIT_TOKEN"

# Staging active (SQLi + IDOR) — NEVER prod without authorization
saas-audit --config config/vectra.staging.yaml \
  --mode active --i-am-authorized \
  --tests sqli,idor,rate_limit --critical-stop

# CI mode
saas-audit --preset vectra.prod --mode passive --ci --output ../../audits/security
# exit 0=ok, 1=high/critical in CI, 2=critical_stop
```

## Scanners

| Scanner | Passive | Active |
|---------|---------|--------|
| rate_limit | 8 GET observational | up to 100 burst |
| cors | yes | yes |
| pii_leak | yes | yes |
| jwt | needs `--token` | yes |
| user_enum | yes | yes |
| clickjacking | yes | yes |
| sqli | skipped | payloads + critical_stop |
| idor | skipped | 2 tokens + critical_stop |

## Reports

Written to `{output}/{run_id}/`:

- `report.json`
- `report.html`
- `report.csv`
- `executive_summary.md`
- `technical_summary.md`

## Ethics

- Run **passive** on production
- **Active** mode requires `--i-am-authorized`
- Active blocked on `*.vectracargo.com.br` unless `--allow-prod-active`
- Never commit tokens; use env vars:
  - `SAAS_AUDIT_TOKEN`
  - `SAAS_AUDIT_USER_A_TOKEN` / `SAAS_AUDIT_USER_B_TOKEN`
  - `SAAS_AUDIT_WEBHOOK`

## Proxy (Burp/ZAP)

```bash
saas-audit --preset vectra.prod --proxy http://127.0.0.1:8080
```

## Cron example

```cron
0 3 * * 1 cd /path/vectra-hub/tools/security-audit && saas-audit --preset vectra.prod --ci
```

## Limitations

Complements static [`scripts/audit-compliance.ts`](../../scripts/audit-compliance.ts). Does not replace OWASP ZAP/Burp for deep SQLi fuzzing.
