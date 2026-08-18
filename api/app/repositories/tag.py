"""Tag DB access."""

from beanie import PydanticObjectId

from app.models.tag import Tag


async def insert(tag: Tag) -> Tag:
    return await tag.insert()


async def get_by_id(tag_id: PydanticObjectId) -> Tag | None:
    return await Tag.get(tag_id)


async def get_by_slug(slug: str) -> Tag | None:
    return await Tag.find_one(Tag.slug == slug)


async def get_by_ids(ids: list[PydanticObjectId]) -> list[Tag]:
    if not ids:
        return []
    return await Tag.find({"_id": {"$in": ids}}).to_list()


async def list_all() -> list[Tag]:
    return await Tag.find().sort("name").to_list()


async def delete(tag: Tag) -> None:
    await tag.delete()
