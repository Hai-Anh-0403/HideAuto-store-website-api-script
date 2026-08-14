"""Usage sync: pull an end-user's devices from flowdesk (with their token) and cache
the result onto every membership that user has. Called on key redeem + app heartbeat.
"""

from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from app.models.seller_member import SellerMember
from app.schemas.seller_member import MemberDevice, MemberUsage
from app.services import flowdesk_client

# A device is considered "online" if seen within this window.
ONLINE_WINDOW_MINUTES = 5


def _parse_dt(raw: object) -> datetime | None:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def latest_seen(devices: list[dict[str, Any]]) -> datetime | None:
    stamps = [dt for d in devices if (dt := _parse_dt(d.get("lastSeenAt"))) is not None]
    return max(stamps) if stamps else None


def is_recent(ts: datetime | None, *, within_minutes: int = ONLINE_WINDOW_MINUTES) -> bool:
    if ts is None:
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return (datetime.now(UTC) - ts).total_seconds() <= within_minutes * 60


def device_machine_id(raw: dict[str, Any]) -> str:
    return str(raw.get("machineId") or raw.get("id") or "")


def device_view(raw: dict[str, Any], blocked_ids: Iterable[str]) -> MemberDevice:
    mid = device_machine_id(raw)
    return MemberDevice(
        machine_id=mid,
        name=raw.get("name") if isinstance(raw.get("name"), str) else None,
        os=raw.get("os") if isinstance(raw.get("os"), str) else None,
        last_seen_at=_parse_dt(raw.get("lastSeenAt")),
        blocked=mid in set(blocked_ids),
    )


def usage_from_member(member: SellerMember) -> MemberUsage:
    """Build a usage view from a member's cached devices + per-device block list."""
    blocked = set(member.blocked_devices)
    return MemberUsage(
        user_id=member.user_id,
        online=is_recent(member.last_seen_at),
        last_seen_at=member.last_seen_at,
        usage_synced_at=member.usage_synced_at,
        devices=[device_view(d, blocked) for d in member.devices],
    )


async def sync_usage_for_user(user_id: str, access_token: str) -> MemberUsage:
    """Fetch devices from flowdesk and cache them onto all of the user's memberships."""
    from app.repositories import seller_member as member_repo

    devices = await flowdesk_client.get_devices(access_token)
    last_seen = latest_seen(devices)
    now = datetime.now(UTC)

    members = await member_repo.list_by_user(user_id)
    for member in members:
        member.devices = devices
        member.last_seen_at = last_seen
        member.usage_synced_at = now
        await member.save()

    return MemberUsage(
        user_id=user_id,
        online=is_recent(last_seen),
        last_seen_at=last_seen,
        usage_synced_at=now,
        devices=[device_view(d, ()) for d in devices],
    )
