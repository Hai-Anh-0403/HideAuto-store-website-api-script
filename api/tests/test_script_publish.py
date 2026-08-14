"""Script publish pipeline: upload → scrub → derive → submit → admin moderation.

The uploaded package deliberately carries two real secrets; the point of most of these
assertions is that neither of them survives anywhere the store can hand back out.
"""

import io
import json
import zipfile
from pathlib import Path

import httpx

from tests.helpers import (
    OPENAI_SECRET,
    SMTP_SECRET,
    admin_token,
    approved_seller_token,
    auth,
    graph,
    mini_app_zip,
    upload_files,
)


def _stored_blobs(root: Path) -> str:
    """Everything the store wrote to disk, as one string — for leak assertions."""
    if not root.exists():
        return ""
    return "".join(
        path.read_text(encoding="utf-8", errors="ignore")
        for path in root.rglob("*")
        if path.is_file()
    )


async def test_publish_flow_scrubs_secrets_and_derives_metadata(
    client: httpx.AsyncClient, storage_root: Path
) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)

    # 1. Upload a mini-app package that still has secrets baked into it.
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Gmail Auto Register", "version": "1.0.0", "min_app_version": "1.4.0"},
        files=upload_files(mini_app_zip()),
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    script = r.json()
    script_id = script["id"]
    assert script["status"] == "draft"
    assert script["slug"] == "gmail-auto-register"

    # 2. Metadata is derived from the graph, not from the seller.
    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    assert r.status_code == 200, r.text
    version = r.json()["versions"][0]

    assert version["node_count"] == 8
    # `if` has no group in the app catalog, so it contributes none here either.
    assert version["node_groups_used"] == ["ai", "browser", "data", "tab"]
    assert version["uses_control_flow"] is True
    assert version["sub_workflow_ids"] == ["wf-child-1"]
    assert version["app_id"] == "com.hideflow.mini.gmail-auto-register"
    assert version["source_filename"] == "mini-app.zip"
    assert version["delivery"] == "mini_app_exe"

    caps = version["capabilities"]
    assert caps["requires_browser"] is True
    assert caps["browser_platforms"] == ["hidemium"]
    assert caps["requires_proxy"] is True
    assert caps["uses_fingerprint"] is True
    assert caps["uses_ai_llm"] is True
    assert caps["ai_providers"] == ["openai"]
    assert caps["uses_google_sheets"] is True
    assert caps["uses_2fa"] is True
    assert caps["uses_shell"] is True

    # Builtin variables are the app's job; only the buyer-facing ones are listed.
    assert [v["key"] for v in version["required_variables"]] == ["gmail_user", "smtp_pass"]

    # 3. Both secrets are reported by path — and nothing but the path.
    scan = version["scan"]
    assert scan["embedded_credentials_count"] == 2
    assert scan["credential_paths"] == ["nodes[2].data.aiLlmOpenaiApiKey", "variables.smtp_pass"]
    assert scan["uses_shell"] is True
    assert OPENAI_SECRET not in r.text
    assert SMTP_SECRET not in r.text

    # 4. Nothing written to disk contains a secret (the raw package is never stored).
    blobs = _stored_blobs(storage_root)
    assert "openConnect" in blobs, "the scrubbed graph should have been stored"
    assert OPENAI_SECRET not in blobs
    assert SMTP_SECRET not in blobs

    # 5. Submit for review, then approval is refused while secrets remain.
    r = await client.post(f"/api/v1/sellers/me/scripts/{script_id}/submit", headers=auth(seller))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_review"

    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{version['id']}/approve",
        headers=auth(admin),
    )
    assert r.status_code == 409, r.text
    assert r.json()["code"] == "credentials_present"

    # 6. Seller re-uploads a clean build → admin approves → script goes live.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/versions",
        data={"version": "1.0.1", "changelog": "removed secrets", "min_app_version": "1.4.0"},
        files=upload_files(mini_app_zip(with_secrets=False)),
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    clean_version = r.json()
    assert clean_version["scan"]["embedded_credentials_count"] == 0

    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{clean_version['id']}/approve",
        headers=auth(admin),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"

    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    published = r.json()
    assert published["status"] == "published"
    assert published["latest_version"] == "1.0.1"
    assert published["latest_version_id"] == clean_version["id"]
    assert published["min_app_version"] == "1.4.0"
    assert published["node_count"] == 8
    assert published["capabilities"]["uses_shell"] is True
    assert published["published_at"] is not None


