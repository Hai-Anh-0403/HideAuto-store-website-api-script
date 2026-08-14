"""Seller key — a seller issues keys; end-users redeem them to be linked."""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field

from app.core.enums import KeyStatus


class SellerKey(Document):
    seller_id: PydanticObjectId
    # Which mini app the key unlocks. None = a seller-wide key (unlocks everything the
    # seller publishes) — kept for keys issued before scripts existed.
    script_id: PydanticObjectId | None = None
    script_name: str | None = None  # denormalized for listings
    key: str
    label: str | None = None
    status: KeyStatus = KeyStatus.ACTIVE
    max_uses: int | None = None  # None = unlimited
    used_count: int = 0
    expires_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "seller_keys"
        indexes = [
            pymongo.IndexModel([("key", pymongo.ASCENDING)], unique=True),
            pymongo.IndexModel([("seller_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("script_id", pymongo.ASCENDING)]),
        ]
