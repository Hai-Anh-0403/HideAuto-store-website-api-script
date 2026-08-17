"""Session routes: the seller's own signed-in devices (list, sign out, log out)."""

from beanie import PydanticObjectId
from fastapi import APIRouter, status

from app.api.deps import CurrentSellerCtx
from app.models.seller_session import SellerSession
from app.schemas.seller_session import SessionRead, SessionsRevoked
from app.services import session_service
from app.utils.ids import require_id

router = APIRouter(tags=["sessions"])


def _read(session: SellerSession, current_jti: str) -> SessionRead:
    return SessionRead(
        id=require_id(session.id),
        device=session.device,
        user_agent=session.user_agent,
        ip=session.ip,
        current=session.jti == current_jti,
        created_at=session.created_at,
        last_seen_at=session.last_seen_at,
        expires_at=session.expires_at,
    )


@router.get(
    "/sellers/me/sessions",
    response_model=list[SessionRead],
    summary="Devices signed in to my account",
)
async def list_my_sessions(ctx: CurrentSellerCtx) -> list[SessionRead]:
    sessions = await session_service.list_active(require_id(ctx.seller.id))
    return [_read(s, ctx.session.jti) for s in sessions]


@router.post(
    "/sellers/me/sessions/{session_id}/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign one device out",
)
async def revoke_session(session_id: PydanticObjectId, ctx: CurrentSellerCtx) -> None:
    await session_service.revoke(require_id(ctx.seller.id), session_id)


@router.post(
    "/sellers/me/sessions/revoke-others",
    response_model=SessionsRevoked,
    summary="Sign out every device except this one",
)
async def revoke_other_sessions(ctx: CurrentSellerCtx) -> SessionsRevoked:
    revoked = await session_service.revoke_others(require_id(ctx.seller.id), ctx.session.jti)
    return SessionsRevoked(revoked=revoked)


@router.post(
    "/sellers/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out this device",
)
async def logout(ctx: CurrentSellerCtx) -> None:
    """Ends the caller's own session so its token stops working immediately."""
    await session_service.revoke_by_jti(ctx.session.jti)
