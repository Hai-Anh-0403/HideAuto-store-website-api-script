"""Script routes: seller publishing (`/sellers/me/scripts`) + admin moderation."""

from typing import Annotated

from beanie import PydanticObjectId
from fastapi import APIRouter, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import ApprovedSeller, CurrentAdmin, Paginate, build_form_model
from app.core.config import settings
from app.core.enums import DownloadFormat, ScriptStatus
from app.core.exceptions import AppError, UnprocessableError
from app.models.script import Script
from app.models.script_version import ScriptVersion
from app.schemas.common import Page
from app.schemas.mini_app_build import BuildCreate, MiniAppBuildRead
from app.schemas.script import (
    ScriptCreate,
    ScriptDetailRead,
    ScriptInspect,
    ScriptRead,
    ScriptUpdate,
    ScriptVersionCreate,
    ScriptVersionRead,
    VersionReject,
)
from app.services import mini_app_service, script_service
from app.utils.ids import require_id

_TAG_IDS_DESCRIPTION = (
    "Filter by tag IDs (comma-separated). "
    "Scripts must have ALL listed tags."
)

router = APIRouter(tags=["scripts"])

_UPLOAD_DESCRIPTION = "Mini-app package (.zip/.exe) or an app.workflow / graph .json file"
_CHUNK_BYTES = 1024 * 1024


