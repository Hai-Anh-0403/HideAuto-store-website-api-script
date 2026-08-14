"""Admin (staff) account — seeded, not self-registered."""

from datetime import UTC, datetime

import pymongo
from beanie import Document
from pydantic import EmailStr, Field


class Admin(Document):
    email: EmailStr
    password_hash: str
    name: str | None = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "admins"
        indexes = [
            pymongo.IndexModel([("email", pymongo.ASCENDING)], unique=True),
        ]
