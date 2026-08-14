"""Mini-app build DTOs."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict

from app.core.enums import BuildArch, BuildPlatform, BuildStatus, BuiltBy, InstallerFormat


class BuildCreate(BaseModel):
    """Which version to package. Omit to package the live one."""

    version_id: PydanticObjectId | None = None


class MiniAppBuildRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    script_id: PydanticObjectId
    script_version_id: PydanticObjectId
    app_id: str
    app_name: str
    app_version: str
    platform: BuildPlatform
    arch: BuildArch
    installer_format: InstallerFormat
    size_bytes: int
    checksum: str | None
    status: BuildStatus
    built_by: BuiltBy
    error: str | None
    built_at: datetime | None
    created_at: datetime
