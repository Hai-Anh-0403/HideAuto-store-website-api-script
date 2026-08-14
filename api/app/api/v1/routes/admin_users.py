"""Admin routes: manage the store's end-users (members who redeemed a seller key)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, Query

from app.api.deps import CurrentAdmin, Paginate
from app.core.enums import MemberStatus
from app.schemas.common import Page
from app.schemas.seller_member import AdminMemberRead, AdminUserRow, MemberUsage
from app.services import admin_user_service

router = APIRouter(tags=["admin-users"])


@router.get("/admin/members", response_model=Page[AdminMemberRead])
async def list_members(
    _admin: CurrentAdmin,
    page: Paginate,
    seller_id: PydanticObjectId | None = None,
    status: MemberStatus | None = None,
    q: str | None = Query(default=None, description="Search by user email"),
) -> Page[AdminMemberRead]:
    members, total = await admin_user_service.list_members(
        seller_id=seller_id, status=status, q=q, skip=page.skip, limit=page.limit
    )
    return Page(
        items=[AdminMemberRead.model_validate(m) for m in members],
        total=total,
        skip=page.skip,
        limit=page.limit,
    )


@router.get("/admin/users", response_model=Page[AdminUserRow])
async def list_users(
    _admin: CurrentAdmin,
    page: Paginate,
    q: str | None = Query(default=None, description="Search by user email"),
) -> Page[AdminUserRow]:
    """Distinct end-users across all sellers (aggregated from memberships)."""
    rows, total = await admin_user_service.list_users(q=q, skip=page.skip, limit=page.limit)
    return Page(
        items=[AdminUserRow.model_validate(r) for r in rows],
        total=total,
        skip=page.skip,
        limit=page.limit,
    )


@router.get("/admin/members/{member_id}", response_model=AdminMemberRead)
async def get_member(member_id: PydanticObjectId, _admin: CurrentAdmin) -> AdminMemberRead:
    member = await admin_user_service.get_member(member_id)
    return AdminMemberRead.model_validate(member)


@router.post("/admin/members/{member_id}/block", response_model=AdminMemberRead)
async def block_member(member_id: PydanticObjectId, _admin: CurrentAdmin) -> AdminMemberRead:
    member = await admin_user_service.set_member_status(member_id, MemberStatus.BLOCKED)
    return AdminMemberRead.model_validate(member)


@router.post("/admin/members/{member_id}/unblock", response_model=AdminMemberRead)
async def unblock_member(member_id: PydanticObjectId, _admin: CurrentAdmin) -> AdminMemberRead:
    member = await admin_user_service.set_member_status(member_id, MemberStatus.ACTIVE)
    return AdminMemberRead.model_validate(member)


@router.post(
    "/admin/members/{member_id}/devices/{machine_id}/block", response_model=AdminMemberRead
)
async def block_device(
    member_id: PydanticObjectId, machine_id: str, _admin: CurrentAdmin
) -> AdminMemberRead:
    member = await admin_user_service.set_device_blocked(member_id, machine_id, True)
    return AdminMemberRead.model_validate(member)


@router.post(
    "/admin/members/{member_id}/devices/{machine_id}/unblock", response_model=AdminMemberRead
)
async def unblock_device(
    member_id: PydanticObjectId, machine_id: str, _admin: CurrentAdmin
) -> AdminMemberRead:
    member = await admin_user_service.set_device_blocked(member_id, machine_id, False)
    return AdminMemberRead.model_validate(member)


@router.get("/admin/members/{member_id}/usage", response_model=MemberUsage)
async def member_usage(member_id: PydanticObjectId, _admin: CurrentAdmin) -> MemberUsage:
    return await admin_user_service.get_member_usage(member_id)
