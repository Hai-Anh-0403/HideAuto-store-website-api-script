"""Sign the licence a packaged mini app checks on launch.

The mini app runs on the buyer's machine, so it cannot be trusted to decide anything —
but it can *verify*: the store signs a small JSON payload with Ed25519, the public key
travels inside the package, and Node checks it with `crypto.verify` (no library needed).

A licence carries an expiry: that is the buyer's offline grace period, and also the
longest a revoked key keeps working. Shorter = tighter control, more calls home.
"""

import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from app.core.config import settings
from app.core.exceptions import AppError

LICENSE_FORMAT = 1
SIGNATURE_ALGORITHM = "Ed25519"


def _b64encode(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _private_key() -> Ed25519PrivateKey:
    """Load the signing key, or fail loudly — never sign with an improvised key."""
    seed = settings.license_signing_key
    if not seed:
        raise AppError(
            "Mini-app licensing is not configured (LICENSE_SIGNING_KEY)",
            status_code=503,
            code="licensing_unconfigured",
        )
    try:
        return Ed25519PrivateKey.from_private_bytes(base64.b64decode(seed, validate=True))
    except (ValueError, TypeError) as exc:
        raise AppError(
            "LICENSE_SIGNING_KEY is not a base64 Ed25519 seed (32 bytes)",
            status_code=500,
            code="licensing_misconfigured",
        ) from exc


def is_configured() -> bool:
    return bool(settings.license_signing_key)


def public_key_b64() -> str:
    """The verification key that gets baked into every package."""
    return _b64encode(
        _private_key().public_key().public_bytes_raw(),
    )


def encode_payload(payload: dict[str, Any]) -> bytes:
    """Serialize once, sign those exact bytes, ship those exact bytes.

    The mini app must NOT re-serialize the payload to check the signature: Python and
    JavaScript disagree on details like escaping non-ASCII (a seller name with dấu tiếng
    Việt would already be enough), and every such difference breaks verification. So the
    bytes travel base64-encoded and the app verifies what it received.
    """
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )


def sign(raw: bytes) -> str:
    return _b64encode(_private_key().sign(raw))


def verify(raw: bytes, signature: str) -> bool:
    """What the mini app does, mirrored here for tests and for debugging a rejection."""
    public_key = Ed25519PublicKey.from_public_bytes(
        base64.b64decode(public_key_b64(), validate=True)
    )
    try:
        public_key.verify(base64.b64decode(signature, validate=True), raw)
    except (InvalidSignature, ValueError):
        return False
    return True


def build_payload(
    *,
    script_id: str,
    app_id: str,
    app_name: str,
    seller_name: str,
    user_id: str,
    user_email: str,
    machine_id: str,
) -> dict[str, Any]:
    """What the mini app is allowed to believe once the signature checks out.

    `machine_id` is inside the signed payload on purpose: copying the licence file to
    another machine invalidates it there.
    """
    now = datetime.now(UTC)
    expires = now + timedelta(days=settings.license_ttl_days)
    return {
        "format": LICENSE_FORMAT,
        "script_id": script_id,
        "app_id": app_id,
        "app_name": app_name,
        "seller_name": seller_name,
        "user_id": user_id,
        "user_email": user_email,
        "machine_id": machine_id,
        "issued_at": now.isoformat().replace("+00:00", "Z"),
        "expires_at": expires.isoformat().replace("+00:00", "Z"),
    }
