"""Seed a demo seller with mini apps in every state — dev only, never run in prod.

Calls the services directly (no HTTP), so the API server does not have to be running:

    cd api && uv run python scripts/seed_demo.py

Idempotent: mini apps are keyed by slug and skipped if they already exist. Memberships
are inserted straight into Mongo because redeeming a key needs a real flowdesk token,
which a local seed cannot produce.
"""

import asyncio
import io
import json
import sys
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import close_db, init_db  # noqa: E402
from app.core.enums import KeyStatus, MemberStatus, ScriptStatus, SellerStatus  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.script import Script  # noqa: E402
from app.models.seller import Seller  # noqa: E402
from app.models.seller_key import SellerKey  # noqa: E402
from app.models.seller_member import SellerMember  # noqa: E402
from app.repositories import admin as admin_repo  # noqa: E402
from app.repositories import script as script_repo  # noqa: E402
from app.repositories import script_version as version_repo  # noqa: E402
from app.repositories import seller as seller_repo  # noqa: E402
from app.repositories import seller_member as member_repo  # noqa: E402
from app.schemas.script import ScriptCreate  # noqa: E402
from app.schemas.seller_key import KeyCreate  # noqa: E402
from app.services import key_service, mini_app_service, script_service  # noqa: E402
from app.services.admin_service import seed_initial_admin  # noqa: E402
from app.utils.ids import require_id, slugify  # noqa: E402

SELLER_EMAIL = "demo-seller@storeauto.dev"
SELLER_PASSWORD = "seller12345"
SELLER_NAME = "AutoHide Studio"

# Cùng đường dẫn mà compose mount vào container API, để native và Docker dùng chung file.
TEMPLATE_PATH = Path(__file__).resolve().parents[1] / "var" / "mini-app-template.zip"


# --- graph fixtures ------------------------------------------------------------------


def node(nid: str, code: str, **data: Any) -> dict[str, Any]:
    return {"id": nid, "type": "basic", "data": {"code": code, **data}}


def browser(platform: str, *, proxy: bool = False, fingerprint: bool = False) -> dict[str, Any]:
    data: dict[str, Any] = {"openConnectMode": "otherApp", "openConnectPlatform": platform}
    if platform == "builtin":
        data = {"openConnectMode": "defaultProfile"}
    if proxy:
        data["openConnectProxyEnabled"] = True
    if fingerprint:
        data["openConnectFingerprintUserAgent"] = "Mozilla/5.0"
    return node("n1", "openConnect", **data)


