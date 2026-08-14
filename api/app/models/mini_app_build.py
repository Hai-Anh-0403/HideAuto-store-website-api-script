"""A repackaged mini app: a template app folder with this version's graph injected."""

from datetime import UTC, datetime

import pymongo
from beanie import Document, PydanticObjectId
from pydantic import Field

from app.core.enums import BuildArch, BuildPlatform, BuildStatus, BuiltBy, InstallerFormat


class MiniAppBuild(Document):
    script_id: PydanticObjectId
    script_version_id: PydanticObjectId
    app_id: str
    app_name: str
    app_version: str
    platform: BuildPlatform = BuildPlatform.WIN
    arch: BuildArch = BuildArch.X64
    installer_format: InstallerFormat = InstallerFormat.ZIP
    file_id: PydanticObjectId  # → uploads
    icon_file_id: PydanticObjectId | None = None
    size_bytes: int = 0
    checksum: str | None = None
    status: BuildStatus = BuildStatus.BUILDING
    built_by: BuiltBy = BuiltBy.SERVER
    error: str | None = None
    built_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "mini_app_builds"
        indexes = [
            pymongo.IndexModel([("script_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("script_version_id", pymongo.ASCENDING)]),
            pymongo.IndexModel([("status", pymongo.ASCENDING)]),
            pymongo.IndexModel(
                [
                    ("script_version_id", pymongo.ASCENDING),
                    ("platform", pymongo.ASCENDING),
                    ("arch", pymongo.ASCENDING),
                    ("app_version", pymongo.ASCENDING),
                ],
                unique=True,
            ),
        ]
