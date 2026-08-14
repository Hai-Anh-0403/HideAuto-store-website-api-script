"""Script listing DB access."""

from typing import Any

from beanie import PydanticObjectId

from app.core.enums import ScriptStatus
from app.models.script import Script


async def insert(script: Script) -> Script:
    return await script.insert()


async def get_by_id(script_id: PydanticObjectId) -> Script | None:
    return await Script.get(script_id)


async def get_by_slug(slug: str) -> Script | None:
    return await Script.find_one(Script.slug == slug)


async def get_by_seller_and_name(seller_id: PydanticObjectId, name: str) -> Script | None:
    return await Script.find_one({"seller.id": seller_id, "name": name})


async def list_for_seller(
    seller_id: PydanticObjectId,
    *,
    status: ScriptStatus | None,
    skip: int,
    limit: int,
) -> tuple[list[Script], int]:
    query: dict[str, Any] = {"seller.id": seller_id}
    if status is not None:
        query["status"] = status.value
    total = await Script.find(query).count()
    items = await Script.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, total


async def list_published_for_seller(seller_id: PydanticObjectId) -> list[Script]:
    return await Script.find(
        {"seller.id": seller_id, "status": ScriptStatus.PUBLISHED.value}
    ).to_list()


async def list_all(
    *,
    status: ScriptStatus | None,
    skip: int,
    limit: int,
) -> tuple[list[Script], int]:
    query: dict[str, Any] = {}
    if status is not None:
        query["status"] = status.value
    total = await Script.find(query).count()
    items = await Script.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, total