async def test_inspect_previews_the_package_and_names_the_script(
    client: httpx.AsyncClient, storage_root: Path
) -> None:
    """Selecting a file shows what the store derived — and saves nothing."""
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)

    r = await client.post(
        "/api/v1/sellers/me/scripts/inspect",
        files=upload_files(mini_app_zip()),
        headers=auth(seller),
    )
    assert r.status_code == 200, r.text
    preview = r.json()
    assert preview["suggested_name"] == "Gmail Auto Register"
    assert preview["app_id"] == "com.hideflow.mini.gmail-auto-register"
    assert preview["node_count"] == 8
    assert preview["capabilities"]["uses_shell"] is True
    assert preview["scan"]["embedded_credentials_count"] == 2
    assert OPENAI_SECRET not in r.text

    # A preview is not a publish: nothing in the listing, nothing on disk.
    r = await client.get("/api/v1/sellers/me/scripts", headers=auth(seller))
    assert r.json()["total"] == 0
    assert _stored_blobs(storage_root) == ""

    # Uploading without a name falls back to the mini app's own name.
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"version": "1.0.0"},
        files=upload_files(mini_app_zip(with_secrets=False)),
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    assert r.json()["name"] == "Gmail Auto Register"
    assert r.json()["slug"] == "gmail-auto-register"


async def test_rejected_version_keeps_the_published_one(client: httpx.AsyncClient) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)

    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Warmup Bot", "version": "1.0.0"},
        files=upload_files(mini_app_zip(with_secrets=False)),
        headers=auth(seller),
    )
    script_id = r.json()["id"]
    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    first_version_id = r.json()["versions"][0]["id"]

    await client.post(f"/api/v1/sellers/me/scripts/{script_id}/submit", headers=auth(seller))
    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{first_version_id}/approve",
        headers=auth(admin),
    )
    assert r.status_code == 200, r.text

    # A later version is rejected — the live listing keeps serving 1.0.0.
    r = await client.post(
        f"/api/v1/sellers/me/scripts/{script_id}/versions",
        data={"version": "1.1.0"},
        files=upload_files(mini_app_zip()),
        headers=auth(seller),
    )
    bad_version_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{bad_version_id}/reject",
        json={"reason": "remove the embedded API key"},
        headers=auth(admin),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rejected"
    assert r.json()["moderation"]["reason"] == "remove the embedded API key"

    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(seller))
    detail = r.json()
    assert detail["status"] == "published"
    assert detail["latest_version"] == "1.0.0"

    # Re-reviewing a decided version is refused.
    r = await client.post(
        f"/api/v1/admin/scripts/{script_id}/versions/{bad_version_id}/approve",
        headers=auth(admin),
    )
    assert r.status_code == 409, r.text


async def test_upload_rejections_and_ownership(client: httpx.AsyncClient) -> None:
    admin = await admin_token(client)
    seller = await approved_seller_token(client, admin)
    other = await approved_seller_token(client, admin, email="other@teststore.com")

    # Not a mini-app package.
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Junk Upload", "version": "1.0.0"},
        files=upload_files(b"not-a-zip-at-all", name="junk.bin"),
        headers=auth(seller),
    )
    assert r.status_code == 422, r.text

    # A rejected upload must not leave an empty draft (and must not burn a slug).
    r = await client.get("/api/v1/sellers/me/scripts", headers=auth(seller))
    assert r.json()["total"] == 0, r.text

    # Encrypted .hideflow exports are explicitly out of scope for now.
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Encrypted Export", "version": "1.0.0"},
        files=upload_files(b"HFLW-encrypted-blob", name="flow.hideflow"),
        headers=auth(seller),
    )
    assert r.status_code == 422, r.text
    assert ".hideflow" in r.json()["detail"]
    # Clients translate `code`; `detail` stays English for logs.
    assert r.json()["code"] == "hideflow_encrypted"

    # A zip without resources/app.workflow.
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("readme.txt", b"hello")
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Empty Package", "version": "1.0.0"},
        files=upload_files(buffer.getvalue()),
        headers=auth(seller),
    )
    assert r.status_code == 422, r.text

    # A bare graph .json is accepted.
    r = await client.post(
        "/api/v1/sellers/me/scripts",
        data={"name": "Graph Only", "version": "1.0.0"},
        files={"file": ("graph.json", json.dumps(graph(with_secrets=False)), "application/json")},
        headers=auth(seller),
    )
    assert r.status_code == 201, r.text
    script_id = r.json()["id"]

    # Another seller cannot read or version someone else's script.
    r = await client.get(f"/api/v1/sellers/me/scripts/{script_id}", headers=auth(other))
    assert r.status_code == 403, r.text

    # Submitting twice is refused (already pending review).
    await client.post(f"/api/v1/sellers/me/scripts/{script_id}/submit", headers=auth(seller))
    r = await client.post(f"/api/v1/sellers/me/scripts/{script_id}/submit", headers=auth(seller))
    assert r.status_code == 409, r.text
