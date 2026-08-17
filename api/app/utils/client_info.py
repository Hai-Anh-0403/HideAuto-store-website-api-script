"""Who is calling: client IP + a short device label read off the User-Agent.

Good enough to let a seller recognise their own sign-ins ("Chrome · Windows"); it is not
a fingerprint and never a security check.
"""

from typing import NamedTuple

from fastapi import Request

MAX_USER_AGENT = 400

# Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari".
_BROWSERS: list[tuple[str, str]] = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Opera", "Opera"),
    ("SamsungBrowser", "Samsung Internet"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
]

# Android/iOS say "Linux"/"Mac OS X" too, so the mobile ones are checked first.
_SYSTEMS: list[tuple[str, str]] = [
    ("Android", "Android"),
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Windows", "Windows"),
    ("Mac OS X", "macOS"),
    ("CrOS", "ChromeOS"),
    ("Linux", "Linux"),
]


def _match(user_agent: str, table: list[tuple[str, str]]) -> str | None:
    return next((label for needle, label in table if needle in user_agent), None)


def describe_device(user_agent: str | None) -> str | None:
    """'Chrome · Windows' — either half may be missing, both missing means None."""
    if not user_agent:
        return None
    parts = [p for p in (_match(user_agent, _BROWSERS), _match(user_agent, _SYSTEMS)) if p]
    return " · ".join(parts) if parts else None


class ClientInfo(NamedTuple):
    ip: str | None
    user_agent: str | None
    device: str | None


def read_client(request: Request) -> ClientInfo:
    """Read the caller's IP and user agent. Behind nginx the real IP is the first
    entry of X-Forwarded-For; direct calls fall back to the socket address."""
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() or (request.client.host if request.client else None)
    user_agent = (request.headers.get("user-agent") or "").strip()[:MAX_USER_AGENT] or None
    return ClientInfo(ip=ip, user_agent=user_agent, device=describe_device(user_agent))
