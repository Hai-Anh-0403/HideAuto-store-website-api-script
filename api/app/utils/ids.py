"""Identifier / key generation helpers."""

import secrets

from beanie import PydanticObjectId


def generate_key(prefix: str = "SK") -> str:
    """A URL-safe, hard-to-guess seller key, e.g. 'SK-x7Qd...'."""
    return f"{prefix}-{secrets.token_urlsafe(16)}"


def require_id(value: PydanticObjectId | None) -> PydanticObjectId:
    """Narrow a persisted document's id (Beanie types it Optional) to non-None."""
    if value is None:
        raise RuntimeError("Persisted document is missing an id")
    return value
