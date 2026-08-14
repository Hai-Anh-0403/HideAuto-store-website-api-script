"""Uploaded file registry — every artifact the store keeps a copy of.

Files are only linked into a version/build once `status == clean`.
"""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field

from app.core.enums import UploadKind, UploadStatus, UploadStorage


class UploadScan(BaseModel):
    scanned_at: datetime | None = None
    result: str | None = None
    note: str | None = None


class UploadLink(BaseModel):
    """Back-ref to whatever the file belongs to."""

    type: str  # script | script_version | mini_app_build
    id: PydanticObjectId


class Upload(Document):
    owner_id: PydanticObjectId  # seller who uploaded it
    kind: UploadKind
    storage: UploadStorage = UploadStorage.LOCAL
    ref: str  # storage-relative path / object key
    url: str | None = None
    filename: str
    mime_type: str
    size_bytes: int
    checksum: str | None = None
    status: UploadStatus = UploadStatus.PENDING_SCAN
    scan: UploadScan | None = None
    linked_to: UploadLink | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "uploads"
        indexes = [
            pymongo.IndexModel([("owner_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("kind", pymongo.ASCENDING)]),
            pymongo.IndexModel([("status", pymongo.ASCENDING)]),
            pymongo.IndexModel([("checksum", pymongo.ASCENDING)]),
            pymongo.IndexModel([("linked_to.id", pymongo.ASCENDING)]),
        ]
