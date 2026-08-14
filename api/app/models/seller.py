"""Seller account — self-registers, then admin-approved."""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field

from app.core.enums import SellerStatus


class Seller(Document):
    email: EmailStr
    password_hash: str
    name: str
    contact: str | None = None
    status: SellerStatus = SellerStatus.PENDING
    approved_by: PydanticObjectId | None = None
    approved_at: datetime | None = None
    reject_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "sellers"
        indexes = [
            pymongo.IndexModel([("email", pymongo.ASCENDING)], unique=True),
            pymongo.IndexModel([("status", pymongo.ASCENDING)]),
        ]
