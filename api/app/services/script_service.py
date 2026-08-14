"""Script publish pipeline: extract → scrub → derive → version → moderate.

An upload is untrusted every single time: the graph is pulled out of the package, every
embedded secret is blanked before anything is written to storage, and all listing
metadata (node count, capabilities, required variables) is derived from the graph rather
than taken from the seller. A version with secrets still in it cannot be approved.
"""

import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from beanie import PydanticObjectId
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from app.core.enums import (
    ScriptStatus,
    ScriptVersionStatus,
    UploadKind,
    UploadStatus,
)
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.script import Script, SellerRef
from app.models.script_version import ScriptVersion
from app.models.seller import Seller
from app.repositories import script as script_repo
from app.repositories import script_version as version_repo
from app.schemas.script import ScriptCreate, ScriptInspect, ScriptUpdate, ScriptVersionCreate
from app.services import upload_service
from app.utils.ids import require_id, slugify
from app.utils.mini_app_package import ExtractedPackage, extract_package
from app.utils.workflow_graph import (
    GraphMetadata,
    ScrubResult,
    derive_metadata,
    scrub_credentials,
)

logger = logging.getLogger(__name__)

_MAX_SLUG_ATTEMPTS = 50
_SUBMITTABLE = (ScriptStatus.DRAFT, ScriptStatus.REJECTED)


async def _unique_slug(name: str) -> str:
    base = slugify(name)
    for attempt in range(1, _MAX_SLUG_ATTEMPTS + 1):
        candidate = base if attempt == 1 else f"{base}-{attempt}"
        if await script_repo.get_by_slug(candidate) is None:
            return candidate
    raise ConflictError("Could not derive a unique slug for this name")


async def _owned_script(seller_id: PydanticObjectId, script_id: PydanticObjectId) -> Script:
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    if script.seller.id != seller_id:
        raise ForbiddenError("Not your script")
    return script


class _PreparedUpload(BaseModel):
    """A parsed, scrubbed, fully-derived upload — everything ready to persist."""

    package: ExtractedPackage
    scrubbed: ScrubResult
    derived: GraphMetadata
    graph_bytes: bytes
    source_filename: str
    source_checksum: str


def _prepare_upload_sync(content: bytes, filename: str) -> _PreparedUpload:
    package = extract_package(content, filename)
    scrubbed = scrub_credentials(package.graph)
    return _PreparedUpload(
        package=package,
        scrubbed=scrubbed,
        derived=derive_metadata(scrubbed.graph),
        graph_bytes=json.dumps(scrubbed.graph, ensure_ascii=False).encode("utf-8"),
        source_filename=filename,
        source_checksum=hashlib.sha256(content).hexdigest(),
    )


async def prepare_upload(content: bytes, filename: str) -> _PreparedUpload:
    """Unpack + scrub + derive off the event loop — it's all CPU work on a big blob.

    Runs before anything is written, so a bad upload never leaves a half-created script.
    """
    return await asyncio.to_thread(_prepare_upload_sync, content, filename)


async def _create_version(
    *,
    script: Script,
    seller_id: PydanticObjectId,
    prepared: _PreparedUpload,
    meta: ScriptVersionCreate,
) -> ScriptVersion:
    package = prepared.package
    scrubbed = prepared.scrubbed
    derived = prepared.derived
    script_id = require_id(script.id)

    graph_upload = await upload_service.register(
        owner_id=seller_id,
        kind=UploadKind.WORKFLOW_GRAPH,
        subdir="workflow-graph",
        filename=f"{script.slug}-{meta.version}.json",
        mime_type="application/json",
        content=prepared.graph_bytes,
        status=UploadStatus.CLEAN,
        note="graph parsed and credential-scrubbed",
    )

    version = ScriptVersion(
        script_id=script_id,
        version=meta.version,
        changelog=meta.changelog,
        file_id=require_id(graph_upload.id),
        source_filename=prepared.source_filename,
        source_checksum=prepared.source_checksum,
        delivery=package.delivery,
        min_app_version=meta.min_app_version,
        tested_app_version=meta.tested_app_version,
        node_count=derived.node_count,
        node_groups_used=derived.node_groups_used,
        uses_control_flow=derived.uses_control_flow,
        sub_workflow_ids=derived.sub_workflow_ids,
        capabilities=derived.capabilities,
        required_variables=derived.required_variables,
        scan=scrubbed.scan,
        app_id=package.app_id,
        app_name=package.app_name,
    )
    version.moderation.scanned_at = datetime.now(UTC)

    try:
        created = await version_repo.insert(version)
    except DuplicateKeyError as exc:
        raise ConflictError(
            f"Version {meta.version} already exists for this script", code="version_exists"
        ) from exc

    await upload_service.link(graph_upload, type="script_version", id=require_id(created.id))

    if scrubbed.scan.embedded_credentials_count:
        logger.warning(
            "script %s version %s uploaded with %d embedded credential(s)",
            script_id,
            meta.version,
            scrubbed.scan.embedded_credentials_count,
        )
    return created


