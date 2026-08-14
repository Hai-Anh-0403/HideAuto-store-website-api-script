"""Seller routes: seller self (`/sellers/me`) + admin moderation (`/admin/sellers`)."""

from beanie import PydanticObjectId
from fastapi import APIRouter

from app.api.deps import CurrentAdmin, CurrentSeller, Paginate
from app.core.enums import SellerStatus
from app.schemas.common import Page
from app.schemas.seller import SellerRead, SellerReject
from app.services import seller_service
from app.utils.ids import require_id

router = APIRouter(tags=["sellers"])


@router.get("/sellers/me", response_model=SellerRead)
async def get_me(seller: CurrentSeller) -> SellerRead:
    return SellerRead.model_validate(seller)


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
