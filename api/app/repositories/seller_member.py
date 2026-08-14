"""Seller member DB access."""

from typing import Any

from beanie import PydanticObjectId

from app.core.enums import MemberStatus
from app.models.seller_member import SellerMember


async def get_by_id(member_id: PydanticObjectId) -> SellerMember | None:
    return await SellerMember.get(member_id)


async def get(seller_id: PydanticObjectId, user_id: str) -> SellerMember | None:
    return await SellerMember.find_one(
        SellerMember.seller_id == seller_id, SellerMember.user_id == user_id
    )


async def insert(member: SellerMember) -> SellerMember:
    return await member.insert()


async def list_for_seller(
    seller_id: PydanticObjectId, *, skip: int, limit: int
) -> tuple[list[SellerMember], int]:
    query = SellerMember.find(SellerMember.seller_id == seller_id)
    total = await query.count()
    items = await query.sort("-redeemed_at").skip(skip).limit(limit).to_list()
    return items, total


async def list_by_user(user_id: str) -> list[SellerMember]:
    return await SellerMember.find(SellerMember.user_id == user_id).to_list()


def _admin_filter(
    seller_id: PydanticObjectId | None, status: MemberStatus | None, q: str | None
) -> dict[str, Any]:
    criteria: dict[str, Any] = {}
    if seller_id is not None:
        criteria["seller_id"] = seller_id
    if status is not None:
        criteria["status"] = status.value
    if q:
        criteria["user_email"] = {"$regex": q, "$options": "i"}
    return criteria


async def list_all(
    *,
    seller_id: PydanticObjectId | None,
    status: MemberStatus | None,
    q: str | None,
    skip: int,
    limit: int,
) -> tuple[list[SellerMember], int]:
    criteria = _admin_filter(seller_id, status, q)
    query = SellerMember.find(criteria)
    total = await query.count()
    items = await query.sort("-redeemed_at").skip(skip).limit(limit).to_list()
    return items, total


async def distinct_users(
    *, q: str | None, skip: int, limit: int
) -> tuple[list[dict[str, Any]], int]:
    """Aggregate memberships into distinct end-users (by flowdesk user_id)."""
    match: dict[str, Any] = {}
    if q:
        match["user_email"] = {"$regex": q, "$options": "i"}
    group = {
        "$group": {
            "_id": "$user_id",
            "user_email": {"$first": "$user_email"},
            "user_name": {"$first": "$user_name"},
            "membership_count": {"$sum": 1},
            "last_seen_at": {"$max": "$last_seen_at"},
        }
    }
    pipeline: list[dict[str, Any]] = []
    if match:
        pipeline.append({"$match": match})
    pipeline.append(group)
    count_pipeline = [*pipeline, {"$count": "total"}]
    count_res = await SellerMember.aggregate(count_pipeline).to_list()
    total = int(count_res[0]["total"]) if count_res else 0

    pipeline.extend([{"$sort": {"last_seen_at": -1, "_id": 1}}, {"$skip": skip}, {"$limit": limit}])
    rows = await SellerMember.aggregate(pipeline).to_list()
    for r in rows:
        r["user_id"] = r.pop("_id")
    return rows, total
