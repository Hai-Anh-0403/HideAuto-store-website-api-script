"""In-memory per-IP rate limiter for sensitive endpoints (login, redeem, activate)."""

import time
from collections import defaultdict

from fastapi import Request

from app.core.exceptions import AppError


class _Limiter:
    def __init__(self, max_calls: int, window_seconds: int) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        self._hits[key] = hits = [t for t in hits if now - t < self.window]
        if len(hits) >= self.max_calls:
            raise AppError("Too many requests", status_code=429, code="rate_limited")
        hits.append(now)


_login = _Limiter(max_calls=10, window_seconds=60)
_redeem = _Limiter(max_calls=10, window_seconds=60)
_activate = _Limiter(max_calls=20, window_seconds=60)


def reset_all() -> None:
    """Clear all rate-limit state (for tests)."""
    _login._hits.clear()
    _redeem._hits.clear()
    _activate._hits.clear()


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit_login(request: Request) -> None:
    """5 attempts per IP per minute."""
    _login.check(_ip(request))


def rate_limit_redeem(request: Request) -> None:
    """10 attempts per IP per minute."""
    _redeem.check(_ip(request))


def rate_limit_activate(request: Request) -> None:
    """20 attempts per IP per minute."""
    _activate.check(_ip(request))
