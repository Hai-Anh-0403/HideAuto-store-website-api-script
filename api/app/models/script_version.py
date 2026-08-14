"""One uploaded build of a script: the scrubbed graph, its scan, and moderation state.

Every upload creates a new version and is re-scanned and re-reviewed from scratch —
an upload is untrusted no matter how many versions the seller already shipped.
"""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from app.core.enums import DeliveryFormat, ScriptVersionStatus
from app.utils.workflow_graph import Capabilities, GraphScan, RequiredVariable

FORMAT_VERSION = 1


class Moderation(BaseModel):
    reviewed_by: PydanticObjectId | None = None
    reviewed_at: datetime | None = None
    reason: str | None = None
    scanned_at: datetime | None = None


class ScriptVersion(Document):
    script_id: PydanticObjectId
    version: str
    changelog: str | None = None

    file_id: PydanticObjectId  # → uploads (scrubbed workflow graph)
    # The uploaded package itself is deliberately NOT stored: it carries the seller's raw
    # secrets and can weigh hundreds of MB. Only its identity is kept for traceability,
    # and repackaging rebuilds from the scrubbed graph + a mini-app template.
    source_filename: str | None = None
    source_checksum: str | None = None
    delivery: DeliveryFormat
    format_version: int = FORMAT_VERSION

    min_app_version: str | None = None
    tested_app_version: str | None = None

    # Derived from the graph — never taken from the seller.
    node_count: int = 0
    node_groups_used: list[str] = Field(default_factory=list)
    uses_control_flow: bool = False
    sub_workflow_ids: list[str] = Field(default_factory=list)
    capabilities: Capabilities = Field(default_factory=Capabilities)
    required_variables: list[RequiredVariable] = Field(default_factory=list)
    scan: GraphScan = Field(default_factory=GraphScan)

    # Mini-app identity carried by the uploaded package (if any).
    app_id: str | None = None
    app_name: str | None = None

    status: ScriptVersionStatus = ScriptVersionStatus.PENDING_REVIEW
    moderation: Moderation = Field(default_factory=Moderation)
    released_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "script_versions"
        indexes = [
            pymongo.IndexModel(
                [("script_id", pymongo.ASCENDING), ("version", pymongo.ASCENDING)], unique=True
            ),
            pymongo.IndexModel([("script_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("status", pymongo.ASCENDING)]),
        ]
