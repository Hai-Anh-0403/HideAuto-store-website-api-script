"""Script listing — only what browsing/filtering needs, plus a pointer to the live version.

Heavy per-version detail lives in `script_versions`; the denormalized fields here are
copied from a version when an admin approves it.
"""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from app.core.enums import ScriptStatus
from app.utils.workflow_graph import Capabilities


class SellerRef(BaseModel):
    """Denormalized seller so listings don't need a second lookup."""

    id: PydanticObjectId
    name: str


class ScriptStats(BaseModel):
    rating_avg: float = 0.0
    rating_count: int = 0
    downloads: int = 0
    views: int = 0


class Script(Document):
    slug: str
    name: str
    short_description: str | None = None
    description: str | None = None
    category_id: PydanticObjectId | None = None
    tag_ids: list[PydanticObjectId] = Field(default_factory=list)
    seller: SellerRef
    engine: str = "hideflow"
    has_mini_app: bool = False

    # Pointer + denormalized copy of the approved version.
    latest_version: str | None = None
    latest_version_id: PydanticObjectId | None = None
    min_app_version: str | None = None
    node_count: int = 0
    node_groups_used: list[str] = Field(default_factory=list)
    capabilities: Capabilities = Field(default_factory=Capabilities)

    status: ScriptStatus = ScriptStatus.DRAFT
    reject_reason: str | None = None
    stats: ScriptStats = Field(default_factory=ScriptStats)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    published_at: datetime | None = None

    class Settings:
        name = "scripts"
        indexes = [
            pymongo.IndexModel([("slug", pymongo.ASCENDING)], unique=True),
            pymongo.IndexModel([("seller.id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("status", pymongo.ASCENDING)]),
            pymongo.IndexModel([("category_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("tag_ids", pymongo.ASCENDING)]),
            pymongo.IndexModel([("capabilities.browser_platforms", pymongo.ASCENDING)]),
            pymongo.IndexModel([("capabilities.uses_shell", pymongo.ASCENDING)]),
            pymongo.IndexModel([("min_app_version", pymongo.ASCENDING)]),
            pymongo.IndexModel([("stats.rating_avg", pymongo.DESCENDING)]),
        ]