def graph(nodes: list[dict[str, Any]], variables: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "nodes": nodes,
        "edges": [],
        "variables": [
            {"id": "b1", "key": "profile_uuid", "value": ""},
            *[{"id": f"v{i}", **v} for i, v in enumerate(variables, start=1)],
        ],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def package(app_name: str, workflow: dict[str, Any]) -> bytes:
    """A mini-app package exactly like the desktop app writes it."""
    envelope = {
        "version": 1,
        "appName": app_name,
        "appId": f"com.hideflow.mini.{slugify(app_name)}",
        "workflowId": f"wf-{slugify(app_name)}",
        "workflowName": app_name,
        "builtAt": datetime.now(UTC).isoformat(),
        "workflow": workflow,
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{app_name}.exe", b"MZ-dev-seed-binary")
        archive.writestr("resources/app.asar", b"dev-seed-asar")
        archive.writestr("resources/app.workflow", json.dumps(envelope, indent=2))
    return buffer.getvalue()


FACEBOOK = graph(
    [
        browser("hidemium", proxy=True, fingerprint=True),
        node("n2", "gotoUrl", gotoUrlUrl="https://facebook.com"),
        node("n3", "scroll", scrollMode="by"),
        node("n4", "clickElement", clickElementSelector="[aria-label='Like']"),
        node("n5", "readSpreadsheet", readSpreadsheetSource="googleSheet"),
        node("n6", "pause", pauseMode="random"),
        {"id": "n7", "type": "loop", "data": {"code": "loop"}},
    ],
    [{"key": "sheet_id", "value": ""}, {"key": "keyword", "value": ""}],
)

TIKTOK = graph(
    [
        browser("builtin"),
        node("n2", "gotoUrl", gotoUrlUrl="https://tiktok.com/tag/{{tag}}"),
        node("n3", "waitForSelector", waitForSelectorSelector="[data-e2e=video]"),
        node("n4", "getText", getTextSelector="[data-e2e=video-desc]"),
        node("n5", "writeFile", writeFileType="csv"),
        {"id": "n6", "type": "loop", "data": {"code": "loop"}},
    ],
    [{"key": "tag", "value": ""}, {"key": "out_path", "value": ""}],
)

# Left dirty on purpose: shows the scan warning + blocks approval in the UI.
SHOPEE = graph(
    [
        browser("adspower", proxy=True),
        node("n2", "gotoUrl", gotoUrlUrl="https://banhang.shopee.vn"),
        node("n3", "typeText", typeTextValue="{{shop_user}}"),
        node("n4", "sendMailSftp", sendMailSftpPassword="Sh0pee!RealPass"),
        node("n5", "writeSpreadsheet", writeSpreadsheetSource="localFile"),
    ],
    [{"key": "shop_user", "value": ""}, {"key": "smtp_pass", "value": "another-real-secret"}],
)

INSTAGRAM = graph(
    [
        browser("gpmLogin", fingerprint=True),
        node("n2", "gotoUrl", gotoUrlUrl="https://instagram.com/direct"),
        node("n3", "aiLlm", aiLlmProvider="claude", aiLlmPrompt="Viết tin nhắn chào {{name}}"),
        node("n4", "getCode2Fa"),
        node("n5", "runCommand", runCommandCommand="powershell -c Get-Date"),
        {"id": "n6", "type": "ifElse", "data": {"code": "ifElse"}},
    ],
    [{"key": "name", "value": ""}, {"key": "openai_key", "value": ""}],
)


# --- seeding -------------------------------------------------------------------------


def write_dev_template() -> None:
    """A stand-in for a packaged hideflow build, so the packaging tab has something."""
    if TEMPLATE_PATH.exists():
        return
    TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("hideflow.exe", b"MZ-dev-template-binary")
        archive.writestr("resources/app.asar", b"dev-template-asar")
    TEMPLATE_PATH.write_bytes(buffer.getvalue())


async def get_seller() -> Seller:
    seller = await seller_repo.get_by_email(SELLER_EMAIL)
    if seller is None:
        seller = await seller_repo.insert(
            Seller(
                email=SELLER_EMAIL,
                password_hash=hash_password(SELLER_PASSWORD),
                name=SELLER_NAME,
            )
        )
        print(f"  + seller {SELLER_EMAIL} / {SELLER_PASSWORD}")
    if seller.status != SellerStatus.APPROVED:
        seller.status = SellerStatus.APPROVED
        seller.approved_at = datetime.now(UTC)
        await seller.save()
        print("  ~ seller → approved")
    return seller


async def publish(
    seller: Seller,
    admin_id: Any,
    *,
    name: str,
    workflow: dict[str, Any],
    state: str,
    short_description: str,
) -> Script | None:
    """Create one mini app and drive it to `state` (draft/pending/published/rejected)."""
    existing = await script_repo.get_by_slug(slugify(name))
    if existing is not None:
        print(f"  = {name} (đã có, bỏ qua)")
        return existing

    script = await script_service.create_script(
        seller,
        ScriptCreate(
            name=name,
            version="1.0.0",
            short_description=short_description,
            min_app_version="1.4.0",
        ),
        content=package(name, workflow),
        filename=f"{slugify(name)}.zip",
    )
    script_id = require_id(script.id)

    if state == "draft":
        print(f"  + {name} → draft")
        return script

    await script_service.submit_for_review(seller, script_id)
    versions = await version_repo.list_for_script(script_id)
    version_id = require_id(versions[0].id)

    if state == "pending":
        print(f"  + {name} → pending_review")
        return script
    if state == "rejected":
        await script_service.reject_version(
            admin_id, script_id, version_id, "Bỏ node runCommand rồi gửi lại giúp mình."
        )
        print(f"  + {name} → rejected")
        return await script_repo.get_by_id(script_id)

    await script_service.approve_version(admin_id, script_id, version_id)
    print(f"  + {name} → published")
    return await script_repo.get_by_id(script_id)


async def add_key(
    seller: Seller, script: Script, label: str, *, max_uses: int | None, revoked: bool = False
) -> SellerKey:
    key = await key_service.create_script_key(
        require_id(seller.id), require_id(script.id), KeyCreate(label=label, max_uses=max_uses)
    )
    if revoked:
        key.status = KeyStatus.REVOKED
        await key.save()
    return key


def device(machine_id: str, os_name: str, minutes_ago: int) -> dict[str, Any]:
    seen = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    return {
        "id": f"dev-{machine_id}",
        "machineId": machine_id,
        "name": f"{os_name} · {machine_id}",
        "os": os_name,
        "lastSeenAt": seen.isoformat().replace("+00:00", "Z"),
    }


async def add_member(
    seller: Seller,
    key: SellerKey,
    *,
    user_id: str,
    email: str,
    name: str,
    script_ids: list[Any],
    devices: list[dict[str, Any]],
    status: MemberStatus = MemberStatus.ACTIVE,
    blocked_devices: list[str] | None = None,
    all_scripts: bool = False,
) -> None:
    """Insert a membership directly — redeeming needs a flowdesk token we cannot mint."""
    last_seen = max(
        (datetime.fromisoformat(d["lastSeenAt"].replace("Z", "+00:00")) for d in devices),
        default=None,
    )

    existing = await member_repo.get(require_id(seller.id), user_id)
    if existing is not None:
        # Re-running the seed re-dates the devices, so the "online" demo keeps working.
        existing.devices = devices
        existing.last_seen_at = last_seen
        existing.usage_synced_at = datetime.now(UTC)
        await existing.save()
        print(f"  ~ member {email} (làm mới thời điểm online)")
        return

    await member_repo.insert(
        SellerMember(
            seller_id=require_id(seller.id),
            key_id=require_id(key.id),
            user_id=user_id,
            user_email=email,
            user_name=name,
            status=status,
            script_ids=script_ids,
            all_scripts=all_scripts,
            devices=devices,
            last_seen_at=last_seen,
            usage_synced_at=datetime.now(UTC),
            blocked_devices=blocked_devices or [],
        )
    )
    key.used_count += 1
    await key.save()
    print(f"  + member {email}")


async def main() -> None:
    if settings.env not in ("dev", "local", "test"):
        raise SystemExit(f"Refusing to seed with ENV={settings.env}")

    write_dev_template()
    if not settings.mini_app_template_path:
        settings.mini_app_template_path = str(TEMPLATE_PATH)

    await init_db()
    try:
        await seed_initial_admin()
        admin = await admin_repo.get_by_email(settings.initial_admin_email or "")
        if admin is None:
            raise SystemExit("No admin found — set INITIAL_ADMIN_EMAIL/PASSWORD in .env")
        admin_id = require_id(admin.id)

        print("Seller:")
        seller = await get_seller()

        print("Mini app:")
        facebook = await publish(
            seller,
            admin_id,
            name="Facebook Warmup",
            workflow=FACEBOOK,
            state="published",
            short_description="Nuôi tài khoản Facebook theo kịch bản từ Google Sheet.",
        )
        await publish(
            seller,
            admin_id,
            name="Tiktok Scraper",
            workflow=TIKTOK,
            state="pending",
            short_description="Thu thập video theo hashtag, xuất CSV.",
        )
        await publish(
            seller,
            admin_id,
            name="Shopee Auto Post",
            workflow=SHOPEE,
            state="draft",
            short_description="Đăng sản phẩm hàng loạt lên Shopee.",
        )
        await publish(
            seller,
            admin_id,
            name="Instagram DM Bot",
            workflow=INSTAGRAM,
            state="rejected",
            short_description="Trả lời DM bằng AI.",
        )

        gmail = await script_repo.get_by_slug("gmail-auto-register")

        print("Khóa & người dùng:")
        if facebook is not None and facebook.status == ScriptStatus.PUBLISHED:
            try:
                await mini_app_service.create_build(seller, require_id(facebook.id))
                print("  + build .zip cho Facebook Warmup")
            except Exception as exc:  # noqa: BLE001 — seeding must not die on a re-run
                print(f"  = build Facebook Warmup: {exc}")

            existing = await key_service.list_script_keys(
                require_id(seller.id), require_id(facebook.id)
            )
            if existing:
                fb_key = existing[-1]
                print("  = khóa Facebook Warmup (đã có, bỏ qua)")
            else:
                fb_key = await add_key(seller, facebook, "Batch tháng 8", max_uses=50)
                await add_key(seller, facebook, "Khóa thử — đã thu hồi", max_uses=5, revoked=True)
                print("  + 2 khóa cho Facebook Warmup")

            gmail_ids = [require_id(gmail.id)] if gmail is not None else []
            await add_member(
                seller,
                fb_key,
                user_id="seed-user-1",
                email="an.nguyen@example.com",
                name="Nguyễn An",
                script_ids=[require_id(facebook.id), *gmail_ids],
                devices=[device("PC-AN-01", "Windows", 1), device("LAP-AN-02", "Windows", 3)],
            )
            await add_member(
                seller,
                fb_key,
                user_id="seed-user-2",
                email="binh.tran@example.com",
                name="Trần Bình",
                script_ids=[require_id(facebook.id)],
                devices=[device("PC-BINH-01", "Windows", 190)],
            )
            await add_member(
                seller,
                fb_key,
                user_id="seed-user-3",
                email="chi.le@example.com",
                name="Lê Chi",
                script_ids=gmail_ids,
                devices=[device("MAC-CHI-01", "macOS", 2880)],
                status=MemberStatus.BLOCKED,
            )

            all_keys = await key_service.list_keys(require_id(seller.id))
            wide_key = next((k for k in all_keys if k.script_id is None), None)
            if wide_key is None:
                wide_key = await key_service.create_key(
                    require_id(seller.id), KeyCreate(label="Khóa toàn shop", max_uses=None)
                )
                print("  + khóa toàn shop")
            await add_member(
                seller,
                wide_key,
                user_id="seed-user-4",
                email="dung.pham@example.com",
                name="Phạm Dũng",
                script_ids=[],
                all_scripts=True,
                devices=[
                    device("PC-DUNG-01", "Windows", 2),
                    device("PC-DUNG-02", "Windows", 40),
                    device("LNX-DUNG-03", "Linux", 900),
                ],
                blocked_devices=["LNX-DUNG-03"],
            )

        print(f"\nXong. Đăng nhập UI: {SELLER_EMAIL} / {SELLER_PASSWORD}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
