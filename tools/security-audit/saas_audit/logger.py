from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

from rich.console import Console
from rich.logging import RichHandler


class AuditLogger:
    def __init__(self, verbose: bool = False) -> None:
        level = logging.DEBUG if verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format="%(message)s",
            datefmt="[%X]",
            handlers=[RichHandler(rich_tracebacks=True, show_path=False)],
            force=True,
        )
        self._log = logging.getLogger("saas_audit")
        self._console = Console(stderr=True)

    def _ts(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def info(self, msg: str) -> None:
        self._log.info("[%s] INFO %s", self._ts(), msg)

    def warning(self, msg: str) -> None:
        self._log.warning("[%s] WARNING %s", self._ts(), msg)

    def error(self, msg: str) -> None:
        self._log.error("[%s] ERROR %s", self._ts(), msg)

    def critical(self, msg: str) -> None:
        self._log.critical("[%s] CRITICAL %s", self._ts(), msg)

    def debug(self, msg: str) -> None:
        self._log.debug("[%s] DEBUG %s", self._ts(), msg)

    def print(self, msg: str) -> None:
        self._console.print(msg)


def get_logger(verbose: bool = False) -> AuditLogger:
    return AuditLogger(verbose=verbose)
