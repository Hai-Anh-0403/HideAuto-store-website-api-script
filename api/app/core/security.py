"""Password hashing + JWT creation/decoding for portal auth (sellers + admins)."""

import asyncio
import secrets
from datetime import UTC, datetime, timedelta
from typing import NamedTuple

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings
from app.core.enums import Role


def _pw_bytes(plain: str) -> bytes:
    # bcrypt hashes at most 72 bytes; truncate deterministically (classic behaviour)
    # so long inputs don't raise on bcrypt >= 4.1.
    return plain.encode("utf-8")[:72]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_pw_bytes(plain), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_pw_bytes(plain), hashed.encode("ascii"))
    except ValueError:
        return False


# bcrypt is deliberately slow (~200ms a call here). Run it on a worker thread so one
# login does not stall every other request on the event loop.
async def hash_password_async(plain: str) -> str:
    return await asyncio.to_thread(hash_password, plain)


async def verify_password_async(plain: str, hashed: str) -> bool:
    return await asyncio.to_thread(verify_password, plain, hashed)


class IssuedToken(NamedTuple):
    """A freshly minted token plus what a session row needs to track it."""

    token: str
    jti: str
    expires_at: datetime


def create_access_token(*, subject_id: str, role: Role) -> IssuedToken:
    """Encode a portal access token. Subject format: '<role>:<id>'.

    Every token carries a `jti` so the sign-in behind it can be listed and revoked.
    """
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    jti = secrets.token_urlsafe(24)
    payload = {
        "sub": f"{role.value}:{subject_id}",
        "role": role.value,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return IssuedToken(token=token, jti=jti, expires_at=expire)


class TokenData:
    """Decoded portal token identity."""

    def __init__(self, subject_id: str, role: Role, jti: str | None) -> None:
        self.subject_id = subject_id
        self.role = role
        # Tokens minted before sessions existed carry no jti; those are refused.
        self.jti = jti


def decode_access_token(token: str) -> TokenData | None:
    """Return the token identity, or None if invalid/expired/malformed."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    sub = payload.get("sub", "")
    role_raw = payload.get("role", "")
    if not isinstance(sub, str) or ":" not in sub:
        return None
    role_part, _, id_part = sub.partition(":")
    if role_part != role_raw or not id_part:
        return None
    try:
        role = Role(role_raw)
    except ValueError:
        return None
    jti = payload.get("jti")
    return TokenData(subject_id=id_part, role=role, jti=jti if isinstance(jti, str) else None)