def _suggested_name(prepared: _PreparedUpload) -> str:
    """The mini app's own name, falling back to the uploaded file name."""
    package = prepared.package
    return package.app_name or package.workflow_name or Path(prepared.source_filename).stem


async def inspect_upload(content: bytes, filename: str) -> ScriptInspect:
    """Parse an upload and report what the store derived — nothing is persisted."""
    prepared = await prepare_upload(content, filename)
    derived = prepared.derived
    return ScriptInspect(
        suggested_name=_suggested_name(prepared),
        app_name=prepared.package.app_name,
        app_id=prepared.package.app_id,
        workflow_name=prepared.package.workflow_name,
        delivery=prepared.package.delivery,
        node_count=derived.node_count,
        node_groups_used=derived.node_groups_used,
        uses_control_flow=derived.uses_control_flow,
        sub_workflow_ids=derived.sub_workflow_ids,
        capabilities=derived.capabilities,
        required_variables=derived.required_variables,
        scan=prepared.scrubbed.scan,
    )


async def create_script(
    seller: Seller, data: ScriptCreate, *, content: bytes, filename: str
) -> Script:
    """Create a draft listing from the seller's first upload."""
    seller_id = require_id(seller.id)
    # Parse first: a rejected upload must not leave an empty draft holding a slug.
    prepared = await prepare_upload(content, filename)
    name = data.name or _suggested_name(prepared)

    script = Script(
        slug=await _unique_slug(name),
        name=name,
        short_description=data.short_description,
        description=data.description,
        seller=SellerRef(id=seller_id, name=seller.name),
    )
    created = await script_repo.insert(script)

    version = await _create_version(
        script=created,
        seller_id=seller_id,
        prepared=prepared,
        meta=ScriptVersionCreate(
            version=data.version,
            changelog=data.changelog,
            min_app_version=data.min_app_version,
            tested_app_version=data.tested_app_version,
        ),
    )
    # Nothing is published yet, so showing the pending version's derived numbers on the
    # draft is safe. Once a version is live, only an approval may change these.
    _copy_denormalized(created, version)
    created.updated_at = datetime.now(UTC)
    await created.save()
    return created


async def add_version(
    seller: Seller,
    script_id: PydanticObjectId,
    data: ScriptVersionCreate,
    *,
    content: bytes,
    filename: str,
) -> ScriptVersion:
    """Upload a new build of an existing script — re-scanned and re-reviewed."""
    seller_id = require_id(seller.id)
    script = await _owned_script(seller_id, script_id)
    prepared = await prepare_upload(content, filename)
    version = await _create_version(
        script=script, seller_id=seller_id, prepared=prepared, meta=data
    )
    if script.latest_version_id is None:
        _copy_denormalized(script, version)
    if script.status == ScriptStatus.REJECTED:
        script.status = ScriptStatus.DRAFT
        script.reject_reason = None
    script.updated_at = datetime.now(UTC)
    await script.save()
    return version


