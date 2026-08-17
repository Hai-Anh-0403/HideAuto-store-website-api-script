"""Seller session schemas — the signed-in devices a seller can see and sign out."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    device: str | None
    user_agent: str | None
    ip: str | None
    # True for the device reading this list — the UI must not let it be mistaken
    # for someone else's sign-in.
    current: bool = False
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime


class SessionsRevoked(BaseModel):
    """How many other devices the seller just signed out."""

    revoked: int
