"""Mini-app activation schemas — what a packaged mini app sends and gets back."""

from pydantic import BaseModel, Field


class LicenseRequest(BaseModel):
    """Sent by the mini app on activation and on every re-check.

    `key` is only needed the first time: once redeemed, the entitlement lives on the
    membership and later launches just ask for a fresh licence.
    """

    key: str | None = Field(default=None, min_length=1, max_length=100)
    machine_id: str = Field(min_length=1, max_length=200)


class LicenseRead(BaseModel):
    """A signed licence.

    `payload_b64` is the licence itself: base64 of the exact JSON bytes that were signed.
    The mini app verifies `signature` over those bytes with the public key baked into its
    package, and only then parses them — never the other way round, and never by
    re-serializing the parsed object (see `license_service.encode_payload`).
    """

    payload_b64: str
    signature: str
    algorithm: str
