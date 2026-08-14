"""Seller member — link between a seller and an end-user who redeemed a key.

`user_id` is the end-user's id in the flowdesk auth server (cross-service ref, string).
`user_email` / `user_name` are snapshots for display; `last_seen_at` is a usage cache.
"""

from datetime import UTC, datetime
from typing import Any

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field

from app.core.enums import MemberStatus


class SellerMember(Document):
    seller_id: PydanticObjectId
    key_id: PydanticObjectId
    user_id: str  # ref flowdesk users.id
    user_email: str | None = None
    user_name: str | None = None
    status: MemberStatus = MemberStatus.ACTIVE
    # Usage cache (from flowdesk GET /devices via the end-user's token on redeem/heartbeat).
    last_seen_at: datetime | None = None
    devices: list[dict[str, Any]] = Field(default_factory=list)
    usage_synced_at: datetime | None = None
    # Per-device block list (flowdesk device machineId). Empty = all devices allowed.
    blocked_devices: list[str] = Field(default_factory=list)
    redeemed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "seller_members"
        indexes = [
            pymongo.IndexModel(
                [("seller_id", pymongo.ASCENDING), ("user_id", pymongo.ASCENDING)],
                unique=True,
            ),
            pymongo.IndexModel([("seller_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("user_id", pymongo.ASCENDING)]),
        ]
