"""Seller member schemas (seller-facing + admin-facing)."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict

from app.core.enums import MemberStatus


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    user_id: str
    user_email: str | None
    user_name: str | None
    status: MemberStatus
    last_seen_at: datetime | None
    blocked_devices: list[str] = []
    redeemed_at: datetime


class AdminMemberRead(MemberRead):
    """Admin view of a membership — also exposes which seller it belongs to."""

    seller_id: PydanticObjectId
    usage_synced_at: datetime | None


class AdminUserRow(BaseModel):
    """One distinct end-user across all sellers (aggregated)."""

    user_id: str
    user_email: str | None = None
    user_name: str | None = None
    membership_count: int
    last_seen_at: datetime | None = None


class MemberDevice(BaseModel):
    """A device (from flowdesk) with the store's per-device block state."""

    machine_id: str
    name: str | None = None
    os: str | None = None
    last_seen_at: datetime | None = None
    blocked: bool = False


class MemberUsage(BaseModel):
    """Cached usage/device info for a member (last synced from flowdesk)."""

    user_id: str
    online: bool = False
    last_seen_at: datetime | None = None
    usage_synced_at: datetime | None = None
    devices: list[MemberDevice] = []
