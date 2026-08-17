"""Seller key business logic: issue / list / revoke keys, and key redemption."""

from datetime import UTC, datetime

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.core.enums import KeyStatus, MemberStatus, SellerStatus
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.script import Script
from app.models.seller_key import SellerKey
from app.models.seller_member import SellerMember
from app.repositories import script as script_repo
from app.repositories import seller as seller_repo
from app.repositories import seller_key as key_repo
from app.repositories import seller_member as member_repo
from app.schemas.seller_key import KeyCreate
from app.services.flowdesk_client import FlowdeskUser
from app.utils.ids import generate_key

_MAX_KEYGEN_RETRIES = 5


async def create_key(
    seller_id: PydanticObjectId, data: KeyCreate, *, script: Script | None = None
) -> SellerKey:
    """Issue a key. Bound to one script when given, otherwise seller-wide."""
    for _ in range(_MAX_KEYGEN_RETRIES):
        key = SellerKey(
            seller_id=seller_id,
            script_id=script.id if script is not None else None,
            script_name=script.name if script is not None else None,
            key=generate_key(),
            label=data.label,
            max_uses=data.max_uses,
            expires_at=data.expires_at,
        )
        try:
            return await key_repo.insert(key)
        except DuplicateKeyError:
            continue
    raise RuntimeError("Could not generate a unique key")


async def _owned_script(seller_id: PydanticObjectId, script_id: PydanticObjectId) -> Script:
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Script not found")
    if script.seller.id != seller_id:
        raise ForbiddenError("Not your script")
    return script


async def create_script_key(
    seller_id: PydanticObjectId, script_id: PydanticObjectId, data: KeyCreate
) -> SellerKey:
    """Issue a key that unlocks exactly one of the seller's mini apps."""
    script = await _owned_script(seller_id, script_id)
    return await create_key(seller_id, data, script=script)


async def list_keys(
    seller_id: PydanticObjectId, *, skip: int = 0, limit: int = 100
) -> tuple[list[SellerKey], int]:
    return await key_repo.list_for_seller(seller_id, skip=skip, limit=limit)


async def list_script_keys(
    seller_id: PydanticObjectId, script_id: PydanticObjectId
) -> list[SellerKey]:
    await _owned_script(seller_id, script_id)
    return await key_repo.list_for_script(seller_id, script_id)


async def revoke_key(seller_id: PydanticObjectId, key_id: PydanticObjectId) -> SellerKey:
    key = await key_repo.get_by_id(key_id)
    if key is None:
        raise NotFoundError("Key not found")
    if key.seller_id != seller_id:
        raise ForbiddenError("Not your key")
    key.status = KeyStatus.REVOKED
    await key.save()
    return key


def _grant_access(member: SellerMember, key: SellerKey) -> bool:
    """Unlock what the key covers. Returns False when the user already had it."""
    if key.script_id is None:
        if member.all_scripts:
            return False
        member.all_scripts = True
        return True
    if key.script_id in member.script_ids:
        return False
    member.script_ids = [*member.script_ids, key.script_id]
    return True


def is_entitled(member: SellerMember, script_id: PydanticObjectId) -> bool:
    return member.status == MemberStatus.ACTIVE and (
        member.all_scripts or script_id in member.script_ids
    )


async def redeem_key(key_str: str, user: FlowdeskUser) -> SellerMember:
    """An end-user (verified via flowdesk) redeems a seller key → link created."""
    key = await key_repo.get_by_key(key_str)
    if key is None or key.status != KeyStatus.ACTIVE:
        raise NotFoundError("Invalid or inactive key")
    if key.expires_at is not None and key.expires_at < datetime.now(UTC):
        raise ForbiddenError("Key expired")
    if key.max_uses is not None and key.used_count >= key.max_uses:
        raise ForbiddenError("Key usage limit reached")

    seller = await seller_repo.get_by_id(key.seller_id)
    if seller is None or seller.status != SellerStatus.APPROVED:
        raise ForbiddenError("Seller not available")

    existing = await member_repo.get(key.seller_id, user.id)
    if existing is not None:
        # Already linked to this seller — idempotent, but each new key still unlocks the
        # mini app it belongs to.
        existing.user_email = user.email
        existing.user_name = user.name
        existing.status = MemberStatus.ACTIVE
        newly_unlocked = _grant_access(existing, key)
        await existing.save()
        if newly_unlocked:
            key.used_count += 1
            await key.save()
        return existing

    member = SellerMember(
        seller_id=key.seller_id,
        key_id=key.id,
        user_id=user.id,
        user_email=user.email,
        user_name=user.name,
    )
    _grant_access(member, key)
    created = await member_repo.insert(member)
    # NOTE: non-atomic counter; acceptable for first slice. Revisit with $inc if needed.
    key.used_count += 1
    await key.save()
    return created
