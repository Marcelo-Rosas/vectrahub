# Security Audit — Technical Summary

Run `20260820-021938-c5dfd446` | mode `passive`

## Scanners skipped

- None

## All findings

### [INFO] No critical CORS misconfigurations detected
- Scanner: `cors`
- CVSS: 0.0
- OWASP: A05:2021-Security Misconfiguration
- Tested malicious origins; no reflect+credentials pattern.
- Remediation: Re-test after CORS policy changes.

### [MEDIUM] Missing clickjacking protection headers
- Scanner: `clickjacking`
- CVSS: 5.5
- OWASP: A05:2021-Security Misconfiguration
- No X-Frame-Options or CSP frame-ancestors on https://app.vectracargo.com.br. PoC saved to C:\Users\marce\vectra-hub\tools\security-audit\poc\clickjacking_poc.html
- Remediation: Set X-Frame-Options: DENY or CSP frame-ancestors 'self'; configure in Cloudflare _headers.
- URL: `https://app.vectracargo.com.br`
