"""Register stored artifacts in the `uploads` collection.

Every file the store keeps goes through here, so storage layout and the DB record stay
in one place. `status` is set by the caller: only files the store produced itself (a
scrubbed graph, a build it made) may be marked `clean`.
"""

from datetime import UTC, datetime

from beanie import PydanticObjectId

from app.core.enums import UploadKind, UploadStatus
from app.models.upload import Upload, UploadLink, UploadScan
from app.repositories import upload as upload_repo
from app.services import storage_service


async def register(
    *,
    owner_id: PydanticObjectId,
    kind: UploadKind,
    subdir: str,
    filename: str,
    mime_type: str,
    content: bytes,
    status: UploadStatus,
    note: str,
) -> Upload:
    stored = await storage_service.save_bytes(content, subdir=subdir, filename=filename)
    upload = Upload(
        owner_id=owner_id,
        kind=kind,
        ref=stored.ref,
        filename=filename,
        mime_type=mime_type,
        size_bytes=stored.size_bytes,
        checksum=stored.checksum,
        status=status,
        scan=UploadScan(scanned_at=datetime.now(UTC), result=status.value, note=note),
    )
    return await upload_repo.insert(upload)


async def link(upload: Upload, *, type: str, id: PydanticObjectId) -> None:
    upload.linked_to = UploadLink(type=type, id=id)
    upload.updated_at = datetime.now(UTC)
    await upload.save()
