"""End-user (desktop app) routes: usage heartbeat + the mini apps they unlocked.

Everything here is authenticated with the user's flowdesk token, and every script access
is gated on a redeemed key for that specific mini app.
"""

from beanie import PydanticObjectId
from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.api.deps import CurrentAppIdentity, CurrentAppUser
from app.core.enums import DownloadFormat
from app.schemas.script import ScriptRead
from app.schemas.seller_member import MemberUsage
from app.services import mini_app_service, usage_service

router = APIRouter(tags=["app"])


@router.post("/app/heartbeat", response_model=MemberUsage)
async def heartbeat(identity: CurrentAppIdentity) -> MemberUsage:
    return await usage_service.sync_usage_for_user(identity.user.id, identity.access_token)


@router.get("/app/scripts", response_model=list[ScriptRead], summary="Mini apps I unlocked")
async def my_scripts(user: CurrentAppUser) -> list[ScriptRead]:
    scripts = await mini_app_service.list_entitled_scripts(user.id)
    return [ScriptRead.model_validate(s) for s in scripts]


@router.get(
    "/app/scripts/{script_id}/download",
    response_class=FileResponse,
    summary="Download an unlocked mini app (packaged .zip or raw graph)",
)
async def download_script(
    script_id: PydanticObjectId,
    user: CurrentAppUser,
    format: DownloadFormat = DownloadFormat.EXE,
) -> FileResponse:
    target = await mini_app_service.buyer_download(user.id, script_id, format)
    return FileResponse(target.path, filename=target.filename, media_type=target.media_type)
