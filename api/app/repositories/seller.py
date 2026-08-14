"""Seller DB access."""

from beanie import PydanticObjectId

from app.core.enums import SellerStatus
from app.models.seller import Seller


async def get_by_email(email: str) -> Seller | None:
    return await Seller.find_one(Seller.email == email)


async def get_by_id(seller_id: PydanticObjectId) -> Seller | None:
    return await Seller.get(seller_id)


async def insert(seller: Seller) -> Seller:
    return await seller.insert()


async def list_sellers(
    *, status: SellerStatus | None, skip: int, limit: int
) -> tuple[list[Seller], int]:
    query = Seller.find(Seller.status == status) if status is not None else Seller.find_all()
    total = await query.count()
    items = await query.sort("-created_at").skip(skip).limit(limit).to_list()
    return items, total
