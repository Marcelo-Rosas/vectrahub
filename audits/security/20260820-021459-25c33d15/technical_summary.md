# Security Audit — Technical Summary

Run `20260820-021459-25c33d15` | mode `passive`

## Scanners skipped

- `jwt`: No token provided (--token or SAAS_AUDIT_TOKEN)
- `sqli`: SQLi disabled in passive mode (use --mode active)
- `idor`: IDOR disabled in passive mode (requires 2 user tokens)

## All findings

### [INFO] No rate-limit headers observed on SPA
- Scanner: `rate_limit`
- CVSS: 0.0
- OWASP: A07:2021-Identification and Authentication Failures
- Sent 8 GET requests; no X-RateLimit-* or 429 observed. Status distribution: {200: 8}. Latency p50=210ms.
- Remediation: Document rate limits at CDN/WAF/Supabase Auth layer; expose Retry-After on throttled endpoints.
- URL: `https://app.vectracargo.com.br/`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/calculate-freight`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/feira-save-quote`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep Origin=https://evil.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- GET https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep`

### [MEDIUM] CORS wildcard on Edge Function
- Scanner: `cors`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- OPTIONS https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep Origin=https://attacker.com → ACAO=* ACAC=
- Remediation: Use strict origin allowlist; never reflect arbitrary origins with credentials. Prefer Vary: Origin without wildcard fallback.
- URL: `https://lrbtbrpoklgwaaclbufz.supabase.co/functions/v1/lookup-cep`

### [INFO] No sensitive patterns in scanned public paths
- Scanner: `pii_leak`
- CVSS: 0.0
- OWASP: A01:2021-Broken Access Control, A02:2021-Cryptographic Failures
- Passive regex scan on configured paths.
- Remediation: Extend scan with authenticated endpoints via --token.

### [INFO] No obvious user enumeration signals
- Scanner: `user_enum`
- CVSS: 0.0
- OWASP: A07:2021-Identification and Authentication Failures
- Compared login/recover responses (limited passive sample).
- Remediation: Configure existing_email in preset for deeper login compare.

### [MEDIUM] Missing clickjacking protection headers
- Scanner: `clickjacking`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- No X-Frame-Options or CSP frame-ancestors on https://app.vectracargo.com.br. PoC saved to C:\Users\marce\vectra-hub\tools\security-audit\poc\clickjacking_poc.html
- Remediation: Set X-Frame-Options: DENY or CSP frame-ancestors 'self'; configure in Cloudflare _headers.
- URL: `https://app.vectracargo.com.br`

### [MEDIUM] Missing clickjacking protection headers
- Scanner: `clickjacking`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- No X-Frame-Options or CSP frame-ancestors on https://app.feira.vectracargo.com.br. PoC saved to C:\Users\marce\vectra-hub\tools\security-audit\poc\clickjacking_poc.html
- Remediation: Set X-Frame-Options: DENY or CSP frame-ancestors 'self'; configure in Cloudflare _headers.
- URL: `https://app.feira.vectracargo.com.br`
