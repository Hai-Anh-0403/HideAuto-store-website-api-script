"""Seller business logic: registration, authentication, admin moderation."""

from datetime import UTC, datetime

from beanie import PydanticObjectId

from app.core.config import settings
from app.core.enums import SellerStatus
from app.core.exceptions import AppError, AuthError, ConflictError, NotFoundError
from app.core.security import hash_password_async, verify_password_async
from app.models.seller import Seller
from app.repositories import seller as seller_repo
from app.schemas.seller import PasswordChange, SellerRegister, SellerUpdate
from app.services import session_service
from app.utils.ids import require_id


async def register(data: SellerRegister) -> Seller:
    """Register a seller — `pending` until an admin approves.

    `SELLER_AUTO_APPROVE=true` skips that gate so a fresh account can publish right away.
    It is a dev convenience: with it on, anyone who can reach the API can list scripts.
    `approved_by` stays empty because no admin actually looked at the account.
    """
    if await seller_repo.get_by_email(data.email) is not None:
        raise ConflictError("Email already registered")
    auto = settings.seller_auto_approve
    seller = Seller(
        email=data.email,
        password_hash=await hash_password_async(data.password),
        name=data.name,
        contact=data.contact,
        status=SellerStatus.APPROVED if auto else SellerStatus.PENDING,
        approved_at=datetime.now(UTC) if auto else None,
    )
    return await seller_repo.insert(seller)


async def authenticate(email: str, password: str) -> Seller:
    seller = await seller_repo.get_by_email(email)
    if seller is None or not await verify_password_async(password, seller.password_hash):
        raise AuthError("Invalid credentials")
    return seller


async def update_profile(seller: Seller, data: SellerUpdate) -> Seller:
    """Edit the profile text. Email, status and password are not touched here."""
    changes = data.model_dump(exclude_unset=True)
    # `contact` can be cleared, the display name cannot.
    if changes.get("name") is None:
        changes.pop("name", None)
    for field, value in changes.items():
        setattr(seller, field, value)
    if changes:
        seller.updated_at = datetime.now(UTC)
        await seller.save()
    return seller


async def change_password(seller: Seller, data: PasswordChange, *, keep_jti: str) -> int:
    """Rotate the password after re-checking the current one.

    Every other device is signed out — a password change is how a seller locks out
    someone who got in, so leaving those tokens alive would defeat it. The device
    doing the change keeps its session. Returns how many were signed out.
    """
    if not await verify_password_async(data.current_password, seller.password_hash):
        raise AppError("Current password is incorrect", code="wrong_password")
    if await verify_password_async(data.new_password, seller.password_hash):
        raise ConflictError("New password matches the current one", code="password_unchanged")
    seller.password_hash = await hash_password_async(data.new_password)
    seller.updated_at = datetime.now(UTC)
    await seller.save()
    return await session_service.revoke_others(require_id(seller.id), keep_jti)


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
