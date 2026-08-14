"""End-user (desktop app) routes: periodic usage heartbeat.

The app calls this on a timer with the user's flowdesk token; the store pulls the
user's devices from flowdesk and refreshes the usage cache on all their memberships.
"""

from fastapi import APIRouter

from app.api.deps import CurrentAppIdentity
from app.schemas.seller_member import MemberUsage
from app.services import usage_service

router = APIRouter(tags=["app"])


@router.post("/app/heartbeat", response_model=MemberUsage)
async def heartbeat(identity: CurrentAppIdentity) -> MemberUsage:
    return await usage_service.sync_usage_for_user(identity.user.id, identity.access_token)
