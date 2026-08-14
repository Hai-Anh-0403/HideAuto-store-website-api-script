"""Key routes: seller issues/lists/revokes keys; end-user redeems a key."""

from beanie import PydanticObjectId
from fastapi import APIRouter, status

from app.api.deps import ApprovedSeller, CurrentAppIdentity
from app.schemas.seller_key import KeyCreate, KeyRead, KeyRedeem
from app.schemas.seller_member import MemberRead
from app.services import key_service, usage_service
from app.utils.ids import require_id

router = APIRouter(tags=["keys"])


@router.post("/sellers/me/keys", response_model=KeyRead, status_code=status.HTTP_201_CREATED)
async def create_key(payload: KeyCreate, seller: ApprovedSeller) -> KeyRead:
    key = await key_service.create_key(require_id(seller.id), payload)
    return KeyRead.model_validate(key)


@router.get("/sellers/me/keys", response_model=list[KeyRead])
async def list_keys(seller: ApprovedSeller) -> list[KeyRead]:
    keys = await key_service.list_keys(require_id(seller.id))
    return [KeyRead.model_validate(k) for k in keys]


@router.post(
    "/sellers/me/scripts/{script_id}/keys",
    response_model=KeyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a key that unlocks this mini app",
)
async def create_script_key(
    script_id: PydanticObjectId, payload: KeyCreate, seller: ApprovedSeller
) -> KeyRead:
    key = await key_service.create_script_key(require_id(seller.id), script_id, payload)
    return KeyRead.model_validate(key)


@router.get("/sellers/me/scripts/{script_id}/keys", response_model=list[KeyRead])
async def list_script_keys(script_id: PydanticObjectId, seller: ApprovedSeller) -> list[KeyRead]:
    keys = await key_service.list_script_keys(require_id(seller.id), script_id)
    return [KeyRead.model_validate(k) for k in keys]


@router.post("/sellers/me/keys/{key_id}/revoke", response_model=KeyRead)
async def revoke_key(key_id: PydanticObjectId, seller: ApprovedSeller) -> KeyRead:
    key = await key_service.revoke_key(require_id(seller.id), key_id)
    return KeyRead.model_validate(key)


@router.post("/keys/redeem", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def redeem_key(payload: KeyRedeem, identity: CurrentAppIdentity) -> MemberRead:
    """End-user (authenticated via flowdesk token) redeems a seller key."""
    member = await key_service.redeem_key(payload.key, identity.user)
    # Best-effort: seed usage from flowdesk devices using the user's own token.
    await usage_service.sync_usage_for_user(identity.user.id, identity.access_token)
    return MemberRead.model_validate(member)
