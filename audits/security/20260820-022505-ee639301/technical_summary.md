# Security Audit — Technical Summary

Run `20260820-022505-ee639301` | mode `passive`

## Scanners skipped

- `jwt`: No token provided (--token or SAAS_AUDIT_TOKEN)
- `sqli`: SQLi disabled in passive mode (use --mode active)
- `idor`: IDOR disabled in passive mode (requires 2 user tokens)

## All findings

### [INFO] No rate-limit headers observed on SPA
- Scanner: `rate_limit`
- CVSS: 0.0
- OWASP: A07:2021-Identification and Authentication Failures
- Sent 8 GET requests; no X-RateLimit-* or 429 observed. Status distribution: {200: 8}. Latency p50=213ms.
- Remediation: Document rate limits at CDN/WAF/Supabase Auth layer; expose Retry-After on throttled endpoints.
- URL: `https://app.vectracargo.com.br/`

### [INFO] No critical CORS misconfigurations detected
- Scanner: `cors`
- CVSS: 0.0
- OWASP: A05:2021-Security Misconfiguration
- Tested malicious origins; no reflect+credentials pattern.
- Remediation: Re-test after CORS policy changes.

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

### [INFO] Clickjacking headers present or CSP frame-ancestors set
- Scanner: `clickjacking`
- CVSS: 0.0
- OWASP: A05:2021-Security Misconfiguration
- Checked X-Frame-Options and CSP on SPA targets.
- Remediation: Verify headers on all routes including error pages.
