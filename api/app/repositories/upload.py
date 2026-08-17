"""Upload registry DB access."""

from beanie import PydanticObjectId

from app.models.upload import Upload


async def insert(upload: Upload) -> Upload:
    return await upload.insert()


async def get_by_id(upload_id: PydanticObjectId) -> Upload | None:
    return await Upload.get(upload_id)


async def delete_by_id(upload_id: PydanticObjectId) -> None:
    """Drop the registry row. The blob itself is content-addressed and may be shared,
    so it stays on disk for a storage sweep to collect."""
    upload = await Upload.get(upload_id)
    if upload is not None:
        await upload.delete()
