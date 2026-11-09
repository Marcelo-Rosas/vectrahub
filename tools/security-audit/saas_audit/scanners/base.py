from __future__ import annotations

from abc import ABC, abstractmethod

from saas_audit.config import AuditConfig
from saas_audit.http_client import RateLimitedClient
from saas_audit.logger import AuditLogger
from saas_audit.models import Finding, SkippedScanner


class BaseScanner(ABC):
    name: str = "base"

    def __init__(
        self,
        cfg: AuditConfig,
        client: RateLimitedClient,
        logger: AuditLogger,
    ) -> None:
        self.cfg = cfg
        self.client = client
        self.logger = logger

    @abstractmethod
    async def run(self) -> tuple[list[Finding], SkippedScanner | None]:
        ...

    def enabled(self, selected: list[str] | None) -> bool:
        if selected is None:
            return True
        return self.name in selected
