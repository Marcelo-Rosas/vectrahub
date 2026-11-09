from __future__ import annotations

import uuid
from datetime import datetime, timezone

import httpx

from saas_audit.config import AuditConfig, all_target_urls
from saas_audit.http_client import RateLimitedClient
from saas_audit.logger import AuditLogger
from saas_audit.models import AuditReport, Finding
from saas_audit.reporters import (
    write_csv_report,
    write_executive_summary,
    write_html_report,
    write_json_report,
    write_technical_summary,
)
from saas_audit.scanners.rate_limit import RateLimitScanner
from saas_audit.scanners.cors import CorsScanner
from saas_audit.scanners.pii_leak import PiiLeakScanner
from saas_audit.scanners.jwt import JwtScanner
from saas_audit.scanners.user_enum import UserEnumScanner
from saas_audit.scanners.clickjacking import ClickjackingScanner
from saas_audit.scanners.sqli import SqliScanner
from saas_audit.scanners.idor import IdorScanner

ALL_SCANNERS = [
    RateLimitScanner,
    CorsScanner,
    PiiLeakScanner,
    JwtScanner,
    UserEnumScanner,
    ClickjackingScanner,
    SqliScanner,
    IdorScanner,
]


class AuditRunner:
    def __init__(self, cfg: AuditConfig, logger: AuditLogger) -> None:
        self.cfg = cfg
        self.logger = logger
        self.run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]

    async def run(self) -> AuditReport:
        urls = all_target_urls(self.cfg)
        target_summary = ", ".join(urls[:3])
        if len(urls) > 3:
            target_summary += f" (+{len(urls) - 3} more)"

        report = AuditReport(
            run_id=self.run_id,
            mode=self.cfg.mode,
            target_summary=target_summary or self.cfg.preset_name or "unknown",
            started_at=datetime.now(timezone.utc).isoformat(),
            metadata={"targets": urls, "preset": self.cfg.preset_name},
        )

        self.logger.info(f"Starting audit {self.run_id} mode={self.cfg.mode}")

        async with RateLimitedClient(
            proxy=self.cfg.proxy,
            max_rps=self.cfg.max_rps,
            token=self.cfg.token,
        ) as client:
            for ScannerCls in ALL_SCANNERS:
                scanner = ScannerCls(self.cfg, client, self.logger)
                if not scanner.enabled(self.cfg.tests):
                    self.logger.debug(f"Skipping {scanner.name} (not in --tests)")
                    continue
                self.logger.info(f"Running scanner: {scanner.name}")
                try:
                    findings, skipped = await scanner.run()
                    report.findings.extend(findings)
                    if skipped:
                        report.skipped.append(skipped)
                    for f in findings:
                        if f.critical_stop and self.cfg.critical_stop:
                            report.critical_stop_triggered = True
                            self.logger.critical(
                                f"CRITICAL STOP: {f.title} — halting audit"
                            )
                            break
                except Exception as exc:
                    self.logger.error(f"Scanner {scanner.name} failed: {exc}")
                if report.critical_stop_triggered:
                    break

        report.finished_at = datetime.now(timezone.utc).isoformat()
        self._write_reports(report)
        await self._notify_webhook(report)
        return report

    def _write_reports(self, report: AuditReport) -> None:
        out = self.cfg.output_dir / report.run_id
        write_json_report(report, out)
        write_html_report(report, out)
        write_csv_report(report, out)
        write_executive_summary(report, out)
        write_technical_summary(report, out)
        self.logger.info(f"Reports written to {out}")

    async def _notify_webhook(self, report: AuditReport) -> None:
        url = self.cfg.webhook_url
        if not url:
            return
        top = [f for f in report.findings if f.severity in ("critical", "high")][:5]
        if not top:
            return
        text = "\n".join(f"[{f.severity}] {f.title}" for f in top)
        payload = {"text": f"Security audit {report.run_id}\n{text}"}
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(url, json=payload)
        except Exception as exc:
            self.logger.warning(f"Webhook failed: {exc}")


def exit_code_for_report(report: AuditReport, ci: bool) -> int:
    if report.critical_stop_triggered:
        return 2
    if ci and report.max_severity() in ("critical", "high"):
        return 1
    return 0
