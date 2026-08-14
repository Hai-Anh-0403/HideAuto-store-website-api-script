"""End-to-end seller portal flow against in-memory Mongo.

Covers: admin login → seller register → (blocked before approval) → admin approve →
seller issues key → end-user redeems key (usage synced) → seller sees member + usage →
app heartbeat → admin lists/blocks users.
"""

from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from app.api.deps import AppIdentity, get_app_identity
from app.services import flowdesk_client
from app.services.flowdesk_client import FlowdeskUser
from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _recent_device(machine_id: str, os_name: str) -> dict[str, Any]:
    return {
        "id": "dev-" + machine_id,
        "machineId": machine_id,
        "os": os_name,
        "lastSeenAt": datetime.now(UTC).isoformat(),
    }


async def _admin_token(client: httpx.AsyncClient) -> str:
    r = await client.post(
        "/api/v1/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


async def _register_and_login_seller(client: httpx.AsyncClient) -> tuple[str, str]:
    r = await client.post(
        "/api/v1/sellers/register",
        json={"email": "seller@teststore.com", "password": "seller12345", "name": "Seller One"},
    )
    assert r.status_code == 201, r.text
    seller_id = r.json()["id"]
    assert r.json()["status"] == "pending"

    r = await client.post(
        "/api/v1/sellers/login",
        json={"email": "seller@teststore.com", "password": "seller12345"},
    )
    assert r.status_code == 200, r.text
    return seller_id, r.json()["access_token"]


async def test_full_flow(
    client: httpx.AsyncClient, app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    # flowdesk device fetch is stubbed to two recently-seen devices.
    async def _fake_devices(access_token: str) -> list[dict[str, Any]]:
        return [_recent_device("m-1", "Windows"), _recent_device("m-2", "macOS")]

    monkeypatch.setattr(flowdesk_client, "get_devices", _fake_devices)

    admin_token = await _admin_token(client)
    seller_id, seller_token = await _register_and_login_seller(client)

    # Pending seller cannot issue keys.
    r = await client.post("/api/v1/sellers/me/keys", json={}, headers=_auth(seller_token))
    assert r.status_code == 403, r.text

    # Admin lists pending sellers and approves.
    r = await client.get("/api/v1/admin/sellers?status=pending", headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["total"] == 1

    r = await client.post(
        f"/api/v1/admin/sellers/{seller_id}/approve", headers=_auth(admin_token)
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # Approved seller issues a key.
    r = await client.post(
        "/api/v1/sellers/me/keys", json={"label": "campaign-1"}, headers=_auth(seller_token)
    )
    assert r.status_code == 201, r.text
    key_str = r.json()["key"]

    # End-user redeems the key (identity + raw token via override).
    fake_user = FlowdeskUser(id="flowdesk-user-1", email="buyer@x.com", name="Buyer")
    app.dependency_overrides[get_app_identity] = lambda: AppIdentity(fake_user, "user-token")
    try:
        r = await client.post(
            "/api/v1/keys/redeem", json={"key": key_str}, headers=_auth("user-token")
        )
        assert r.status_code == 201, r.text
        member_id = r.json()["id"]
        assert r.json()["user_id"] == "flowdesk-user-1"

        # Idempotent second redeem.
        r = await client.post(
            "/api/v1/keys/redeem", json={"key": key_str}, headers=_auth("user-token")
        )
        assert r.status_code == 201

        # App heartbeat refreshes usage → online (two recent devices).
        r = await client.post("/api/v1/app/heartbeat", headers=_auth("user-token"))
        assert r.status_code == 200, r.text
        assert r.json()["online"] is True
        assert len(r.json()["devices"]) == 2
    finally:
        app.dependency_overrides.clear()

    # Seller sees the member and reads cached usage (online, 2 devices).
    r = await client.get("/api/v1/sellers/me/members", headers=_auth(seller_token))
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["user_email"] == "buyer@x.com"

    r = await client.get(
        f"/api/v1/sellers/me/members/{member_id}/usage", headers=_auth(seller_token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["online"] is True

    # Block ONE of the two devices (not the whole user).
    r = await client.post(
        f"/api/v1/sellers/me/members/{member_id}/devices/m-1/block", headers=_auth(seller_token)
    )
    assert r.status_code == 200, r.text
    assert "m-1" in r.json()["blocked_devices"]

    r = await client.get(
        f"/api/v1/sellers/me/members/{member_id}/usage", headers=_auth(seller_token)
    )
    blocked = {d["machine_id"]: d["blocked"] for d in r.json()["devices"]}
    assert blocked == {"m-1": True, "m-2": False}

    # Unblock the device again.
    r = await client.post(
        f"/api/v1/sellers/me/members/{member_id}/devices/m-1/unblock", headers=_auth(seller_token)
    )
    assert r.json()["blocked_devices"] == []

    # Admin manages the end-user. (`/admin/users` uses a Mongo aggregation that the
    # mongomock test driver can't run — it's verified against real Mongo separately.)
    r = await client.get("/api/v1/admin/members", headers=_auth(admin_token))
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["seller_id"] == seller_id

    r = await client.post(f"/api/v1/admin/members/{member_id}/block", headers=_auth(admin_token))
    assert r.status_code == 200
    assert r.json()["status"] == "blocked"

    r = await client.get(f"/api/v1/admin/members/{member_id}", headers=_auth(admin_token))
    assert r.json()["status"] == "blocked"


async def test_bad_key_redeem(client: httpx.AsyncClient, app: FastAPI) -> None:
    fake_user = FlowdeskUser(id="u9", email="u9@x.com", name=None)
    app.dependency_overrides[get_app_identity] = lambda: AppIdentity(fake_user, "t")
    try:
        r = await client.post(
            "/api/v1/keys/redeem", json={"key": "SK-does-not-exist"}, headers=_auth("t")
        )
        assert r.status_code == 404, r.text
    finally:
        app.dependency_overrides.clear()
