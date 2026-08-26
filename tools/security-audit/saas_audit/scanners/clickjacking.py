from __future__ import annotations

from pathlib import Path

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_headers

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
POC_DIR = PACKAGE_ROOT / "poc"


class ClickjackingScanner(BaseScanner):
    name = "clickjacking"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        findings: list[Finding] = []
        spa = self.cfg.targets.get("spa") or []
        if not spa:
            return findings, SkippedScanner(self.name, "No SPA targets")

        POC_DIR.mkdir(parents=True, exist_ok=True)

        for url in spa:
            try:
                resp = await self.client.get(url.rstrip("/") + "/")
            except Exception as exc:
                self.logger.debug(f"Clickjacking probe failed: {exc}")
                continue

            xfo = resp.headers.get("X-Frame-Options", "")
            csp = resp.headers.get("Content-Security-Policy", "")
            has_frame_ancestors = "frame-ancestors" in csp.lower()
            protected = (
                xfo.upper() in ("DENY", "SAMEORIGIN")
                or has_frame_ancestors
            )

            if not protected:
                poc_path = POC_DIR / "clickjacking_poc.html"
                poc_path.write_text(
                    f"""<!DOCTYPE html>
<html><head><title>Clickjacking PoC — {url}</title></head>
<body>
<h1>Clickjacking PoC (local test only)</h1>
<iframe src="{url}" width="800" height="600" style="opacity:0.5;border:2px solid red;"></iframe>
</body></html>""",
                    encoding="utf-8",
                )
                findings.append(
                    Finding(
                        scanner=self.name,
                        title="Missing clickjacking protection headers",
                        severity="medium",
                        cvss_score=score_for_severity("medium"),
                        owasp=owasp_for_scanner(self.name),
                        description=(
                            f"No X-Frame-Options or CSP frame-ancestors on {url}. "
                            f"PoC saved to {poc_path}"
                        ),
                        remediation=(
                            "Set X-Frame-Options: DENY or CSP frame-ancestors 'self'; "
                            "configure in Cloudflare _headers."
                        ),
                        evidence=Evidence(
                            url=url,
                            method="GET",
                            status_code=resp.status_code,
                            response_headers=redact_headers(dict(resp.headers)),
                        ),
                    )
                )
            elif xfo and xfo.upper() not in ("DENY", "SAMEORIGIN"):
                findings.append(
                    Finding(
                        scanner=self.name,
                        title=f"Invalid X-Frame-Options value: {xfo}",
                        severity="low",
                        cvss_score=score_for_severity("low"),
                        owasp=owasp_for_scanner(self.name),
                        description="Non-standard XFO may be ignored by browsers.",
                        remediation="Use DENY or SAMEORIGIN only.",
                    )
                )

        if not any(f.severity in ("medium", "high", "critical") for f in findings):
            findings.append(
                Finding(
                    scanner=self.name,
                    title="Clickjacking headers present or CSP frame-ancestors set",
                    severity="info",
                    cvss_score=score_for_severity("info"),
                    owasp=owasp_for_scanner(self.name),
                    description="Checked X-Frame-Options and CSP on SPA targets.",
                    remediation="Verify headers on all routes including error pages.",
                )
            )

        return findings, None
