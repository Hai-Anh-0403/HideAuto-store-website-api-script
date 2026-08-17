"""Mini-app activation: key in → signed licence out.

Covers what the packaged mini app relies on: the licence is only issued to a buyer who
redeemed a key for *this* app, it is signed so the app can trust it offline, it is bound
to the machine that asked, and the seller can shut a device out.
"""

import base64
import io
import json
import zipfile
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from app.api.deps import AppIdentity, get_app_identity
from app.core.config import settings
from app.services import license_service
from app.services.flowdesk_client import FlowdeskUser
from tests.helpers import admin_token, approved_seller_token, auth, publish_script

BUYER = FlowdeskUser(id="flowdesk-buyer-1", email="buyer@x.com", name="Buyer")
MACHINE = "machine-aaa-111"

# A throwaway signing pair: tests must never depend on a developer's real .env.
SIGNING_SEED = base64.b64encode(bytes(range(32))).decode("ascii")


@pytest.fixture(autouse=True)
def signing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "license_signing_key", SIGNING_SEED)
    monkeypatch.setattr(settings, "store_public_url", "https://store.example.com")


def _template_zip() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("hideflow.exe", b"MZ-template-binary")
        archive.writestr("resources/app.workflow", json.dumps({"appName": "TEMPLATE"}))
    return buffer.getvalue()


@pytest.fixture
def template_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "mini-app-template.zip"
    path.write_bytes(_template_zip())
    monkeypatch.setattr(settings, "mini_app_template_path", str(path))
    return path


def _as_user(app: FastAPI, user: FlowdeskUser) -> None:
    app.dependency_overrides[get_app_identity] = lambda: AppIdentity(user, "user-token")


async def _issue_key(client: httpx.AsyncClient, seller: str, script_id: str) -> str:
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/keys", json={}, headers=auth(seller)
    )
    assert r.status_code == 201, r.text
    return str(r.json()["key"])


async def _activate(
    client: httpx.AsyncClient, script_id: str, *, key: str | None = None, machine: str = MACHINE
) -> httpx.Response:
    body: dict[str, str] = {"machine_id": machine}
    if key is not None:
        body["key"] = key
    return await client.post(
        f"/api/v1/app/scripts/{script_id}/license", json=body, headers=auth("user-token")
    )


async def test_key_activates_the_mini_app_and_the_licence_verifies(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)
    key = await _issue_key(client, seller, script_id)

    _as_user(app, BUYER)
    try:
        # Without a key the app is told to ask for one — no licence leaks out.
        r = await _activate(client, script_id)
        assert r.status_code == 403, r.text
        assert r.json()["code"] == "key_required"

        r = await _activate(client, script_id, key=key)
        assert r.status_code == 200, r.text
        licence = r.json()
        raw = base64.b64decode(licence["payload_b64"])
        payload = json.loads(raw)

        assert licence["algorithm"] == "Ed25519"
        assert license_service.verify(raw, licence["signature"]) is True
        # A tampered licence must not pass — that is the whole point of signing it.
        tampered = raw.replace(MACHINE.encode(), b"machine-hack-1")
        assert tampered != raw
        assert license_service.verify(tampered, licence["signature"]) is False

        assert payload["script_id"] == script_id
        assert payload["machine_id"] == MACHINE
        assert payload["user_id"] == BUYER.id
        assert payload["app_name"] == "Gmail Auto Register"
        assert payload["expires_at"] > payload["issued_at"]

        # Re-check on a later launch: no key needed, the entitlement is remembered.
        r = await _activate(client, script_id)
        assert r.status_code == 200, r.text
        assert json.loads(base64.b64decode(r.json()["payload_b64"]))["script_id"] == script_id
    finally:
        app.dependency_overrides.clear()


