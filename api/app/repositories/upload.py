"""Upload registry DB access."""

from beanie import PydanticObjectId

from app.models.upload import Upload


async def insert(upload: Upload) -> Upload:
    return await upload.insert()


async def get_by_id(upload_id: PydanticObjectId) -> Upload | None:
    return await Upload.get(upload_id)
