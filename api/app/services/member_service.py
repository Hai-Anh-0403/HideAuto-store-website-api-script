"""Seller-facing member logic: list users, read usage, block user or a single device."""

from beanie import PydanticObjectId

from app.core.enums import MemberStatus
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.seller_member import SellerMember
from app.repositories import seller_member as member_repo
from app.schemas.seller_member import MemberUsage
from app.services.usage_service import usage_from_member


async def list_members(
    seller_id: PydanticObjectId, *, skip: int, limit: int
) -> tuple[list[SellerMember], int]:
    return await member_repo.list_for_seller(seller_id, skip=skip, limit=limit)


async def _owned(seller_id: PydanticObjectId, member_id: PydanticObjectId) -> SellerMember:
    member = await member_repo.get_by_id(member_id)
    if member is None:
        raise NotFoundError("Member not found")
    if member.seller_id != seller_id:
        raise ForbiddenError("Not your member")
    return member


async def get_member_usage(seller_id: PydanticObjectId, member_id: PydanticObjectId) -> MemberUsage:
    """Return the member's cached usage (last synced from flowdesk via the app)."""
    return usage_from_member(await _owned(seller_id, member_id))


async def set_member_status(
    seller_id: PydanticObjectId, member_id: PydanticObjectId, status: MemberStatus
) -> SellerMember:
    member = await _owned(seller_id, member_id)
    member.status = status
    await member.save()
    return member


async def set_device_blocked(
    seller_id: PydanticObjectId, member_id: PydanticObjectId, machine_id: str, blocked: bool
) -> SellerMember:
    member = await _owned(seller_id, member_id)
    _apply_device_block(member, machine_id, blocked)
    await member.save()
    return member


def _apply_device_block(member: SellerMember, machine_id: str, blocked: bool) -> None:
    current = set(member.blocked_devices)
    if blocked:
        current.add(machine_id)
    else:
        current.discard(machine_id)
    member.blocked_devices = sorted(current)
