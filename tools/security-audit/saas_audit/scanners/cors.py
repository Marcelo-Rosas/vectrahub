from __future__ import annotations

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_headers


class CorsScanner(BaseScanner):
    name = "cors"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        origins = self.cfg.cors_origins_test or [
            "https://evil.com",
            "https://attacker.com",
            "null",
        ]

        urls: list[str] = []
        spa = self.cfg.targets.get("spa") or []
        urls.extend(spa)
        supabase = self.cfg.targets.get("supabase") or {}
        if isinstance(supabase, dict):
            base = (supabase.get("base") or "").rstrip("/")
            if base:
                for fn in supabase.get("functions_sample") or []:
                    urls.append(f"{base}/functions/v1/{fn}")

        if not urls:
            return findings, SkippedScanner(self.name, "No targets for CORS")

        for url in urls:
            for origin in origins:
                origin_hdr = "null" if origin == "null" else origin
                for method in ("GET", "OPTIONS"):
                    headers = {
                        "Origin": origin_hdr,
                        "Access-Control-Request-Method": "POST",
                    }
                    try:
                        if method == "OPTIONS":
                            resp = await self.client.options(url, headers=headers)
                        else:
                            resp = await self.client.get(url, headers={"Origin": origin_hdr})
                    except Exception as exc:
                        self.logger.debug(f"CORS probe failed {url}: {exc}")
                        continue

                    acao = resp.headers.get("Access-Control-Allow-Origin", "")
                    acac = resp.headers.get("Access-Control-Allow-Credentials", "").lower()
                    reflected = acao == origin_hdr or (origin != "null" and acao == origin)
                    wildcard = acao == "*"
                    credentials = acac == "true"

                    severity = None
                    title = None
                    if reflected and credentials:
                        severity = "critical"
                        title = "CORS reflects Origin with Allow-Credentials"
                    elif wildcard and credentials:
                        severity = "critical"
                        title = "CORS wildcard with Allow-Credentials"
                    elif reflected:
                        severity = "high"
                        title = "CORS reflects untrusted Origin"
                    elif wildcard and "/functions/" in url:
                        severity = "medium"
                        title = "CORS wildcard on Edge Function"

                    if severity and title:
                        findings.append(
                            Finding(
                                scanner=self.name,
                                title=title,
                                severity=severity,  # type: ignore[arg-type]
                                cvss_score=score_for_severity(severity),  # type: ignore[arg-type]
                                owasp=owasp_for_scanner(self.name),
                                description=(
                                    f"{method} {url} Origin={origin_hdr} → "
                                    f"ACAO={acao} ACAC={acac}"
                                ),
                                remediation=(
                                    "Use strict origin allowlist; never reflect arbitrary origins "
                                    "with credentials. Prefer Vary: Origin without wildcard fallback."
                                ),
                                evidence=Evidence(
                                    url=url,
                                    method=method,
                                    request_headers={"Origin": origin_hdr},
                                    status_code=resp.status_code,
                                    response_headers=redact_headers(dict(resp.headers)),
                                ),
                            )
                        )

        if not findings:
            findings.append(
                Finding(
                    scanner=self.name,
                    title="No critical CORS misconfigurations detected",
                    severity="info",
                    cvss_score=score_for_severity("info"),
                    owasp=owasp_for_scanner(self.name),
                    description="Tested malicious origins; no reflect+credentials pattern.",
                    remediation="Re-test after CORS policy changes.",
                )
            )

        return findings, None
