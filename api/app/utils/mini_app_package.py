"""Pull the workflow graph out of an uploaded artifact.

Supported containers (see `docs/script-publish-packaging.md` §1.2):

* **mini-app package** (`.zip`, or an `.exe` that is really a zip of the app folder) —
  read `resources/app.workflow`, a plain-JSON envelope holding the graph.
* **bare `app.workflow` / graph JSON** — the same envelope, or the graph on its own.

`.hideflow` exports are encrypted with a key that lives inside the desktop app, so the
store cannot open them; those uploads are rejected with an explicit message.

Everything here treats the archive as hostile: entry names are validated, entry count and
decompressed size are capped, and only the single entry we need is ever read.
"""

import io
import json
import zipfile
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.core.enums import DeliveryFormat, UploadKind
from app.core.exceptions import UnprocessableError

APP_WORKFLOW_ENTRY = "resources/app.workflow"
HIDEFLOW_MAGIC = b"HFLW"
ZIP_MAGIC = b"PK\x03\x04"

MAX_ARCHIVE_ENTRIES = 50_000
MAX_WORKFLOW_ENTRY_BYTES = 32 * 1024 * 1024

# A packed installer is unreadable by design, so an `.exe` we cannot get a graph out of
# is accepted as an opaque build instead of rejected — see `_opaque_package`. A `.zip`
# stays strict: it is readable, so a missing app.workflow really means "not a mini app".
OPAQUE_SUFFIX = ".exe"
EMPTY_GRAPH: dict[str, Any] = {"nodes": [], "edges": [], "variables": []}


class ExtractedPackage(BaseModel):
    """The graph plus whatever identity the container carried with it."""

    graph: dict[str, Any]
    source_kind: UploadKind
    delivery: DeliveryFormat
    app_name: str | None = None
    app_id: str | None = None
    workflow_id: str | None = None
    workflow_name: str | None = None
    # False when the container gave up no graph — every derived field is then empty and
    # the scan result means "nothing was scanned", not "nothing was found".
    graph_extracted: bool = True


def _opaque_package(filename: str) -> ExtractedPackage:
    """A mini-app binary whose graph the store cannot read (yet).

    TEMPORARY: a packed `.exe` keeps its workflow behind the desktop app's key, so there
    is nothing to parse until that key handling lands. The build is accepted so the
    seller can get it into the store, but it carries an empty graph and
    `graph_extracted=False` — no metadata is invented, and nothing claims it was scanned.
    """
    return ExtractedPackage(
        graph=dict(EMPTY_GRAPH),
        source_kind=UploadKind.MINI_APP_SOURCE,
        delivery=DeliveryFormat.MINI_APP_EXE,
        app_name=Path(filename).stem or None,
        graph_extracted=False,
    )


def _entry_name_is_safe(name: str) -> bool:
    """Reject absolute paths, drive letters and `..` segments (zip-slip)."""
    if name.startswith(("/", "\\")) or ":" in name:
        return False
    return ".." not in name.replace("\\", "/").split("/")


def _find_app_workflow(archive: zipfile.ZipFile) -> zipfile.ZipInfo | None:
    infos = archive.infolist()
    if len(infos) > MAX_ARCHIVE_ENTRIES:
        raise UnprocessableError("Archive has too many entries", code="archive_too_many_entries")

    match: zipfile.ZipInfo | None = None
    match_depth = -1
    for info in infos:
        if not _entry_name_is_safe(info.filename):
            raise UnprocessableError(
                f"Unsafe path in archive: {info.filename}", code="archive_unsafe_path"
            )
        normalized = info.filename.replace("\\", "/").lower()
        if normalized == APP_WORKFLOW_ENTRY or normalized.endswith("/" + APP_WORKFLOW_ENTRY):
            # Shallowest match wins: that's the real app root, not a nested copy.
            depth = normalized.count("/")
            if match is None or depth < match_depth:
                match, match_depth = info, depth

    if match is None:
        return None
    if match.file_size > MAX_WORKFLOW_ENTRY_BYTES:
        raise UnprocessableError("resources/app.workflow is too large", code="workflow_too_large")
    return match


def _parse_json(raw: bytes, what: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise UnprocessableError(f"{what} is not valid JSON: {exc}", code="invalid_json") from exc
    if not isinstance(parsed, dict):
        raise UnprocessableError(f"{what} must be a JSON object", code="invalid_json")
    return parsed


def _graph_from_envelope(payload: dict[str, Any], what: str) -> dict[str, Any]:
    """Accept an `app.workflow` envelope, an export payload, or a bare graph."""
    for key in ("workflow", "data"):
        candidate = payload.get(key)
        if isinstance(candidate, dict):
            payload = candidate
            break
    if not isinstance(payload.get("nodes"), list):
        raise UnprocessableError(
            f"{what} does not contain a workflow graph (missing nodes)", code="not_a_graph"
        )
    return payload


def _str_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def extract_package(content: bytes, filename: str) -> ExtractedPackage:
    """Identify the container, pull out the graph, and keep the mini-app identity."""
    if content.startswith(HIDEFLOW_MAGIC):
        raise UnprocessableError(
            "Encrypted .hideflow exports are not supported yet — upload the mini-app "
            "package (.zip/.exe) instead",
            code="hideflow_encrypted",
        )

    is_opaque_binary = filename.lower().endswith(OPAQUE_SUFFIX)

    if content.startswith(ZIP_MAGIC):
        raw: bytes | None = None
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                info = _find_app_workflow(archive)
                if info is not None:
                    with archive.open(info) as handle:
                        raw = handle.read(MAX_WORKFLOW_ENTRY_BYTES + 1)
        except zipfile.BadZipFile as exc:
            raise UnprocessableError(
                f"Cannot read archive: {exc}", code="archive_unreadable"
            ) from exc
        if raw is None:
            if is_opaque_binary:
                return _opaque_package(filename)
            raise UnprocessableError(
                "No resources/app.workflow found — is this a hideflow mini-app package?",
                code="no_app_workflow",
            )
        if len(raw) > MAX_WORKFLOW_ENTRY_BYTES:
            raise UnprocessableError(
                "resources/app.workflow is too large", code="workflow_too_large"
            )

        envelope = _parse_json(raw, "resources/app.workflow")
        return ExtractedPackage(
            graph=_graph_from_envelope(envelope, "resources/app.workflow"),
            source_kind=UploadKind.MINI_APP_SOURCE,
            delivery=DeliveryFormat.MINI_APP_EXE,
            app_name=_str_or_none(envelope.get("appName")),
            app_id=_str_or_none(envelope.get("appId")),
            workflow_id=_str_or_none(envelope.get("workflowId")),
            workflow_name=_str_or_none(envelope.get("workflowName")),
        )

    if filename.lower().endswith((".json", ".workflow")):
        envelope = _parse_json(content, filename)
        return ExtractedPackage(
            graph=_graph_from_envelope(envelope, filename),
            source_kind=UploadKind.WORKFLOW_GRAPH,
            delivery=DeliveryFormat.GRAPH_JSON,
            app_name=_str_or_none(envelope.get("appName")),
            app_id=_str_or_none(envelope.get("appId")),
            workflow_id=_str_or_none(envelope.get("workflowId")),
            workflow_name=_str_or_none(envelope.get("workflowName")),
        )

    if is_opaque_binary:
        # A packed installer, not a zip of the app folder: take it as an opaque build.
        return _opaque_package(filename)

    raise UnprocessableError(
        "Unsupported upload — expected a mini-app package (.zip/.exe) or an app.workflow "
        "/ graph .json file",
        code="unsupported_upload",
    )
