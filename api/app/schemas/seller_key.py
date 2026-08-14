"""Seller key schemas."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import KeyStatus


class KeyCreate(BaseModel):
    label: str | None = Field(default=None, max_length=100)
    max_uses: int | None = Field(default=None, gt=0)
    expires_at: datetime | None = None


class KeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    key: str
    label: str | None
    status: KeyStatus
    max_uses: int | None
    used_count: int
    expires_at: datetime | None
    created_at: datetime


class KeyRedeem(BaseModel):
    key: str = Field(min_length=1, max_length=100)