async def update_script(seller: Seller, script_id: PydanticObjectId, data: ScriptUpdate) -> Script:
    """Edit the listing text. The slug stays fixed — it is the public URL of the app."""
    script = await _owned_script(require_id(seller.id), script_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(script, field, value)
    if changes:
        script.updated_at = datetime.now(UTC)
        await script.save()
    return script


async def set_archived(seller: Seller, script_id: PydanticObjectId, archived: bool) -> Script:
    """Take a listing off the store, or put it back where it was.

    Restoring returns to `published` only if an approved version is still pointed at;
    otherwise it lands back in `draft` so it has to go through review again.
    """
    script = await _owned_script(require_id(seller.id), script_id)
    if archived:
        if script.status == ScriptStatus.ARCHIVED:
            raise ConflictError("Script is already archived", code="already_archived")
        script.status = ScriptStatus.ARCHIVED
    else:
        if script.status != ScriptStatus.ARCHIVED:
            raise ConflictError("Script is not archived", code="not_archived")
        approved = await _approved_version(require_id(script.id))
        script.status = ScriptStatus.PUBLISHED if approved else ScriptStatus.DRAFT
    script.updated_at = datetime.now(UTC)
    await script.save()
    return script


async def _approved_version(script_id: PydanticObjectId) -> ScriptVersion | None:
    versions = await version_repo.list_for_script(script_id)
    return next((v for v in versions if v.status == ScriptVersionStatus.APPROVED), None)


async def submit_for_review(seller: Seller, script_id: PydanticObjectId) -> Script:
    script = await _owned_script(require_id(seller.id), script_id)
    if script.status not in _SUBMITTABLE:
        raise ConflictError(
            f"Script cannot be submitted (status={script.status.value})", code="not_submittable"
        )
    if not await _has_pending_version(require_id(script.id)):
        raise ConflictError(
            "No pending version to review — upload one first", code="no_pending_version"
        )
    script.status = ScriptStatus.PENDING_REVIEW
    script.reject_reason = None
    script.updated_at = datetime.now(UTC)
    await script.save()
    return script


async def _has_pending_version(script_id: PydanticObjectId) -> bool:
    versions = await version_repo.list_for_script(script_id)
    return any(v.status == ScriptVersionStatus.PENDING_REVIEW for v in versions)


async def list_seller_scripts(
    seller: Seller, *, status: ScriptStatus | None, skip: int, limit: int
) -> tuple[list[Script], int]:
    return await script_repo.list_for_seller(
        require_id(seller.id), status=status, skip=skip, limit=limit
    )


async def get_seller_script(
    seller: Seller, script_id: PydanticObjectId
) -> tuple[Script, list[ScriptVersion]]:
    script = await _owned_script(require_id(seller.id), script_id)
    return script, await version_repo.list_for_script(require_id(script.id))


async def list_scripts(
    *, status: ScriptStatus | None, skip: int, limit: int
) -> tuple[list[Script], int]:
    return await script_repo.list_all(status=status, skip=skip, limit=limit)


async def get_script(script_id: PydanticObjectId) -> tuple[Script, list[ScriptVersion]]:
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    return script, await version_repo.list_for_script(require_id(script.id))


async def _pending_version(
    script_id: PydanticObjectId, version_id: PydanticObjectId
) -> ScriptVersion:
    version = await version_repo.get_by_id(version_id)
    if version is None or version.script_id != script_id:
        raise NotFoundError("Version not found")
    if version.status != ScriptVersionStatus.PENDING_REVIEW:
        raise ConflictError(f"Version already {version.status.value}", code="version_decided")
    return version


def _copy_denormalized(script: Script, version: ScriptVersion) -> None:
    script.latest_version = version.version
    script.latest_version_id = version.id
    script.min_app_version = version.min_app_version
    script.node_count = version.node_count
    script.node_groups_used = version.node_groups_used
    script.capabilities = version.capabilities


async def approve_version(
    admin_id: PydanticObjectId, script_id: PydanticObjectId, version_id: PydanticObjectId
) -> ScriptVersion:
    """Publish a version — refused while the graph still carries secrets."""
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    version = await _pending_version(script_id, version_id)

    if version.scan.embedded_credentials_count > 0:
        raise ConflictError(
            f"Version still contains {version.scan.embedded_credentials_count} embedded "
            "credential(s); the seller must remove them and re-upload",
            code="credentials_present",
        )

    now = datetime.now(UTC)
    version.status = ScriptVersionStatus.APPROVED
    version.released_at = now
    version.moderation.reviewed_by = admin_id
    version.moderation.reviewed_at = now
    version.moderation.reason = None
    await version.save()

    _copy_denormalized(script, version)
    script.status = ScriptStatus.PUBLISHED
    script.reject_reason = None
    script.published_at = script.published_at or now
    script.updated_at = now
    await script.save()
    return version


async def reject_version(
    admin_id: PydanticObjectId,
    script_id: PydanticObjectId,
    version_id: PydanticObjectId,
    reason: str,
) -> ScriptVersion:
    """Reject a version; an already-published version keeps serving."""
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    version = await _pending_version(script_id, version_id)

    now = datetime.now(UTC)
    version.status = ScriptVersionStatus.REJECTED
    version.moderation.reviewed_by = admin_id
    version.moderation.reviewed_at = now
    version.moderation.reason = reason
    await version.save()

    if script.status != ScriptStatus.PUBLISHED:
        script.status = ScriptStatus.REJECTED
        script.reject_reason = reason
        script.updated_at = now
        await script.save()
    return version
