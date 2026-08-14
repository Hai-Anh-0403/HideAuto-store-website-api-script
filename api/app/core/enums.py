"""Domain enums shared across models and schemas."""

from enum import StrEnum


class Role(StrEnum):
    """Portal auth roles (encoded into the JWT subject)."""

    ADMIN = "admin"
    SELLER = "seller"


class SellerStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class KeyStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"


class MemberStatus(StrEnum):
    ACTIVE = "active"
    BLOCKED = "blocked"


class ScriptStatus(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class ScriptVersionStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class UploadKind(StrEnum):
    MINI_APP_SOURCE = "mini_app_source"
    WORKFLOW_GRAPH = "workflow_graph"
    HIDEFLOW = "hideflow"
    MEDIA_IMAGE = "media_image"
    MEDIA_VIDEO = "media_video"
    THUMBNAIL = "thumbnail"
    MINI_APP_BUILD = "mini_app_build"


class UploadStorage(StrEnum):
    LOCAL = "local"
    GRIDFS = "gridfs"
    S3 = "s3"


class UploadStatus(StrEnum):
    PENDING_SCAN = "pending_scan"
    CLEAN = "clean"
    QUARANTINED = "quarantined"
    REJECTED = "rejected"


class DeliveryFormat(StrEnum):
    HIDEFLOW_ENCRYPTED = "hideflow_encrypted"
    GRAPH_JSON = "graph_json"
    MINI_APP_EXE = "mini_app_exe"


class BuildStatus(StrEnum):
    BUILDING = "building"
    READY = "ready"
    FAILED = "failed"


class BuiltBy(StrEnum):
    SERVER = "server"  # template inject — no exe rename/icon
    AGENT = "agent"  # Windows build agent — full identity


class BuildPlatform(StrEnum):
    WIN = "win"
    MAC = "mac"
    LINUX = "linux"


class BuildArch(StrEnum):
    X64 = "x64"
    ARM64 = "arm64"


class InstallerFormat(StrEnum):
    EXE = "exe"
    DMG = "dmg"
    APPIMAGE = "appimage"
    ZIP = "zip"


class DownloadFormat(StrEnum):
    """What a buyer asks for: the raw graph, or a repackaged mini app."""

    GRAPH = "graph"
    EXE = "exe"
