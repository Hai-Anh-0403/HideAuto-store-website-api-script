"""Script + script version DTOs (the API boundary — documents never leave as-is)."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DeliveryFormat, ScriptStatus, ScriptVersionStatus
from app.utils.workflow_graph import Capabilities, GraphScan, RequiredVariable

SEMVER_PATTERN = r"^\d+\.\d+\.\d+$"


class ScriptInspect(BaseModel):
    """What the store can already tell from an upload, before anything is saved.

    Lets the seller see the derived metadata (and any embedded secret) up front instead
    of finding out after publishing.
    """

    suggested_name: str
    app_name: str | None
    app_id: str | None
    workflow_name: str | None
    delivery: DeliveryFormat
    node_count: int
    node_groups_used: list[str]
    uses_control_flow: bool
    sub_workflow_ids: list[str]
    capabilities: Capabilities
    required_variables: list[RequiredVariable]
    scan: GraphScan


class ScriptCreate(BaseModel):
    """Seller-supplied listing text. Anything technical is derived from the graph."""

    # Optional: falls back to the mini app's own name from the uploaded package.
    name: str | None = Field(default=None, min_length=3, max_length=120)
    short_description: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)
    version: str = Field(default="1.0.0", pattern=SEMVER_PATTERN)
    changelog: str | None = Field(default=None, max_length=2_000)
    min_app_version: str | None = Field(default=None, pattern=SEMVER_PATTERN)
    tested_app_version: str | None = Field(default=None, pattern=SEMVER_PATTERN)


class ScriptUpdate(BaseModel):
    """Listing text the seller can fix after publishing. Everything else is derived."""

    name: str | None = Field(default=None, min_length=3, max_length=120)
    short_description: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=20_000)


class ScriptVersionCreate(BaseModel):
    version: str = Field(pattern=SEMVER_PATTERN)
    changelog: str | None = Field(default=None, max_length=2_000)
    min_app_version: str | None = Field(default=None, pattern=SEMVER_PATTERN)
    tested_app_version: str | None = Field(default=None, pattern=SEMVER_PATTERN)


class VersionReject(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class SellerRefRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    name: str


class ScriptStatsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rating_avg: float
    rating_count: int
    downloads: int
    views: int


class ModerationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reviewed_at: datetime | None
    reason: str | None
    scanned_at: datetime | None


class ScriptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    slug: str
    name: str
    short_description: str | None
    description: str | None
    seller: SellerRefRead
    engine: str
    status: ScriptStatus
    reject_reason: str | None
    has_mini_app: bool
    latest_version: str | None
    latest_version_id: PydanticObjectId | None
    min_app_version: str | None
    node_count: int
    node_groups_used: list[str]
    capabilities: Capabilities
    stats: ScriptStatsRead
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class ScriptVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    script_id: PydanticObjectId
    version: str
    changelog: str | None
    source_filename: str | None
    delivery: DeliveryFormat
    format_version: int
    min_app_version: str | None
    tested_app_version: str | None
    node_count: int
    node_groups_used: list[str]
    uses_control_flow: bool
    sub_workflow_ids: list[str]
    capabilities: Capabilities
    required_variables: list[RequiredVariable]
    scan: GraphScan
    app_id: str | None
    app_name: str | None
    status: ScriptVersionStatus
    moderation: ModerationRead
    released_at: datetime | None
    created_at: datetime


class ScriptDetailRead(ScriptRead):
    versions: list[ScriptVersionRead] = Field(default_factory=list)
