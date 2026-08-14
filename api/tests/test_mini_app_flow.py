"""Per-app keys, repackaging, and buyer downloads.

A key unlocks exactly one mini app; the `.zip` a buyer gets is rebuilt on the server from
the scrubbed graph plus an empty app template.
"""

import io
import json
import zipfile
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI

from app.api.deps import AppIdentity, get_app_identity
from app.core.config import settings
from app.services.flowdesk_client import FlowdeskUser
from tests.helpers import (
    admin_token,
    approved_seller_token,
    auth,
    mini_app_zip,
    publish_script,
    upload_files,
)

BUYER = FlowdeskUser(id="flowdesk-buyer-1", email="buyer@x.com", name="Buyer")
OTHER_BUYER = FlowdeskUser(id="flowdesk-buyer-2", email="nokey@x.com", name="No Key")


def _template_zip() -> bytes:
    """An 'empty' packaged app: binaries plus a stale app.workflow to be replaced."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("hideflow.exe", b"MZ-template-binary")
        archive.writestr("resources/app.asar", b"template-asar")
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


async def test_key_unlocks_one_app_and_buyer_downloads_it(
    client: httpx.AsyncClient, app: FastAPI, template_path: Path
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)
    other_id = await publish_script(client, seller, admin, name="Warmup Bot")

    # 1. A key is issued for one specific mini app.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/keys",
        json={"label": "batch-1"},
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    key = r.json()
    assert key["script_id"] == script_id
    assert key["script_name"] == "Gmail Auto Register"

    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}/keys", headers=auth(seller))
    assert [k["key"] for k in r.json()] == [key["key"]]

    # 2. The buyer redeems it → entitled to that app only.
    _as_user(app, BUYER)
    try:
        r = await client.post(
            "/api/v1/keys/redeem", json={"key": key["key"]}, headers=auth("user-token")
        )
        assert r.status_code == 201, r.text
        assert r.json()["script_ids"] == [script_id]
        assert r.json()["all_scripts"] is False

        r = await client.get("/api/v1/app/scripts", headers=auth("user-token"))
        assert [s["id"] for s in r.json()] == [script_id]

        # The other app stays locked.
        r = await client.get(
            f"/api/v1/app/scripts/{other_id}/download?format=graph", headers=auth("user-token")
        )
        assert r.status_code == 403, r.text

        # 3. Graph download works right away; the .zip needs a build first.
        r = await client.get(
            f"/api/v1/app/scripts/{script_id}/download?format=exe", headers=auth("user-token")
        )
        assert r.status_code == 409, r.text

        r = await client.get(
            f"/api/v1/app/scripts/{script_id}/download?format=graph", headers=auth("user-token")
        )
        assert r.status_code == 200, r.text
        downloaded = json.loads(r.content)
        assert [n["data"]["code"] for n in downloaded["nodes"]][0] == "openConnect"
    finally:
        app.dependency_overrides.clear()

    # 4. Seller repackages the approved version.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/mini-app-builds", headers=auth(seller)
    )
    assert r.status_code == 201, r.text
    build = r.json()
    assert build["status"] == "ready"
    assert build["built_by"] == "server"
    assert build["app_version"] == "1.0.0"

    # Building the same version twice is refused rather than silently duplicated.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/mini-app-builds", headers=auth(seller)
    )
    assert r.status_code == 409, r.text

    # 5. The buyer now gets a real package with this workflow injected.
    _as_user(app, BUYER)
    try:
        r = await client.get(
            f"/api/v1/app/scripts/{script_id}/download?format=exe", headers=auth("user-token")
        )
        assert r.status_code == 200, r.text
        with zipfile.ZipFile(io.BytesIO(r.content)) as archive:
            names = archive.namelist()
            assert names.count("resources/app.workflow") == 1, "stale template entry not replaced"
            assert "hideflow.exe" in names
            envelope = json.loads(archive.read("resources/app.workflow"))
        assert envelope["appName"] == "Gmail Auto Register"
        assert envelope["appId"] == "com.hideflow.mini.gmail-auto-register"
        assert len(envelope["workflow"]["nodes"]) == 8
    finally:
        app.dependency_overrides.clear()

    # 6. A user who never redeemed anything sees nothing and gets nothing.
    _as_user(app, OTHER_BUYER)
    try:
        r = await client.get("/api/v1/app/scripts", headers=auth("user-token"))
        assert r.json() == []
        r = await client.get(
            f"/api/v1/app/scripts/{script_id}/download?format=exe", headers=auth("user-token")
        )
        assert r.status_code == 403, r.text
    finally:
        app.dependency_overrides.clear()

    # 7. Download stats moved with the two successful buyer downloads.
    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    assert r.json()["stats"]["downloads"] == 2
    assert r.json()["has_mini_app"] is True


async def test_build_requires_template_and_approved_version(
    client: httpx.AsyncClient, template_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    script_id = await publish_script(client, seller, admin)

    # An unreviewed version is not packageable, even though the script is live.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/versions",
        data={"version": "1.1.0"},
        files=upload_files(mini_app_zip(with_secrets=False)),
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    pending_version_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/mini-app-builds",
        json={"version_id": pending_version_id},
        headers=auth(seller),
    )
    assert r.status_code == 409, r.text
    assert "approved" in r.json()["detail"]

    # Without a template the server says so instead of failing obscurely.
    monkeypatch.setattr(settings, "mini_app_template_path", None)
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/mini-app-builds", headers=auth(seller)
    )
    assert r.status_code == 503, r.text
    assert "MINI_APP_TEMPLATE_PATH" in r.json()["detail"]


async def test_seller_key_scope_is_enforced(client: httpx.AsyncClient) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    other = await approved_seller_token(client, admin, email="other@teststore.com")
    script_id = await publish_script(client, seller, admin)

    # Another seller cannot issue keys for someone else's mini app.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/keys", json={}, headers=auth(other)
    )
    assert r.status_code == 403, r.text

    # A seller-wide key (no script) still exists and unlocks everything.
    r = await client.post(
        "/api/v1/sellers/me/keys", json={"label": "all access"}, headers=auth(seller)
    )
    assert r.status_code == 201, r.text
    assert r.json()["script_id"] is None
