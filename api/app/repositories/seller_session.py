"""Seller session DB access."""

from datetime import datetime

from beanie import PydanticObjectId

from app.models.seller_session import SellerSession


async def insert(session: SellerSession) -> SellerSession:
    return await session.insert()


async def get_by_jti(jti: str) -> SellerSession | None:
    return await SellerSession.find_one(SellerSession.jti == jti)


async def get_by_id(session_id: PydanticObjectId) -> SellerSession | None:
    return await SellerSession.get(session_id)


async def list_for_seller(seller_id: PydanticObjectId) -> list[SellerSession]:
    """Every session row of one seller, newest activity first.

    A seller has at most a handful of these, so the active/expired split happens in
    the service instead of a second query.
    """
    return await (
        SellerSession.find(SellerSession.seller_id == seller_id).sort("-last_seen_at").to_list()
    )


async def save(session: SellerSession) -> SellerSession:
    return await session.save()


async def delete_expired(seller_id: PydanticObjectId, now: datetime) -> None:
    """Drop rows whose token died on its own — they can never come back."""
    await SellerSession.find(
        SellerSession.seller_id == seller_id, SellerSession.expires_at < now
    ).delete()
