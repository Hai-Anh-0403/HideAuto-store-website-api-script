"""Identifier / key / slug generation helpers."""

import re
import secrets
import unicodedata

from beanie import PydanticObjectId

_NON_SLUG_CHARS = re.compile(r"[^a-z0-9]+")
# NFKD leaves `đ` untouched (it has no decomposition), so map it explicitly.
_TRANSLITERATE = str.maketrans({"đ": "d", "Đ": "D"})


def generate_key(prefix: str = "SK") -> str:
    """A URL-safe, hard-to-guess seller key, e.g. 'SK-x7Qd...'."""
    return f"{prefix}-{secrets.token_urlsafe(16)}"


def slugify(value: str, *, fallback: str = "script") -> str:
    """ASCII slug for URLs — accents dropped, everything else collapsed to hyphens."""
    decomposed = unicodedata.normalize("NFKD", value.translate(_TRANSLITERATE))
    ascii_only = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    slug = _NON_SLUG_CHARS.sub("-", ascii_only.lower()).strip("-")
    return slug[:80].strip("-") or fallback


def require_id(value: PydanticObjectId | None) -> PydanticObjectId:
    """Narrow a persisted document's id (Beanie types it Optional) to non-None."""
    if value is None:
        raise RuntimeError("Persisted document is missing an id")
    return value
