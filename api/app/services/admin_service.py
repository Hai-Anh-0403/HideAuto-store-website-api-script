"""Admin business logic: authentication + initial seeding."""

import logging

from app.core.config import settings
from app.core.exceptions import AuthError
from app.core.security import hash_password_async, verify_password_async
from app.models.admin import Admin
from app.repositories import admin as admin_repo

logger = logging.getLogger(__name__)


async def authenticate(email: str, password: str) -> Admin:
    admin = await admin_repo.get_by_email(email)
    if (
        admin is None
        or not admin.is_active
        or not await verify_password_async(password, admin.password_hash)
    ):
        raise AuthError("Invalid credentials")
    return admin


async def seed_initial_admin() -> None:
    """Create the first admin from env if no admin exists yet."""
    if await admin_repo.count() > 0:
        return
    email = settings.initial_admin_email
    password = settings.initial_admin_password
    if not email or not password:
        logger.warning("No admin exists and INITIAL_ADMIN_* not set; portal has no admin.")
        return
    hashed = await hash_password_async(password)
    await admin_repo.insert(Admin(email=email, password_hash=hashed, name="Admin"))
    logger.info("Seeded initial admin: %s", email)
