"""Seller schemas (input/output DTOs)."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.enums import SellerStatus


class SellerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    contact: str | None = Field(default=None, max_length=100)


class SellerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    email: EmailStr
    name: str
    contact: str | None
    status: SellerStatus
    created_at: datetime


class SellerReject(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
