"""Seller business logic: registration, authentication, admin moderation."""

from datetime import UTC, datetime

from beanie import PydanticObjectId

from app.core.enums import SellerStatus
from app.core.exceptions import AuthError, ConflictError, NotFoundError
from app.core.security import hash_password, verify_password
from app.models.seller import Seller
from app.repositories import seller as seller_repo
from app.schemas.seller import SellerRegister


async def register(data: SellerRegister) -> Seller:
    if await seller_repo.get_by_email(data.email) is not None:
        raise ConflictError("Email already registered")
    seller = Seller(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        contact=data.contact,
        status=SellerStatus.PENDING,
    )
    return await seller_repo.insert(seller)


async def authenticate(email: str, password: str) -> Seller:
    seller = await seller_repo.get_by_email(email)
    if seller is None or not verify_password(password, seller.password_hash):
        raise AuthError("Invalid credentials")
    return seller


async def _get_or_404(seller_id: PydanticObjectId) -> Seller:
    seller = await seller_repo.get_by_id(seller_id)
    if seller is None:
        raise NotFoundError("Seller not found")
    return seller


async def approve(seller_id: PydanticObjectId, admin_id: PydanticObjectId) -> Seller:
    seller = await _get_or_404(seller_id)
    seller.status = SellerStatus.APPROVED
    seller.approved_by = admin_id
    seller.approved_at = datetime.now(UTC)
    seller.reject_reason = None
    seller.updated_at = datetime.now(UTC)
    await seller.save()
    return seller


async def reject(
    seller_id: PydanticObjectId, admin_id: PydanticObjectId, reason: str | None
) -> Seller:
    seller = await _get_or_404(seller_id)
    seller.status = SellerStatus.REJECTED
    seller.approved_by = admin_id
    seller.reject_reason = reason
    seller.updated_at = datetime.now(UTC)
    await seller.save()
    return seller


async def suspend(seller_id: PydanticObjectId) -> Seller:
    seller = await _get_or_404(seller_id)
    seller.status = SellerStatus.SUSPENDED
    seller.updated_at = datetime.now(UTC)
    await seller.save()
    return seller


async def list_sellers(
    *, status: SellerStatus | None, skip: int, limit: int
) -> tuple[list[Seller], int]:
    return await seller_repo.list_sellers(status=status, skip=skip, limit=limit)
