"""Seller dashboard statistics — lightweight counts for the overview tiles."""

from datetime import UTC, datetime, timedelta

from beanie import PydanticObjectId

from app.core.enums import KeyStatus
from app.models.script import Script
from app.models.seller_key import SellerKey
from app.models.seller_member import SellerMember

_ONLINE_WINDOW_MINUTES = 5


async def get_seller_stats(seller_id: PydanticObjectId) -> dict[str, int]:
    cutoff = datetime.now(UTC) - timedelta(minutes=_ONLINE_WINDOW_MINUTES)
    scripts_total = await Script.find({"seller.id": seller_id}).count()
    members_total = await SellerMember.find(SellerMember.seller_id == seller_id).count()
    members_online = await SellerMember.find(
        SellerMember.seller_id == seller_id, {"last_seen_at": {"$gte": cutoff}}
    ).count()
    keys_active = await SellerKey.find(
        SellerKey.seller_id == seller_id, SellerKey.status == KeyStatus.ACTIVE
    ).count()
    return {
        "scripts_total": scripts_total,
        "members_total": members_total,
        "members_online": members_online,
        "keys_active": keys_active,
    }
