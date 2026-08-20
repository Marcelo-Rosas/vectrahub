from __future__ import annotations

from saas_audit.cvss import score_for_severity
from saas_audit.models import Evidence, Finding, SkippedScanner
from saas_audit.owasp import owasp_for_scanner
from saas_audit.scanners.base import BaseScanner
from saas_audit.http_client import redact_body


class IdorScanner(BaseScanner):
    name = "idor"

    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        if self.cfg.mode != "active":
            return [], SkippedScanner(
                self.name, "IDOR disabled in passive mode (requires 2 user tokens)"
            )

        token_b = self.cfg.user_b_token
        if not token_b:
            return [], SkippedScanner(
                self.name, "Set SAAS_AUDIT_USER_B_TOKEN for IDOR tests"
            )

        findings: list[Finding] = []
        resources = self.cfg.idor_resources or []
        if not resources:
            return findings, SkippedScanner(self.name, "No idor_resources in config")

        from saas_audit.http_client import RateLimitedClient

        async with RateLimitedClient(
            proxy=self.cfg.proxy,
            max_rps=self.cfg.max_rps,
            token=token_b,
        ) as client_b:
            for res in resources:
                url_template = res.get("url_template", "")
                owner_ids = res.get("owner_a_ids") or []
                for oid in owner_ids:
                    url = url_template.replace("{id}", str(oid))
                    try:
                        resp = await client_b.get(url)
                    except Exception as exc:
                        self.logger.debug(f"IDOR probe failed: {exc}")
                        continue

                    if resp.status_code == 200 and len(resp.content) > 50:
                        body = resp.text.lower()
                        if any(
                            k in body
                            for k in ("quote", "order", "client", "email", "cnpj")
                        ):
                            findings.append(
                                Finding(
                                    scanner=self.name,
                                    title="Potential IDOR — cross-user resource access",
                                    severity="critical",
                                    cvss_score=score_for_severity("critical"),
                                    owasp=owasp_for_scanner(self.name),
                                    description=(
                                        f"User B accessed resource {url} (status 200, "
                                        f"body length {len(resp.content)})"
                                    ),
                                    remediation=(
                                        "Enforce RLS/ownership check on every object read; "
                                        "use non-enumerable IDs."
                                    ),
                                    evidence=Evidence(
                                        url=url,
                                        method="GET",
                                        status_code=resp.status_code,
                                        response_snippet=redact_body(resp.text, 300),
                                    ),
                                    critical_stop=True,
                                )
                            )
                            return findings, None

        return findings, None
