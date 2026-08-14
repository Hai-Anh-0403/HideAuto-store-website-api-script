"""Seed a seller with mini apps, keys and users — dev only, never run in prod.

Calls the services directly (no HTTP), so the API server does not have to be running:

    cd api && uv run python scripts/seed_demo.py                    # seller demo mặc định
    cd api && uv run python scripts/seed_demo.py admin@gmail.com    # seller có sẵn

Idempotent: mini apps are matched per seller by name, so running it twice adds nothing.
Memberships are inserted straight into Mongo because redeeming a key needs a real
flowdesk token, which a local seed cannot produce.
"""

import asyncio
import io
import json
import sys
import zipfile
from dataclasses import dataclass
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

DEFAULT_EMAIL = "demo-seller@storeauto.dev"
DEFAULT_PASSWORD = "seller12345"
DEFAULT_NAME = "AutoHide Studio"

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


@dataclass(frozen=True)
class AppSpec:
    name: str
    short_description: str
    state: str  # draft | pending | published | rejected
    workflow: dict[str, Any]
    build: bool = False
    keys: tuple[KeyCreate, ...] = ()


APPS: list[AppSpec] = [
    AppSpec(
        name="Facebook Warmup",
        short_description="Nuôi tài khoản Facebook theo kịch bản từ Google Sheet.",
        state="published",
        build=True,
        keys=(
            KeyCreate(label="Batch tháng 8", max_uses=50),
            KeyCreate(label="Khóa thử — đã thu hồi", max_uses=5),
        ),
        workflow=graph(
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
        ),
    ),
    AppSpec(
        name="Gmail Auto Register",
        short_description="Tạo Gmail hàng loạt, tự giải 2FA.",
        state="published",
        build=True,
        keys=(KeyCreate(label="Khách lẻ", max_uses=None),),
        workflow=graph(
            [
                browser("hidemium", proxy=True, fingerprint=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://accounts.google.com/signup"),
                node("n3", "typeText", typeTextValue="{{gmail_user}}"),
                node("n4", "getCode2Fa"),
                node("n5", "writeFile", writeFileType="csv"),
                {"id": "n6", "type": "ifElse", "data": {"code": "ifElse"}},
            ],
            [{"key": "gmail_user", "value": ""}, {"key": "out_path", "value": ""}],
        ),
    ),
    AppSpec(
        name="Shopee Flash Sale",
        short_description="Canh sale, thêm giỏ và đặt hàng tự động.",
        state="published",
        build=True,
        keys=(KeyCreate(label="Gói 30 ngày", max_uses=30),),
        workflow=graph(
            [
                browser("adspower", proxy=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://shopee.vn/flash_sale"),
                node("n3", "waitForSelector", waitForSelectorSelector=".flash-sale-item"),
                node("n4", "clickElement", clickElementSelector=".btn-add-to-cart"),
                node("n5", "writeSpreadsheet", writeSpreadsheetSource="localFile"),
                {"id": "n6", "type": "loop", "data": {"code": "loop"}},
            ],
            [{"key": "product_url", "value": ""}, {"key": "max_price", "value": ""}],
        ),
    ),
    AppSpec(
        name="Amazon Review Scraper",
        short_description="Thu thập review theo ASIN, xuất CSV.",
        state="published",
        keys=(KeyCreate(label="Tháng 8", max_uses=10),),
        workflow=graph(
            [
                browser("builtin"),
                node("n2", "gotoUrl", gotoUrlUrl="https://amazon.com/dp/{{asin}}"),
                node("n3", "getText", getTextSelector="[data-hook=review-body]"),
                node("n4", "extractionInText"),
                node("n5", "writeFile", writeFileType="csv"),
                {"id": "n6", "type": "loop", "data": {"code": "loop"}},
            ],
            [{"key": "asin", "value": ""}, {"key": "out_path", "value": ""}],
        ),
    ),
    AppSpec(
        name="Zalo Broadcast",
        short_description="Gửi tin hàng loạt qua Zalo Web, có báo cáo mail.",
        state="published",
        keys=(KeyCreate(label="Khóa VIP", max_uses=None),),
        workflow=graph(
            [
                browser("gpmLogin", fingerprint=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://chat.zalo.me"),
                node("n3", "typeText", typeTextValue="{{message}}"),
                node("n4", "pressKey", pressKeyKey="Enter"),
                node("n5", "sendMailSftp"),
                node("n6", "readSpreadsheet", readSpreadsheetSource="googleSheet"),
            ],
            [{"key": "message", "value": ""}, {"key": "sheet_id", "value": ""}],
        ),
    ),
    AppSpec(
        name="Tiktok Scraper",
        short_description="Thu thập video theo hashtag, xuất CSV.",
        state="pending",
        workflow=graph(
            [
                browser("builtin"),
                node("n2", "gotoUrl", gotoUrlUrl="https://tiktok.com/tag/{{tag}}"),
                node("n3", "waitForSelector", waitForSelectorSelector="[data-e2e=video]"),
                node("n4", "getText", getTextSelector="[data-e2e=video-desc]"),
                node("n5", "writeFile", writeFileType="csv"),
                {"id": "n6", "type": "loop", "data": {"code": "loop"}},
            ],
            [{"key": "tag", "value": ""}, {"key": "out_path", "value": ""}],
        ),
    ),
    AppSpec(
        name="Discord Auto Join",
        short_description="Vào server hàng loạt bằng link mời.",
        state="pending",
        workflow=graph(
            [
                browser("adspower", proxy=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://discord.com/invite/{{invite}}"),
                node("n3", "clickElement", clickElementSelector="button[type=submit]"),
                node("n4", "mouseMove"),
                node("n5", "addLog"),
            ],
            [{"key": "invite", "value": ""}],
        ),
    ),
    # Cố tình để lộ credential: đây là bản để thử luồng cảnh báo + chặn duyệt.
    AppSpec(
        name="Shopee Auto Post",
        short_description="Đăng sản phẩm hàng loạt lên Shopee.",
        state="draft",
        workflow=graph(
            [
                browser("adspower", proxy=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://banhang.shopee.vn"),
                node("n3", "typeText", typeTextValue="{{shop_user}}"),
                node("n4", "sendMailSftp", sendMailSftpPassword="Sh0pee!RealPass"),
                node("n5", "writeSpreadsheet", writeSpreadsheetSource="localFile"),
            ],
            [{"key": "shop_user", "value": ""}, {"key": "smtp_pass", "value": "another-secret"}],
        ),
    ),
    AppSpec(
        name="Youtube Comment Bot",
        short_description="Bình luận bằng AI theo nội dung video.",
        state="draft",
        workflow=graph(
            [
                browser("hidemium", fingerprint=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://youtube.com/watch?v={{video_id}}"),
                node("n3", "aiLlm", aiLlmProvider="openai", aiLlmOpenaiApiKey="sk-live-LEAK-123"),
                node("n4", "typeText", typeTextValue="{{comment}}"),
                node("n5", "runCommand", runCommandCommand="powershell -c Get-Date"),
            ],
            [{"key": "video_id", "value": ""}, {"key": "comment", "value": ""}],
        ),
    ),
    AppSpec(
        name="Instagram DM Bot",
        short_description="Trả lời DM bằng AI.",
        state="rejected",
        workflow=graph(
            [
                browser("gpmLogin", fingerprint=True),
                node("n2", "gotoUrl", gotoUrlUrl="https://instagram.com/direct"),
                node("n3", "aiLlm", aiLlmProvider="claude", aiLlmPrompt="Chào {{name}}"),
                node("n4", "getCode2Fa"),
                node("n5", "runCommand", runCommandCommand="powershell -c Get-Date"),
                {"id": "n6", "type": "ifElse", "data": {"code": "ifElse"}},
            ],
            [{"key": "name", "value": ""}, {"key": "openai_key", "value": ""}],
        ),
    ),
]


@dataclass(frozen=True)
class MemberSpec:
    user_id: str
    email: str
    name: str
    device_minutes: tuple[int, ...]  # mỗi máy: thấy lần cuối cách đây bao nhiêu phút
    apps: int = 1  # số mini app đã mở khoá (lấy từ đầu danh sách published)
    all_scripts: bool = False
    blocked: bool = False
    blocked_devices: int = 0  # chặn N máy cuối


MEMBERS: list[MemberSpec] = [
    MemberSpec("seed-user-1", "an.nguyen@example.com", "Nguyễn An", (1, 3), apps=3),
    MemberSpec("seed-user-2", "binh.tran@example.com", "Trần Bình", (190,), apps=1),
    MemberSpec("seed-user-3", "chi.le@example.com", "Lê Chi", (2880,), apps=2, blocked=True),
    MemberSpec(
        "seed-user-4",
        "dung.pham@example.com",
        "Phạm Dũng",
        (2, 40, 900),
        all_scripts=True,
        blocked_devices=1,
    ),
    MemberSpec("seed-user-5", "em.hoang@example.com", "Hoàng Em", (4,), apps=5),
    MemberSpec("seed-user-6", "phuc.vo@example.com", "Võ Phúc", (60, 61), apps=2),
    MemberSpec("seed-user-7", "giang.do@example.com", "Đỗ Giang", (1440,), apps=1),
    MemberSpec("seed-user-8", "hoa.ngo@example.com", "Ngô Hoa", (3, 8, 15), apps=4),
    MemberSpec("seed-user-9", "khanh.bui@example.com", "Bùi Khánh", (10080,), apps=1, blocked=True),
    MemberSpec("seed-user-10", "linh.dang@example.com", "Đặng Linh", (2,), all_scripts=True),
    MemberSpec(
        "seed-user-11", "minh.ha@example.com", "Hà Minh", (330, 700), apps=3, blocked_devices=1
    ),
    MemberSpec("seed-user-12", "nam.ly@example.com", "Lý Nam", (5,), apps=2),
]


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


async def get_seller(email: str) -> Seller:
    """Dùng seller có sẵn; chỉ tạo mới khi email chưa tồn tại."""
    seller = await seller_repo.get_by_email(email)
    if seller is None:
        seller = await seller_repo.insert(
            Seller(
                email=email,
                password_hash=hash_password(DEFAULT_PASSWORD),
                name=DEFAULT_NAME,
            )
        )
        print(f"  + tạo seller {email} / {DEFAULT_PASSWORD}")
    if seller.status != SellerStatus.APPROVED:
        seller.status = SellerStatus.APPROVED
        seller.approved_at = datetime.now(UTC)
        await seller.save()
        print("  ~ seller → approved")
    return seller


async def publish(seller: Seller, admin_id: Any, spec: AppSpec) -> Script | None:
    """Create one mini app for this seller and drive it to the state the spec asks for."""
    seller_id = require_id(seller.id)
    existing = await script_repo.get_by_seller_and_name(seller_id, spec.name)
    if existing is not None:
        return existing

    script = await script_service.create_script(
        seller,
        ScriptCreate(
            name=spec.name,
            version="1.0.0",
            short_description=spec.short_description,
            min_app_version="1.4.0",
        ),
        content=package(spec.name, spec.workflow),
        filename=f"{slugify(spec.name)}.zip",
    )
    script_id = require_id(script.id)

    if spec.state == "draft":
        print(f"  + {spec.name} → draft")
        return script

    await script_service.submit_for_review(seller, script_id)
    versions = await version_repo.list_for_script(script_id)
    version_id = require_id(versions[0].id)

    if spec.state == "pending":
        print(f"  + {spec.name} → pending_review")
        return script
    if spec.state == "rejected":
        await script_service.reject_version(
            admin_id, script_id, version_id, "Bỏ node runCommand rồi gửi lại giúp mình."
        )
        print(f"  + {spec.name} → rejected")
        return await script_repo.get_by_id(script_id)

    await script_service.approve_version(admin_id, script_id, version_id)
    print(f"  + {spec.name} → published")
    return await script_repo.get_by_id(script_id)


async def seed_keys(seller: Seller, script: Script, spec: AppSpec) -> list[SellerKey]:
    seller_id = require_id(seller.id)
    script_id = require_id(script.id)
    existing = await key_service.list_script_keys(seller_id, script_id)
    if existing or not spec.keys:
        return existing

    created: list[SellerKey] = []
    for index, payload in enumerate(spec.keys):
        key = await key_service.create_script_key(seller_id, script_id, payload)
        # Bản cuối của app đầu tiên để trạng thái đã thu hồi, cho có đủ trạng thái để xem.
        if len(spec.keys) > 1 and index == len(spec.keys) - 1:
            key.status = KeyStatus.REVOKED
            await key.save()
        created.append(key)
    print(f"  + {len(created)} khóa cho {spec.name}")
    return created


def device(machine_id: str, os_name: str, minutes_ago: int) -> dict[str, Any]:
    seen = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    return {
        "id": f"dev-{machine_id}",
        "machineId": machine_id,
        "name": f"{os_name} · {machine_id}",
        "os": os_name,
        "lastSeenAt": seen.isoformat().replace("+00:00", "Z"),
    }


OS_CYCLE = ("Windows", "Windows", "macOS", "Linux")


async def seed_member(
    seller: Seller, key: SellerKey, spec: MemberSpec, published: list[Script]
) -> None:
    """Insert a membership directly — redeeming needs a flowdesk token we cannot mint."""
    devices = [
        device(f"{spec.user_id.upper()}-M{i + 1}", OS_CYCLE[i % len(OS_CYCLE)], minutes)
        for i, minutes in enumerate(spec.device_minutes)
    ]
    last_seen = max(
        (datetime.fromisoformat(d["lastSeenAt"].replace("Z", "+00:00")) for d in devices),
        default=None,
    )
    blocked_devices = [d["machineId"] for d in devices[len(devices) - spec.blocked_devices :]]

    existing = await member_repo.get(require_id(seller.id), spec.user_id)
    if existing is not None:
        # Re-running the seed re-dates the devices, so the "online" demo keeps working.
        existing.devices = devices
        existing.last_seen_at = last_seen
        existing.usage_synced_at = datetime.now(UTC)
        await existing.save()
        return

    await member_repo.insert(
        SellerMember(
            seller_id=require_id(seller.id),
            key_id=require_id(key.id),
            user_id=spec.user_id,
            user_email=spec.email,
            user_name=spec.name,
            status=MemberStatus.BLOCKED if spec.blocked else MemberStatus.ACTIVE,
            script_ids=[]
            if spec.all_scripts
            else [require_id(s.id) for s in published[: spec.apps]],
            all_scripts=spec.all_scripts,
            devices=devices,
            last_seen_at=last_seen,
            usage_synced_at=datetime.now(UTC),
            blocked_devices=blocked_devices,
        )
    )
    print(f"  + user {spec.email}")


async def main(email: str) -> None:
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

        print(f"Seller: {email}")
        seller = await get_seller(email)

        print("Mini app:")
        scripts: dict[str, Script] = {}
        for spec in APPS:
            script = await publish(seller, admin_id, spec)
            if script is not None:
                scripts[spec.name] = script

        print("Khóa & đóng gói:")
        first_key: SellerKey | None = None
        for spec in APPS:
            script = scripts.get(spec.name)
            if script is None:
                continue
            keys = await seed_keys(seller, script, spec)
            first_key = first_key or next((k for k in keys if k.status == KeyStatus.ACTIVE), None)
            if spec.build and script.status == ScriptStatus.PUBLISHED and not script.has_mini_app:
                try:
                    await mini_app_service.create_build(seller, require_id(script.id))
                    print(f"  + gói .zip cho {spec.name}")
                except Exception as exc:  # noqa: BLE001 — seed không được chết vì build
                    print(f"  = build {spec.name}: {exc}")

        wide_keys = [
            k for k in await key_service.list_keys(require_id(seller.id)) if k.script_id is None
        ]
        wide_key = (
            wide_keys[0]
            if wide_keys
            else await key_service.create_key(
                require_id(seller.id), KeyCreate(label="Khóa toàn shop", max_uses=None)
            )
        )
        fallback = first_key or wide_key

        print("Người dùng:")
        published = [s for s in scripts.values() if s.status == ScriptStatus.PUBLISHED]
        for member in MEMBERS:
            await seed_member(
                seller, wide_key if member.all_scripts else fallback, member, published
            )

        print(f"\nXong. Đăng nhập UI bằng {email}.")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_EMAIL))
