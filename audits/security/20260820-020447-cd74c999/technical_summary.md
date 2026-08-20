# Security Audit — Technical Summary

Run `20260820-020447-cd74c999` | mode `passive`

## Scanners skipped

- None

## All findings

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
