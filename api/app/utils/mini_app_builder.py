"""Repackage a mini app: copy the empty template and inject `resources/app.workflow`.

This is the server-side variant of the app's `buildMiniApp()`. It is pure file work, so
it runs anywhere — but it cannot rename the exe or swap its icon (that needs `rcedit` on
Windows); a build agent can do that later. See `docs/script-publish-packaging.md` §4.
"""

import io
import json
import zipfile
from datetime import UTC, datetime
from typing import Any

from app.core.exceptions import AppError
from app.utils.mini_app_package import APP_WORKFLOW_ENTRY, MAX_ARCHIVE_ENTRIES, ZIP_MAGIC

EMBED_FORMAT_VERSION = 1


def build_envelope(
    *,
    app_name: str,
    app_id: str,
    workflow_id: str,
    workflow_name: str,
    graph: dict[str, Any],
    store: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The exact shape the desktop app expects to find in `resources/app.workflow`.

    `store` is the activation block (see `build_store_block`). Older app builds ignore
    unknown keys, so a package carrying it still opens in an app without the licence
    gate — it just won't ask for a key.
    """
    envelope: dict[str, Any] = {
        "version": EMBED_FORMAT_VERSION,
        "appName": app_name,
        "appId": app_id,
        "workflowId": workflow_id,
        "workflowName": workflow_name,
        "builtAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "workflow": graph,
    }
    if store is not None:
        envelope["store"] = store
    return envelope


def build_store_block(
    *, script_id: str, seller_name: str, base_url: str, public_key: str
) -> dict[str, Any]:
    """Everything the packaged mini app needs to activate itself:
    who to call, which mini app it is, and the key that proves the answer is ours."""
    return {
        "baseUrl": base_url.rstrip("/"),
        "scriptId": script_id,
        "sellerName": seller_name,
        "licensePublicKey": public_key,
        "licenseAlgorithm": "Ed25519",
    }


def inject_workflow(template: bytes, envelope: dict[str, Any]) -> bytes:
    """Return a copy of the template archive carrying this workflow."""
    if not template.startswith(ZIP_MAGIC):
        raise AppError("Mini-app template is not a zip archive", status_code=500)

    payload = json.dumps(envelope, ensure_ascii=False, indent=2).encode("utf-8")
    out = io.BytesIO()
    try:
        with (
            zipfile.ZipFile(io.BytesIO(template)) as source,
            zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as target,
        ):
            infos = source.infolist()
            if len(infos) > MAX_ARCHIVE_ENTRIES:
                raise AppError("Mini-app template has too many entries", status_code=500)
            for info in infos:
                if info.filename.replace("\\", "/").lower().endswith(APP_WORKFLOW_ENTRY):
                    continue  # replaced below
                target.writestr(info, source.read(info))
            target.writestr(APP_WORKFLOW_ENTRY, payload)
    except zipfile.BadZipFile as exc:
        raise AppError(f"Mini-app template is unreadable: {exc}", status_code=500) from exc

    return out.getvalue()
