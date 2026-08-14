"""Content-addressed artifact storage on local disk.

Files are stored under `settings.storage_dir` keyed by their sha256, so re-uploading the
same package costs nothing and every `uploads.ref` is verifiable. Disk I/O runs in a
worker thread — the event loop never blocks on it.

Swapping in S3/GridFS later means reimplementing `save_bytes` / `read_bytes` and setting
a different `UploadStorage` on the document; nothing outside this module knows the layout.
"""

import asyncio
import hashlib
import re
from pathlib import Path

from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import AppError

_SUFFIX_RE = re.compile(r"^\.[A-Za-z0-9]{1,10}$")


class StoredFile(BaseModel):
    ref: str
    checksum: str
    size_bytes: int


def _root() -> Path:
    return Path(settings.storage_dir).resolve()


def _safe_suffix(filename: str) -> str:
    suffix = Path(filename).suffix
    return suffix.lower() if _SUFFIX_RE.match(suffix) else ""


def _resolve(ref: str) -> Path:
    """Resolve a stored ref, refusing anything that escapes the storage root."""
    root = _root()
    path = (root / ref).resolve()
    if path != root and root not in path.parents:
        raise AppError("Invalid storage reference", status_code=400)
    return path


def _write_sync(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return  # content-addressed: same checksum ⇒ same bytes
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


async def save_bytes(data: bytes, *, subdir: str, filename: str) -> StoredFile:
    checksum = hashlib.sha256(data).hexdigest()
    ref = f"{subdir}/{checksum[:2]}/{checksum}{_safe_suffix(filename)}"
    await asyncio.to_thread(_write_sync, _resolve(ref), data)
    return StoredFile(ref=ref, checksum=checksum, size_bytes=len(data))


def path_for(ref: str) -> Path:
    """Absolute path of a stored artifact — for streaming it back with FileResponse."""
    return _resolve(ref)


async def read_bytes(ref: str) -> bytes:
    path = _resolve(ref)
    try:
        return await asyncio.to_thread(path.read_bytes)
    except FileNotFoundError as exc:
        raise AppError("Stored file is missing", status_code=410) from exc
