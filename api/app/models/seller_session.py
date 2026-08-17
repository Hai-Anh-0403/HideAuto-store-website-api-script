"""Seller login session — one row per signed-in device, so a token can be revoked."""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field


class SellerSession(Document):
    """A live sign-in. `jti` is the only link between a bearer token and this row:
    the token carries it, every request looks the session up, and revoking the row
    kills the token before its own expiry."""

    seller_id: PydanticObjectId
    jti: str
    device: str | None = None  # "Chrome · Windows", derived from the user agent
    user_agent: str | None = None
    ip: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    revoked_at: datetime | None = None

    class Settings:
        name = "seller_sessions"
        indexes = [
            pymongo.IndexModel([("jti", pymongo.ASCENDING)], unique=True),
            pymongo.IndexModel([("seller_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0),
        ]
