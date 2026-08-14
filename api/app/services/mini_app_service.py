"""Repackage an approved version into a mini app, and serve downloads.

The store keeps only the small scrubbed graph; the `.zip` a buyer downloads is rebuilt on
demand from an empty mini-app template. See `docs/script-publish-packaging.md` §4.
"""

import asyncio
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.enums import (
    BuildStatus,
    DownloadFormat,
    ScriptStatus,
    ScriptVersionStatus,
    UploadKind,
    UploadStatus,
)
from app.core.exceptions import AppError, ConflictError, ForbiddenError, NotFoundError
from app.models.mini_app_build import MiniAppBuild
from app.models.script import Script
from app.models.script_version import ScriptVersion
from app.models.seller import Seller
from app.repositories import mini_app_build as build_repo
from app.repositories import script as script_repo
from app.repositories import script_version as version_repo
from app.repositories import seller_member as member_repo
from app.repositories import upload as upload_repo
from app.services import key_service, storage_service, upload_service
from app.utils.ids import require_id
from app.utils.mini_app_builder import build_envelope, inject_workflow

logger = logging.getLogger(__name__)


class DownloadTarget:
    """A file ready to stream back, with the name the buyer should see."""

    def __init__(self, path: Path, filename: str, media_type: str) -> None:
        self.path = path
        self.filename = filename
        self.media_type = media_type


async def _owned_script(seller_id: PydanticObjectId, script_id: PydanticObjectId) -> Script:
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    if script.seller.id != seller_id:
        raise ForbiddenError("Not your script")
    return script


async def _buildable_version(script: Script, version_id: PydanticObjectId | None) -> ScriptVersion:
    """The version to package: an explicit approved one, or the live one."""
    if version_id is not None:
        version = await version_repo.get_by_id(version_id)
        if version is None or version.script_id != script.id:
            raise NotFoundError("Version not found")
    else:
        if script.latest_version_id is None:
            raise ConflictError("Script has no version yet")
        version = await version_repo.get_by_id(script.latest_version_id)
        if version is None:
            raise NotFoundError("Version not found")
    if version.status != ScriptVersionStatus.APPROVED:
        raise ConflictError("Only an approved version can be packaged", code="version_not_approved")
    return version


def _read_template_sync(path_str: str) -> bytes:
    path = Path(path_str)
    if not path.is_file():
        raise AppError(
            f"Mini-app template not found at {path_str} — set MINI_APP_TEMPLATE_PATH",
            status_code=503,
            code="template_missing",
        )
    return path.read_bytes()


async def _load_template() -> bytes:
    if not settings.mini_app_template_path:
        raise AppError(
            "Mini-app packaging is not configured on this server (MINI_APP_TEMPLATE_PATH)",
            status_code=503,
            code="template_missing",
        )
    return await asyncio.to_thread(_read_template_sync, settings.mini_app_template_path)


async def _load_graph(version: ScriptVersion) -> dict[str, Any]:
    upload = await upload_repo.get_by_id(version.file_id)
    if upload is None:
        raise NotFoundError("Stored graph for this version is missing")
    raw = await storage_service.read_bytes(upload.ref)
    parsed: dict[str, Any] = json.loads(raw.decode("utf-8"))
    return parsed


async def create_build(
    seller: Seller, script_id: PydanticObjectId, version_id: PydanticObjectId | None = None
) -> MiniAppBuild:
    """Package an approved version as a downloadable mini app (server template inject)."""
    seller_id = require_id(seller.id)
    script = await _owned_script(seller_id, script_id)
    version = await _buildable_version(script, version_id)

    template = await _load_template()
    graph = await _load_graph(version)
    app_id = version.app_id or f"com.hideflow.mini.{script.slug}"
    envelope = build_envelope(
        app_name=version.app_name or script.name,
        app_id=app_id,
        workflow_id=str(require_id(version.id)),
        workflow_name=script.name,
        graph=graph,
    )
    package = await asyncio.to_thread(inject_workflow, template, envelope)

    filename = f"{script.slug}-{version.version}-win-x64.zip"
    upload = await upload_service.register(
        owner_id=seller_id,
        kind=UploadKind.MINI_APP_BUILD,
        subdir="mini-app-build",
        filename=filename,
        mime_type="application/zip",
        content=package,
        status=UploadStatus.CLEAN,
        note="repackaged by the store from the scrubbed graph",
    )

    build = MiniAppBuild(
        script_id=require_id(script.id),
        script_version_id=require_id(version.id),
        app_id=app_id,
        app_name=envelope["appName"],
        app_version=version.version,
        file_id=require_id(upload.id),
        size_bytes=upload.size_bytes,
        checksum=upload.checksum,
        status=BuildStatus.READY,
        built_at=datetime.now(UTC),
    )
    try:
        created = await build_repo.insert(build)
    except DuplicateKeyError as exc:
        raise ConflictError(
            f"A win/x64 build of {version.version} already exists for this script",
            code="build_exists",
        ) from exc

    await upload_service.link(upload, type="mini_app_build", id=require_id(created.id))
    if not script.has_mini_app:
        script.has_mini_app = True
        script.updated_at = datetime.now(UTC)
        await script.save()
    return created


