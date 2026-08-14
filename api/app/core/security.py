"""Password hashing + JWT creation/decoding for portal auth (sellers + admins)."""

from datetime import UTC, datetime, timedelta

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


def create_access_token(*, subject_id: str, role: Role) -> str:
    """Encode a portal access token. Subject format: '<role>:<id>'."""
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": f"{role.value}:{subject_id}",
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


class TokenData:
    """Decoded portal token identity."""

    def __init__(self, subject_id: str, role: Role) -> None:
        self.subject_id = subject_id
        self.role = role


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
    return TokenData(subject_id=id_part, role=role)
