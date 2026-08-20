from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from saas_audit.config import build_config, CONFIG_DIR
from saas_audit.logger import get_logger
from saas_audit.runner import AuditRunner, exit_code_for_report


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="saas-audit",
        description="SaaS security audit (DAST) — Vectra Hub preset supported",
    )
    p.add_argument("--target", help="Single base URL override")
    p.add_argument("--preset", default="vectra.prod", help="Preset name in config/")
    p.add_argument("--config", type=Path, help="Additional YAML config path")
    p.add_argument(
        "--mode",
        choices=["passive", "active"],
        default="passive",
        help="passive=prod-safe (default); active=staging pentest",
    )
    p.add_argument(
        "--i-am-authorized",
        action="store_true",
        help="Required for active mode",
    )
    p.add_argument(
        "--allow-prod-active",
        action="store_true",
        help="Allow active mode on vectracargo.com.br (dangerous)",
    )
    p.add_argument(
        "--critical-stop",
        action="store_true",
        default=True,
        help="Stop on SQLi/IDOR (default: true)",
    )
    p.add_argument("--no-critical-stop", action="store_false", dest="critical_stop")
    p.add_argument("--output", default="../../audits/security", help="Output directory")
    p.add_argument("--token", help="JWT for authenticated passive tests")
    p.add_argument("--tests", help="Comma-separated scanner names")
    p.add_argument("--verbose", "-v", action="store_true")
    p.add_argument("--ci", action="store_true", help="Exit 1 on high/critical")
    p.add_argument("--proxy", help="HTTP proxy (Burp/ZAP)")
    p.add_argument("--max-rps", type=float, default=5.0)
    p.add_argument("--burst", type=int, default=100)
    p.add_argument("--delay-ms", type=int, default=200)
    p.add_argument("--webhook-url", help="Slack/Teams webhook URL")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logger = get_logger(verbose=args.verbose)

    config_path = args.config
    if config_path is None and args.preset:
        candidate = CONFIG_DIR / f"{args.preset}.yaml"
        if candidate.exists():
            config_path = candidate

    try:
        cfg = build_config(
            preset=args.preset if not args.config else None,
            config_path=config_path,
            mode=args.mode,
            i_am_authorized=args.i_am_authorized,
            allow_prod_active=args.allow_prod_active,
            critical_stop=args.critical_stop,
            verbose=args.verbose,
            ci=args.ci,
            output=args.output,
            proxy=args.proxy,
            token=args.token,
            tests=args.tests,
            max_rps=args.max_rps,
            burst=args.burst,
            delay_ms=args.delay_ms,
            webhook_url=args.webhook_url,
            target=args.target,
        )
    except (ValueError, FileNotFoundError) as exc:
        logger.error(str(exc))
        return 1

    runner = AuditRunner(cfg, logger)
    report = asyncio.run(runner.run())
    code = exit_code_for_report(report, cfg.ci)
    counts = report.severity_counts()
    logger.print(
        f"\n[bold]Done[/bold] — critical={counts['critical']} high={counts['high']} "
        f"medium={counts['medium']} low={counts['low']} info={counts['info']}"
    )
    return code


if __name__ == "__main__":
    sys.exit(main())