async def test_licence_survives_a_seller_name_with_dau_tieng_viet(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    """The signature covers raw UTF-8 bytes, so accented names must round-trip.

    Signing a *re-serialized* payload would break here: Python escapes non-ASCII by
    default and JavaScript does not, so the mini app would compute different bytes.
    """
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    r = await client.patch(
        "/api/v1/sellers/me", json={"name": "Cửa hàng Đặng Vũ"}, headers=auth(seller)
    )
    assert r.status_code == 200, r.text
    script_id = await publish_script(client, seller, admin)
    key = await _issue_key(client, seller, script_id)

    _as_user(app, BUYER)
    try:
        r = await _activate(client, script_id, key=key)
        assert r.status_code == 200, r.text
        raw = base64.b64decode(r.json()["payload_b64"])
        assert license_service.verify(raw, r.json()["signature"]) is True
        # Raw UTF-8 on the wire — not \uXXXX escapes.
        assert "Cửa hàng Đặng Vũ".encode() in raw
        assert json.loads(raw)["seller_name"] == "Cửa hàng Đặng Vũ"
    finally:
        app.dependency_overrides.clear()


async def test_key_of_another_app_does_not_activate_this_one(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)
    other_id = await publish_script(client, seller, admin, name="Warmup Bot")
    other_key = await _issue_key(client, seller, other_id)

    _as_user(app, BUYER)
    try:
        r = await _activate(client, script_id, key=other_key)
        assert r.status_code == 403, r.text
        assert r.json()["code"] == "key_wrong_app"

        # The key still did its job for the app it belongs to.
        r = await _activate(client, other_id)
        assert r.status_code == 200, r.text
    finally:
        app.dependency_overrides.clear()


async def test_revoked_key_and_blocked_device_are_refused(
    client: httpx.AsyncClient, app: FastAPI
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)
    key = await _issue_key(client, seller, script_id)

    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}/keys", headers=auth(seller))
    key_id = r.json()[0]["id"]
    r = await client.post(f"/api/v1/sellers/me/keys/{key_id}/revoke", headers=auth(seller))
    assert r.status_code == 200, r.text

    _as_user(app, BUYER)
    try:
        r = await _activate(client, script_id, key=key)
        assert r.status_code == 404, r.text  # revoked key reads as unknown
    finally:
        app.dependency_overrides.clear()

    # A second buyer redeems a fresh key, then the seller blocks their machine.
    fresh = await _issue_key(client, seller, script_id)
    _as_user(app, BUYER)
    try:
        assert (await _activate(client, script_id, key=fresh)).status_code == 200
    finally:
        app.dependency_overrides.clear()

    r = await client.get("/api/v1/sellers/me/members", headers=auth(seller))
    member_id = r.json()["items"][0]["id"]
    r = await client.post(
        f"/api/v1/sellers/me/members/{member_id}/devices/{MACHINE}/block", headers=auth(seller)
    )
    assert r.status_code == 200, r.text

    _as_user(app, BUYER)
    try:
        r = await _activate(client, script_id)
        assert r.status_code == 403, r.text
        assert r.json()["code"] == "device_blocked"
        # Another machine of the same buyer still works — the block is per device.
        assert (await _activate(client, script_id, machine="machine-bbb")).status_code == 200
    finally:
        app.dependency_overrides.clear()


async def test_package_carries_the_activation_block(
    client: httpx.AsyncClient, app: FastAPI, template_path: Path
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)
    key = await _issue_key(client, seller, script_id)

    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/mini-app-builds", headers=auth(seller)
    )
    assert r.status_code == 201, r.text

    _as_user(app, BUYER)
    try:
        assert (await _activate(client, script_id, key=key)).status_code == 200
        r = await client.get(
            f"/api/v1/app/scripts/{script_id}/download?format=exe", headers=auth("user-token")
        )
        assert r.status_code == 200, r.text
    finally:
        app.dependency_overrides.clear()

    with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
        envelope = json.loads(archive.read("resources/app.workflow"))

    store = envelope["store"]
    assert store["scriptId"] == script_id
    assert store["baseUrl"] == "https://store.example.com"
    assert store["licenseAlgorithm"] == "Ed25519"
    # The package must ship the key that verifies licences, never the signing seed.
    assert store["licensePublicKey"] == license_service.public_key_b64()
    assert SIGNING_SEED not in json.dumps(envelope)
