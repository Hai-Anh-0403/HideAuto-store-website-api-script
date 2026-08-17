"""Mini-app activation: turn a seller key into a signed licence the app can check.

One entry point serves both moments in a mini app's life:
  * first launch — the buyer pastes a key, it gets redeemed, a licence comes back;
  * later launches — no key, the store just re-confirms the entitlement is still good.

Everything is decided here, on the server; the mini app only verifies a signature.
"""

import base64
import logging

from beanie import PydanticObjectId

from app.core.enums import ScriptStatus
from app.core.exceptions import ForbiddenError, NotFoundError
from app.repositories import script as script_repo
from app.repositories import script_version as version_repo
from app.repositories import seller_member as member_repo
from app.schemas.license import LicenseRead, LicenseRequest
from app.services import key_service, license_service, usage_service
from app.services.flowdesk_client import FlowdeskUser
from app.utils.ids import require_id

logger = logging.getLogger(__name__)


async def activate(
    *, user: FlowdeskUser, access_token: str, script_id: PydanticObjectId, data: LicenseRequest
) -> LicenseRead:
    script = await script_repo.get_by_id(script_id)
    if script is None:
        raise NotFoundError("Mini app not found")
    if script.status != ScriptStatus.PUBLISHED:
        raise ForbiddenError("This mini app is not on the store", code="script_not_published")

    if data.key is not None:
        # Raises on unknown / revoked / expired / used-up keys, with its own codes.
        await key_service.redeem_key(data.key, user)

    member = await member_repo.get(script.seller.id, user.id)
    if member is None or not key_service.is_entitled(member, require_id(script.id)):
        # A key was given but this app still isn't unlocked ⇒ it belongs to another app.
        raise ForbiddenError(
            "This mini app is not unlocked for your account",
            code="key_wrong_app" if data.key else "key_required",
        )
    if data.machine_id in member.blocked_devices:
        raise ForbiddenError("The seller blocked this device", code="device_blocked")

    version = (
        await version_repo.get_by_id(script.latest_version_id)
        if script.latest_version_id is not None
        else None
    )

    payload = license_service.build_payload(
        script_id=str(require_id(script.id)),
        app_id=version.app_id if version and version.app_id else "",
        app_name=version.app_name if version and version.app_name else script.name,
        seller_name=script.seller.name,
        user_id=user.id,
        user_email=user.email,
        machine_id=data.machine_id,
    )
    # Best-effort: an activation is also a sign of life, so the seller's user list shows
    # this buyer as recently active. A flowdesk hiccup must not block the licence.
    try:
        await usage_service.sync_usage_for_user(user.id, access_token)
    except Exception:  # noqa: BLE001 — never fail activation over a usage refresh
        logger.warning("usage sync after activation failed for user %s", user.id, exc_info=True)

    raw = license_service.encode_payload(payload)
    return LicenseRead(
        payload_b64=base64.b64encode(raw).decode("ascii"),
        signature=license_service.sign(raw),
        algorithm=license_service.SIGNATURE_ALGORITHM,
    )
