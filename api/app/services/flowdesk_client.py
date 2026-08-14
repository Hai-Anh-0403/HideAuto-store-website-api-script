"""Client for the flowdesk auth/device server (base URL already includes `/api`).

flowdesk only exposes *per-user* endpoints (auth with the user's own bearer):
  - GET /users/me   → verify an end-user's access token, return their identity
  - GET /devices    → that user's registered devices (machineId, os, lastSeenAt)

There is NO admin/service endpoint to query another user's devices, so app usage is
obtained with the END-USER's token (supplied by the desktop app on redeem / heartbeat)
and cached into `seller_members` for sellers/admins to read.
"""

import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(10.0)


class FlowdeskUser(BaseModel):
    id: str
    email: str
    name: str | None = Field(default=None, validation_alias="fullName")


def _url(path: str) -> str:
    return f"{settings.flowdesk_base_url.rstrip('/')}{path}"


async def verify_token(access_token: str) -> FlowdeskUser | None:
    """Return the flowdesk user for a valid access token, else None (GET /users/me)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                _url("/users/me"), headers={"Authorization": f"Bearer {access_token}"}
            )
    except httpx.HTTPError as exc:
        logger.warning("flowdesk verify_token request failed: %s", exc)
        return None
    if resp.status_code != 200:
        return None
    return FlowdeskUser.model_validate(resp.json())


async def get_devices(access_token: str) -> list[dict[str, Any]]:
    """Fetch the token owner's devices (GET /devices → {items,total,limit}). Fails soft to []."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
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
