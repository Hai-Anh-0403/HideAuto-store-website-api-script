"""Admin DB access."""

from beanie import PydanticObjectId

from app.models.admin import Admin


async def get_by_email(email: str) -> Admin | None:
    return await Admin.find_one(Admin.email == email)


async def get_by_id(admin_id: PydanticObjectId) -> Admin | None:
    return await Admin.get(admin_id)


async def count() -> int:
    return await Admin.find_all().count()


async def insert(admin: Admin) -> Admin:
    return await admin.insert()
