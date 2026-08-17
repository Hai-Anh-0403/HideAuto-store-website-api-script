"""Seller sign-in sessions: start on login, verify per request, revoke per device."""

from datetime import UTC, datetime, timedelta

from beanie import PydanticObjectId

from app.core.exceptions import NotFoundError
from app.core.security import IssuedToken
from app.models.seller_session import SellerSession
from app.repositories import seller_session as session_repo
from app.utils.client_info import ClientInfo

# Every request would otherwise write to the session row; a minute of drift on
# "last active" is invisible to the seller and saves that write.
TOUCH_INTERVAL = timedelta(minutes=1)


def is_active(session: SellerSession, now: datetime) -> bool:
    return session.revoked_at is None and session.expires_at > now


async def start(seller_id: PydanticObjectId, issued: IssuedToken, client: ClientInfo) -> None:
    """Record a fresh sign-in and clear out this seller's dead rows."""
    now = datetime.now(UTC)
    await session_repo.delete_expired(seller_id, now)
    await session_repo.insert(
        SellerSession(
            seller_id=seller_id,
            jti=issued.jti,
            device=client.device,
            user_agent=client.user_agent,
            ip=client.ip,
            created_at=now,
            last_seen_at=now,
            expires_at=issued.expires_at,
        )
    )


async def resolve(jti: str) -> SellerSession | None:
    """The live session behind a token, or None once it is revoked or expired."""
    session = await session_repo.get_by_jti(jti)
    if session is None or not is_active(session, datetime.now(UTC)):
        return None
    return session


async def touch(session: SellerSession, client: ClientInfo) -> None:
    """Keep 'last active' (and the address it was last seen from) current."""
    now = datetime.now(UTC)
    if now - session.last_seen_at < TOUCH_INTERVAL:
        return
    session.last_seen_at = now
    if client.ip:
        session.ip = client.ip
    await session_repo.save(session)


async def list_active(seller_id: PydanticObjectId) -> list[SellerSession]:
    now = datetime.now(UTC)
    sessions = await session_repo.list_for_seller(seller_id)
    return [s for s in sessions if is_active(s, now)]


async def revoke(seller_id: PydanticObjectId, session_id: PydanticObjectId) -> None:
    """Sign one device out. Unknown or foreign ids read the same as gone."""
    session = await session_repo.get_by_id(session_id)
    if session is None or session.seller_id != seller_id:
        raise NotFoundError("Session not found")
    await _revoke(session)


async def revoke_by_jti(jti: str) -> None:
    """Sign out the caller's own device (logout)."""
    session = await session_repo.get_by_jti(jti)
    if session is not None:
        await _revoke(session)


async def revoke_others(seller_id: PydanticObjectId, keep_jti: str) -> int:
    """Sign out every device except the one asking. Returns how many were signed out."""
    others = [s for s in await list_active(seller_id) if s.jti != keep_jti]
    for session in others:
        await _revoke(session)
    return len(others)


async def _revoke(session: SellerSession) -> None:
    if session.revoked_at is not None:
        return
    session.revoked_at = datetime.now(UTC)
    await session_repo.save(session)
