"""Client for the flowdesk auth/device server (base URL already includes `/api`).

flowdesk only exposes *per-user* endpoints (auth with the user's own bearer):
  - GET /users/me   → verify an end-user's access token, return their identity
  - GET /devices    → that user's registered devices (machineId, os, lastSeenAt)

There is NO admin/service endpoint to query another user's devices, so app usage is
obtained with the END-USER's token (supplied by the desktop app on redeem / heartbeat)
and cached into `seller_members` for sellers/admins to read.

The module shares a single httpx.AsyncClient across all requests to avoid paying a TCP +
TLS handshake on every call. Call init_client / close_client from the app lifespan.
"""

import logging
import time
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0)
_CACHE_TTL = 30  # seconds — short enough that a revoked token stops working quickly

_client: httpx.AsyncClient | None = None
_token_cache: dict[str, tuple[float, "FlowdeskUser"]] = {}


class FlowdeskUser(BaseModel):
    id: str
    email: str
    name: str | None = Field(default=None, validation_alias="fullName")


def _url(path: str) -> str:
    return f"{settings.flowdesk_base_url.rstrip('/')}{path}"


async def init_client() -> None:
    global _client
    _client = httpx.AsyncClient(timeout=_TIMEOUT)


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _get_client() -> httpx.AsyncClient:
    if _client is None:
        raise RuntimeError("flowdesk HTTP client not initialized; call init_client() first")
    return _client


def _prune_cache(now: float) -> None:
    stale = [k for k, (ts, _) in _token_cache.items() if now - ts >= _CACHE_TTL]
    for k in stale:
        del _token_cache[k]


async def verify_token(access_token: str) -> FlowdeskUser | None:
    """Return the flowdesk user for a valid access token, else None (GET /users/me).

    Results are cached for _CACHE_TTL seconds so repeated heartbeats/downloads by the
    same user skip the upstream round-trip.
    """
    now = time.monotonic()
    cached = _token_cache.get(access_token)
    if cached is not None:
        ts, user = cached
        if now - ts < _CACHE_TTL:
            return user
        del _token_cache[access_token]

    try:
        resp = await _get_client().get(
            _url("/users/me"), headers={"Authorization": f"Bearer {access_token}"}
        )
    except httpx.HTTPError as exc:
        logger.warning("flowdesk verify_token request failed: %s", exc)
        return None
    if resp.status_code != 200:
        return None
    user = FlowdeskUser.model_validate(resp.json())
    _token_cache[access_token] = (now, user)
    if len(_token_cache) > 500:
        _prune_cache(now)
    return user


async def get_devices(access_token: str) -> list[dict[str, Any]]:
    """Fetch the token owner's devices (GET /devices → {items,total,limit}). Fails soft to []."""
    try:
        resp = await _get_client().get(
            _url("/devices"), headers={"Authorization": f"Bearer {access_token}"}
        )
    except httpx.HTTPError as exc:
        logger.warning("flowdesk get_devices failed: %s", exc)
        return []
    if resp.status_code != 200:
        return []
    data = resp.json()
    items = data.get("items", []) if isinstance(data, dict) else data
    return items if isinstance(items, list) else []
