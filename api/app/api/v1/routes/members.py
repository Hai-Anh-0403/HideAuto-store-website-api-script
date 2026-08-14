"""Seller routes: list users, read usage, block a user or a single device."""

from beanie import PydanticObjectId
from fastapi import APIRouter

from app.api.deps import ApprovedSeller, Paginate
from app.core.enums import MemberStatus
from app.schemas.common import Page
from app.schemas.seller_member import MemberRead, MemberUsage
from app.services import member_service
from app.utils.ids import require_id

router = APIRouter(tags=["members"])


@router.get("/sellers/me/members", response_model=Page[MemberRead])
async def list_members(seller: ApprovedSeller, page: Paginate) -> Page[MemberRead]:
    members, total = await member_service.list_members(
        require_id(seller.id), skip=page.skip, limit=page.limit
    )
    return Page(
        items=[MemberRead.model_validate(m) for m in members],
        total=total,
        skip=page.skip,
        limit=page.limit,
    )


@router.get("/sellers/me/members/{member_id}/usage", response_model=MemberUsage)
async def member_usage(member_id: PydanticObjectId, seller: ApprovedSeller) -> MemberUsage:
    return await member_service.get_member_usage(require_id(seller.id), member_id)


@router.post("/sellers/me/members/{member_id}/block", response_model=MemberRead)
async def block_member(member_id: PydanticObjectId, seller: ApprovedSeller) -> MemberRead:
    member = await member_service.set_member_status(
        require_id(seller.id), member_id, MemberStatus.BLOCKED
    )
    return MemberRead.model_validate(member)


@router.post("/sellers/me/members/{member_id}/unblock", response_model=MemberRead)
async def unblock_member(member_id: PydanticObjectId, seller: ApprovedSeller) -> MemberRead:
    member = await member_service.set_member_status(
        require_id(seller.id), member_id, MemberStatus.ACTIVE
    )
    return MemberRead.model_validate(member)


@router.post(
    "/sellers/me/members/{member_id}/devices/{machine_id}/block", response_model=MemberRead
)
async def block_device(
    member_id: PydanticObjectId, machine_id: str, seller: ApprovedSeller
) -> MemberRead:
    member = await member_service.set_device_blocked(
        require_id(seller.id), member_id, machine_id, True
    )
    return MemberRead.model_validate(member)


@router.post(
    "/sellers/me/members/{member_id}/devices/{machine_id}/unblock", response_model=MemberRead
)
async def unblock_device(
    member_id: PydanticObjectId, machine_id: str, seller: ApprovedSeller
) -> MemberRead:
    member = await member_service.set_device_blocked(
        require_id(seller.id), member_id, machine_id, False
    )
    return MemberRead.model_validate(member)
