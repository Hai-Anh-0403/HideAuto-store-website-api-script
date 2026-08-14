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
