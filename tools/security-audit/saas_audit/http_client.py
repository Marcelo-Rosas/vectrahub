from __future__ import annotations

import asyncio
import re
import time
from typing import Any

import httpx

REDACT_HEADERS = {"authorization", "cookie", "set-cookie", "apikey", "x-api-key"}


def redact_headers(headers: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in headers.items():
        if k.lower() in REDACT_HEADERS:
            out[k] = "[REDACTED]"
        else:
            out[k] = v
    return out


def redact_body(text: str | None, max_len: int = 500) -> str | None:
    if text is None:
        return None
    s = text[:max_len]
    for pattern in (
        r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
        r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b",
        r"password[\"']?\s*:\s*[\"'][^\"']+",
    ):
        s = re.sub(pattern, "[REDACTED]", s, flags=re.IGNORECASE)
    if len(text) > max_len:
        s += "…"
    return s


class RateLimitedClient:
    def __init__(
        self,
        *,
        proxy: str | None = None,
        timeout: float = 30.0,
        max_rps: float = 5.0,
        token: str | None = None,
    ) -> None:
        headers: dict[str, str] = {"User-Agent": "VectraSecurityAudit/0.1"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.AsyncClient(
            proxy=proxy,
            timeout=timeout,
            follow_redirects=True,
            headers=headers,
        )
        self._min_interval = 1.0 / max_rps if max_rps > 0 else 0
        self._last_request = 0.0
        self._lock = asyncio.Lock()

    async def _throttle(self) -> None:
        async with self._lock:
            now = time.monotonic()
            wait = self._min_interval - (now - self._last_request)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request = time.monotonic()

    async def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        json: Any = None,
        data: Any = None,
        params: dict[str, str] | None = None,
    ) -> httpx.Response:
        await self._throttle()
        return await self._client.request(
            method, url, headers=headers, json=json, data=data, params=params
        )

    async def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def options(self, url: str, **kwargs: Any) -> httpx.Response:
        return await self.request("OPTIONS", url, **kwargs)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> RateLimitedClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.aclose()