async def _read_upload(file: UploadFile) -> bytes:
    """Read the whole upload, refusing anything over the configured limit."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_CHUNK_BYTES):
        total += len(chunk)
        if total > settings.max_upload_bytes:
            raise AppError(
                f"Upload exceeds the {settings.max_upload_bytes} byte limit", status_code=413
            )
        chunks.append(chunk)
    if total == 0:
        raise UnprocessableError("Upload is empty")
    return b"".join(chunks)


def _detail(script: Script, versions: list[ScriptVersion]) -> ScriptDetailRead:
    detail = ScriptDetailRead.model_validate(script)
    detail.versions = [ScriptVersionRead.model_validate(v) for v in versions]
    return detail


def _page(scripts: list[Script], total: int, skip: int, limit: int) -> Page[ScriptRead]:
    return Page(
        items=[ScriptRead.model_validate(s) for s in scripts],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/sellers/me/scripts/inspect",
    response_model=ScriptInspect,
    summary="Preview what the store derives from a package (nothing is saved)",
)
async def inspect_script(
    _seller: ApprovedSeller,
    file: Annotated[UploadFile, File(description=_UPLOAD_DESCRIPTION)],
) -> ScriptInspect:
    content = await _read_upload(file)
    return await script_service.inspect_upload(content, file.filename or "upload.bin")


@router.post(
    "/sellers/me/scripts",
    response_model=ScriptRead,
    status_code=status.HTTP_201_CREATED,
    summary="Publish a script (upload → scrub → derive → draft)",
)
async def create_script(
    seller: ApprovedSeller,
    file: Annotated[UploadFile, File(description=_UPLOAD_DESCRIPTION)],
    # Omit to use the mini app's own name from the package.
    name: Annotated[str | None, Form()] = None,
    version: Annotated[str, Form()] = "1.0.0",
    short_description: Annotated[str | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
    changelog: Annotated[str | None, Form()] = None,
    min_app_version: Annotated[str | None, Form()] = None,
    tested_app_version: Annotated[str | None, Form()] = None,
    # Comma-separated tag ObjectIds.
    tag_ids: Annotated[str | None, Form()] = None,
    # false = park it as a draft the seller publishes once the listing is filled in.
    publish: Annotated[bool, Form()] = True,
) -> ScriptRead:
    parsed_tags = (
        [PydanticObjectId(t.strip()) for t in tag_ids.split(",") if t.strip()]
        if tag_ids
        else []
    )
    payload = build_form_model(
        ScriptCreate,
        name=name,
        version=version,
        short_description=short_description,
        description=description,
        changelog=changelog,
        min_app_version=min_app_version,
        tested_app_version=tested_app_version,
        tag_ids=parsed_tags,
        publish=publish,
    )
    content = await _read_upload(file)
    script = await script_service.create_script(
        seller, payload, content=content, filename=file.filename or "upload.bin"
    )
    return ScriptRead.model_validate(script)


@router.get("/sellers/me/scripts", response_model=Page[ScriptRead])
async def list_my_scripts(
    seller: ApprovedSeller,
    page: Paginate,
    script_status: ScriptStatus | None = None,
) -> Page[ScriptRead]:
    scripts, total = await script_service.list_seller_scripts(
        seller, status=script_status, skip=page.skip, limit=page.limit
    )
    return _page(scripts, total, page.skip, page.limit)


@router.get("/sellers/me/scripts/{script_id}", response_model=ScriptDetailRead)
async def get_my_script(script_id: PydanticObjectId, seller: ApprovedSeller) -> ScriptDetailRead:
    script, versions = await script_service.get_seller_script(seller, script_id)
    return _detail(script, versions)


@router.post(
    "/sellers/me/scripts/{script_id}/versions",
    response_model=ScriptVersionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a new version (re-scanned and re-reviewed)",
)
async def add_version(
    script_id: PydanticObjectId,
    seller: ApprovedSeller,
    file: Annotated[UploadFile, File(description=_UPLOAD_DESCRIPTION)],
    version: Annotated[str, Form()],
    changelog: Annotated[str | None, Form()] = None,
    min_app_version: Annotated[str | None, Form()] = None,
    tested_app_version: Annotated[str | None, Form()] = None,
) -> ScriptVersionRead:
    payload = build_form_model(
        ScriptVersionCreate,
        version=version,
        changelog=changelog,
        min_app_version=min_app_version,
        tested_app_version=tested_app_version,
    )
    content = await _read_upload(file)
    created = await script_service.add_version(
        seller, script_id, payload, content=content, filename=file.filename or "upload.bin"
    )
    return ScriptVersionRead.model_validate(created)


@router.patch(
    "/sellers/me/scripts/{script_id}",
    response_model=ScriptRead,
    summary="Edit the listing text (slug and derived metadata stay put)",
)
async def update_script(
    script_id: PydanticObjectId, seller: ApprovedSeller, payload: ScriptUpdate
) -> ScriptRead:
    script = await script_service.update_script(seller, script_id, payload)
    return ScriptRead.model_validate(script)


@router.post(
    "/sellers/me/scripts/{script_id}/publish",
    response_model=ScriptRead,
    summary="Put my own draft on the store",
)
async def publish_my_script(script_id: PydanticObjectId, seller: ApprovedSeller) -> ScriptRead:
    script = await script_service.publish_own(seller, script_id)
    return ScriptRead.model_validate(script)


@router.delete(
    "/sellers/me/scripts/{script_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Discard a draft (published listings cannot be deleted)",
)
async def delete_my_script(script_id: PydanticObjectId, seller: ApprovedSeller) -> None:
    await script_service.delete_draft(seller, script_id)


@router.post("/sellers/me/scripts/{script_id}/submit", response_model=ScriptRead)
async def submit_for_review(script_id: PydanticObjectId, seller: ApprovedSeller) -> ScriptRead:
    script = await script_service.submit_for_review(seller, script_id)
    return ScriptRead.model_validate(script)


@router.post(
    "/sellers/me/scripts/{script_id}/archive",
    response_model=ScriptRead,
    summary="Take the listing off the store",
)
async def archive_script(script_id: PydanticObjectId, seller: ApprovedSeller) -> ScriptRead:
    script = await script_service.set_archived(seller, script_id, True)
    return ScriptRead.model_validate(script)


@router.post("/sellers/me/scripts/{script_id}/unarchive", response_model=ScriptRead)
async def unarchive_script(script_id: PydanticObjectId, seller: ApprovedSeller) -> ScriptRead:
    script = await script_service.set_archived(seller, script_id, False)
    return ScriptRead.model_validate(script)


@router.post(
    "/sellers/me/scripts/{script_id}/mini-app-builds",
    response_model=MiniAppBuildRead,
    status_code=status.HTTP_201_CREATED,
    summary="Repackage an approved version as a downloadable mini app (.zip)",
)
async def create_mini_app_build(
    script_id: PydanticObjectId, seller: ApprovedSeller, payload: BuildCreate | None = None
) -> MiniAppBuildRead:
    build = await mini_app_service.create_build(
        seller, script_id, payload.version_id if payload else None
    )
    return MiniAppBuildRead.model_validate(build)


@router.get(
    "/sellers/me/scripts/{script_id}/mini-app-builds", response_model=list[MiniAppBuildRead]
)
async def list_mini_app_builds(
    script_id: PydanticObjectId, seller: ApprovedSeller
) -> list[MiniAppBuildRead]:
    builds = await mini_app_service.list_builds(seller, script_id)
    return [MiniAppBuildRead.model_validate(b) for b in builds]


@router.get(
    "/sellers/me/scripts/{script_id}/download",
    response_class=FileResponse,
    summary="Download your own packaged mini app (.zip) — the graph is not served here",
)
async def seller_download(
    script_id: PydanticObjectId,
    seller: ApprovedSeller,
    format: DownloadFormat = DownloadFormat.EXE,
    version_id: PydanticObjectId | None = None,
) -> FileResponse:
    target = await mini_app_service.seller_download(seller, script_id, format, version_id)
    return FileResponse(target.path, filename=target.filename, media_type=target.media_type)


@router.get("/admin/scripts", response_model=Page[ScriptRead])
async def admin_list_scripts(
    _admin: CurrentAdmin,
    page: Paginate,
    script_status: ScriptStatus | None = None,
) -> Page[ScriptRead]:
    scripts, total = await script_service.list_scripts(
        status=script_status, skip=page.skip, limit=page.limit
    )
    return _page(scripts, total, page.skip, page.limit)


@router.get("/admin/scripts/{script_id}", response_model=ScriptDetailRead)
async def admin_get_script(script_id: PydanticObjectId, _admin: CurrentAdmin) -> ScriptDetailRead:
    script, versions = await script_service.get_script(script_id)
    return _detail(script, versions)


@router.post(
    "/admin/scripts/{script_id}/versions/{version_id}/approve",
    response_model=ScriptVersionRead,
    summary="Approve a version → publish the script",
)
async def admin_approve_version(
    script_id: PydanticObjectId, version_id: PydanticObjectId, admin: CurrentAdmin
) -> ScriptVersionRead:
    version = await script_service.approve_version(require_id(admin.id), script_id, version_id)
    return ScriptVersionRead.model_validate(version)


@router.post(
    "/admin/scripts/{script_id}/versions/{version_id}/reject",
    response_model=ScriptVersionRead,
)
async def admin_reject_version(
    script_id: PydanticObjectId,
    version_id: PydanticObjectId,
    admin: CurrentAdmin,
    payload: VersionReject,
) -> ScriptVersionRead:
    version = await script_service.reject_version(
        require_id(admin.id), script_id, version_id, payload.reason
    )
    return ScriptVersionRead.model_validate(version)


# ── Public store catalog ─────────────────────────────────────────────


@router.get(
    "/store/scripts",
    response_model=Page[ScriptRead],
    summary="Browse published scripts, optionally filtered by tags and search text",
)
async def browse_store(
    page: Paginate,
    q: str | None = None,
    tag_ids: Annotated[str | None, Query(description=_TAG_IDS_DESCRIPTION)] = None,
) -> Page[ScriptRead]:
    parsed_tags: list[PydanticObjectId] | None = None
    if tag_ids:
        parsed_tags = [PydanticObjectId(t.strip()) for t in tag_ids.split(",") if t.strip()]
    scripts, total = await script_service.browse_catalog(
        tag_ids=parsed_tags, q=q, skip=page.skip, limit=page.limit
    )
    return _page(scripts, total, page.skip, page.limit)


@router.get(
    "/store/scripts/{slug_or_id}",
    response_model=ScriptDetailRead,
    summary="Get a published script's detail by slug or ID",
)
async def store_script_detail(slug_or_id: str) -> ScriptDetailRead:
    from app.core.exceptions import NotFoundError
    from app.repositories import script as script_repo
    from app.repositories import script_version as version_repo

    script: Script | None = None
    try:
        oid = PydanticObjectId(slug_or_id)
        script = await script_repo.get_by_id(oid)
    except Exception:
        script = await script_repo.get_by_slug(slug_or_id)
    if script is None:
        raise NotFoundError("Script not found")
    versions = await version_repo.list_for_script(require_id(script.id))
    return _detail(script, versions)
