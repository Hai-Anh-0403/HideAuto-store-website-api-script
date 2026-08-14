"""Admin-facing user management: list/inspect all end-users (members) + block/unblock.

End-user identities live in flowdesk; the store knows the users who redeemed a seller
key (the `seller_members`). Admin manages those.
"""

from typing import Any

from beanie import PydanticObjectId

from app.core.enums import MemberStatus
from app.core.exceptions import NotFoundError
from app.models.seller_member import SellerMember
from app.repositories import seller_member as member_repo
from app.schemas.seller_member import MemberUsage
from app.services.member_service import _apply_device_block
from app.services.usage_service import usage_from_member


async def list_members(
    *,
    seller_id: PydanticObjectId | None,
    status: MemberStatus | None,
    q: str | None,
    skip: int,
    limit: int,
) -> tuple[list[SellerMember], int]:
    return await member_repo.list_all(
        seller_id=seller_id, status=status, q=q, skip=skip, limit=limit
    )


async def list_users(
    *, q: str | None, skip: int, limit: int
) -> tuple[list[dict[str, Any]], int]:
    return await member_repo.distinct_users(q=q, skip=skip, limit=limit)


async def get_member(member_id: PydanticObjectId) -> SellerMember:
    member = await member_repo.get_by_id(member_id)
    if member is None:
        raise NotFoundError("Member not found")
    return member


_get_or_404 = get_member


async def set_member_status(member_id: PydanticObjectId, status: MemberStatus) -> SellerMember:
    member = await _get_or_404(member_id)
    member.status = status
    await member.save()
    return member


async def set_device_blocked(
    member_id: PydanticObjectId, machine_id: str, blocked: bool
) -> SellerMember:
    member = await _get_or_404(member_id)
    _apply_device_block(member, machine_id, blocked)
    await member.save()
    return member


async def get_member_usage(member_id: PydanticObjectId) -> MemberUsage:
    return usage_from_member(await _get_or_404(member_id))
