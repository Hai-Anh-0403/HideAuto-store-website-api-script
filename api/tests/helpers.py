"""Shared test helpers: auth shortcuts and a realistic mini-app package to upload."""

import io
import json
import zipfile
from typing import Any

import httpx

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

OPENAI_SECRET = "sk-live-REAL-OPENAI-KEY"
SMTP_SECRET = "hunter2-smtp-password"


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def node(node_id: str, code: str, **data: Any) -> dict[str, Any]:
    return {"id": node_id, "type": "basic", "data": {"code": code, **data}}


def graph(*, with_secrets: bool) -> dict[str, Any]:
    """A small but representative workflow: browser + AI + shell + 2FA + sub-script."""
    return {
        "nodes": [
            node(
                "n1",
                "openConnect",
                openConnectMode="otherApp",
                openConnectPlatform="hidemium",
                openConnectProxyEnabled=True,
                openConnectFingerprintUserAgent="Mozilla/5.0",
            ),
            node("n2", "gotoUrl", gotoUrlUrl="https://mail.google.com"),
            node(
                "n3",
                "aiLlm",
                aiLlmProvider="openai",
                aiLlmOpenaiApiKey=OPENAI_SECRET if with_secrets else "{{openai_key}}",
            ),
            node("n4", "getCode2Fa"),
            node("n5", "readSpreadsheet", readSpreadsheetSource="googleSheet"),
            node("n6", "runCommand", runCommandCommand="powershell -c ls"),
            node("n7", "runOtherScript", runOtherScriptWorkflowId="wf-child-1"),
            {"id": "n8", "type": "if", "data": {"code": "if"}},
        ],
        "edges": [],
        "variables": [
            {"id": "b1", "key": "profile_uuid", "value": ""},
            {"id": "v1", "key": "gmail_user", "value": "someone@gmail.com"},
            {"id": "v2", "key": "smtp_pass", "value": SMTP_SECRET if with_secrets else ""},
        ],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def mini_app_zip(*, with_secrets: bool = True) -> bytes:
    """What the desktop app produces: an app folder with resources/app.workflow inside."""
    envelope = {
        "version": 1,
        "appName": "Gmail Auto Register",
        "appId": "com.hideflow.mini.gmail-auto-register",
        "workflowId": "wf-123",
        "workflowName": "Gmail Auto Register",
        "builtAt": "2026-08-14T00:00:00.000Z",
        "workflow": graph(with_secrets=with_secrets),
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("Gmail Auto Register.exe", b"MZ-fake-electron-binary")
        archive.writestr("resources/app.asar", b"fake-asar")
        archive.writestr("resources/app.workflow", json.dumps(envelope))
    return buffer.getvalue()


def upload_files(content: bytes, name: str = "mini-app.zip") -> dict[str, Any]:
    return {"file": (name, content, "application/zip")}


async def admin_token(client: httpx.AsyncClient) -> str:
    r = await client.post(
        "/api/v1/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


async def approved_seller_token(
    client: httpx.AsyncClient, token: str, email: str = "seller@teststore.com"
) -> str:
    r = await client.post(
        "/api/v1/sellers/register",
        json={"email": email, "password": "seller12345", "name": "Seller One"},
    )
    assert r.status_code == 201, r.text
    seller_id = r.json()["id"]

    r = await client.post(f"/api/v1/admin/sellers/{seller_id}/approve", headers=auth(token))
    assert r.status_code == 200, r.text

    r = await client.post("/api/v1/sellers/login", json={"email": email, "password": "seller12345"})
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


async def publish_script(
    client: httpx.AsyncClient, seller: str, admin: str, name: str = "Gmail Auto Register"
) -> str:
    """Upload a clean package, submit it, approve it. Returns the script id."""
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": name, "version": "1.0.0", "min_app_version": "1.4.0"},
        files=upload_files(mini_app_zip(with_secrets=False)),
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    script_id = str(r.json()["id"])

    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    version_id = r.json()["versions"][0]["id"]

    r = await client.post(f"/api/v1/sellers/me/scripts/{script_id}/submit", headers=auth(seller))
    assert r.status_code == 200, r.text
    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{version_id}/approve", headers=auth(admin)
    )
    assert r.status_code == 200, r.text
    return script_id
