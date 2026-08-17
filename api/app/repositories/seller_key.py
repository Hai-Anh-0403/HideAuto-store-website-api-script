"""Seller key DB access."""

from beanie import PydanticObjectId

from app.models.seller_key import SellerKey


async def get_by_key(key: str) -> SellerKey | None:
    return await SellerKey.find_one(SellerKey.key == key)


async def get_by_id(key_id: PydanticObjectId) -> SellerKey | None:
    return await SellerKey.get(key_id)


async def insert(key: SellerKey) -> SellerKey:
    return await key.insert()


async def list_for_seller(
    seller_id: PydanticObjectId, *, skip: int = 0, limit: int = 100
) -> tuple[list[SellerKey], int]:
    query = SellerKey.find(SellerKey.seller_id == seller_id)
    total = await query.count()
    items = await query.sort("-created_at").skip(skip).limit(limit).to_list()
    return items, total


async def list_for_script(
    seller_id: PydanticObjectId, script_id: PydanticObjectId
) -> list[SellerKey]:
    return await (
        SellerKey.find(SellerKey.seller_id == seller_id, SellerKey.script_id == script_id)
        .sort("-created_at")
        .to_list()
    )