async def list_builds(seller: Seller, script_id: PydanticObjectId) -> list[MiniAppBuild]:
    script = await _owned_script(require_id(seller.id), script_id)
    return await build_repo.list_for_script(require_id(script.id))


def _target(ref: str, filename: str, media_type: str) -> DownloadTarget:
    """Resolve a stored ref, refusing early if the bytes are gone.

    Without this the response streams a missing path and blows up as a 500; a storage
    root that no longer matches the database is a real (if rare) operational state.
    """
    path = storage_service.path_for(ref)
    if not path.is_file():
        raise AppError(
            f"Artifact {filename} is no longer in storage",
            status_code=410,
            code="artifact_missing",
        )
    return DownloadTarget(path=path, filename=filename, media_type=media_type)


async def _download_for_version(
    script: Script, version: ScriptVersion, fmt: DownloadFormat
) -> DownloadTarget:
    if fmt == DownloadFormat.GRAPH:
        upload = await upload_repo.get_by_id(version.file_id)
        if upload is None:
            raise NotFoundError("Stored graph for this version is missing")
        return _target(upload.ref, f"{script.slug}-{version.version}.json", "application/json")

    build = await build_repo.get_ready_for_version(require_id(version.id))
    if build is None:
        raise ConflictError(
            "No mini-app package for this version yet — build it first", code="no_build_yet"
        )
    upload = await upload_repo.get_by_id(build.file_id)
    if upload is None:
        raise NotFoundError("Stored build is missing")
    return _target(upload.ref, upload.filename, "application/zip")


async def seller_download(
    seller: Seller,
    script_id: PydanticObjectId,
    fmt: DownloadFormat,
    version_id: PydanticObjectId | None = None,
) -> DownloadTarget:
    """A seller may always pull their own artifacts, published or not."""
    script = await _owned_script(require_id(seller.id), script_id)
    if version_id is not None:
        version = await version_repo.get_by_id(version_id)
        if version is None or version.script_id != script.id:
            raise NotFoundError("Version not found")
    else:
        versions = await version_repo.list_for_script(require_id(script.id))
        if not versions:
            raise ConflictError("Script has no version yet")
        approved = [v for v in versions if v.status == ScriptVersionStatus.APPROVED]
        version = approved[0] if approved else versions[0]
    return await _download_for_version(script, version, fmt)


async def list_entitled_scripts(user_id: str) -> list[Script]:
    """Every published script this end-user unlocked with a key."""
    memberships = await member_repo.list_by_user(user_id)
    scripts: list[Script] = []
    for member in memberships:
        for script in await script_repo.list_published_for_seller(member.seller_id):
            if key_service.is_entitled(member, require_id(script.id)) and not any(
                s.id == script.id for s in scripts
            ):
                scripts.append(script)
    return scripts


async def buyer_download(
    user_id: str, script_id: PydanticObjectId, fmt: DownloadFormat
) -> DownloadTarget:
    """Serve the published version to an end-user who redeemed a key for it."""
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    if script.status != ScriptStatus.PUBLISHED or script.latest_version_id is None:
        raise NotFoundError("Script is not published")

    member = await member_repo.get(script.seller.id, user_id)
    if member is None or not key_service.is_entitled(member, require_id(script.id)):
        raise ForbiddenError("You have not unlocked this mini app", code="not_entitled")

    version = await version_repo.get_by_id(script.latest_version_id)
    if version is None:
        raise NotFoundError("Published version is missing")

    target = await _download_for_version(script, version, fmt)
    script.stats.downloads += 1
    await script.save()
    return target
