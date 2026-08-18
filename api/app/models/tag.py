"""Tags for categorising scripts — "clone fb", "clone gmail", etc."""

from datetime import UTC, datetime

import pymongo
from beanie import Document
from pydantic import Field


class Tag(Document):
    name: str
    slug: str
    description: str | None = None
    color: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "tags"
        indexes = [
            pymongo.IndexModel([("slug", pymongo.ASCENDING)], unique=True),
            pymongo.IndexModel([("name", pymongo.ASCENDING)]),
        ]
