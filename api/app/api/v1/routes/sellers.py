"""Seller routes: seller self (`/sellers/me`) + admin moderation (`/admin/sellers`)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, status

from app.api.deps import ApprovedSeller, CurrentAdmin, CurrentSeller, CurrentSellerCtx, Paginate
from app.core.enums import SellerStatus
from app.schemas.common import Page
from app.schemas.seller import (
    PasswordChange,
    PasswordChanged,
    SellerRead,
    SellerReject,
    SellerUpdate,
)
from app.services import seller_service, stats_service
from app.utils.ids import require_id

router = APIRouter(tags=["sellers"])


@router.get("/sellers/me", response_model=SellerRead)
async def get_me(seller: CurrentSeller) -> SellerRead:
    return SellerRead.model_validate(seller)


@router.get("/sellers/me/stats", summary="Dashboard tile counts (scripts, members, keys)")
async def get_stats(seller: ApprovedSeller) -> dict[str, int]:
    return await stats_service.get_seller_stats(require_id(seller.id))


@router.patch(
    "/sellers/me",
    response_model=SellerRead,
    summary="Edit my profile (name, contact)",
)
async def update_me(seller: CurrentSeller, payload: SellerUpdate) -> SellerRead:
    updated = await seller_service.update_profile(seller, payload)
    return SellerRead.model_validate(updated)


@router.post(
    "/sellers/me/password",
    response_model=PasswordChanged,
    status_code=status.HTTP_200_OK,
    summary="Change my password (signs out other devices)",
)
async def change_my_password(ctx: CurrentSellerCtx, payload: PasswordChange) -> PasswordChanged:
    signed_out = await seller_service.change_password(ctx.seller, payload, keep_jti=ctx.session.jti)
    return PasswordChanged(signed_out=signed_out)


@router.get("/admin/sellers", response_model=Page[SellerRead])
async def admin_list_sellers(
    _admin: CurrentAdmin,
    page: Paginate,
    status: SellerStatus | None = None,
) -> Page[SellerRead]:
    sellers, total = await seller_service.list_sellers(
        status=status, skip=page.skip, limit=page.limit
    )
    return Page(
        items=[SellerRead.model_validate(s) for s in sellers],
        total=total,
        skip=page.skip,
        limit=page.limit,
    )


@router.post("/admin/sellers/{seller_id}/approve", response_model=SellerRead)
async def admin_approve(seller_id: PydanticObjectId, admin: CurrentAdmin) -> SellerRead:
    seller = await seller_service.approve(seller_id, require_id(admin.id))
    return SellerRead.model_validate(seller)


@router.post("/admin/sellers/{seller_id}/reject", response_model=SellerRead)
async def admin_reject(
    seller_id: PydanticObjectId, admin: CurrentAdmin, payload: SellerReject
) -> SellerRead:
    seller = await seller_service.reject(seller_id, require_id(admin.id), payload.reason)
    return SellerRead.model_validate(seller)


@router.post("/admin/sellers/{seller_id}/suspend", response_model=SellerRead)
async def admin_suspend(seller_id: PydanticObjectId, _admin: CurrentAdmin) -> SellerRead:
    seller = await seller_service.suspend(seller_id)
    return SellerRead.model_validate(seller)
