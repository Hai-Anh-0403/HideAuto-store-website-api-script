"""Mini-app build DB access."""

from beanie import PydanticObjectId

from app.core.enums import BuildStatus
from app.models.mini_app_build import MiniAppBuild


async def insert(build: MiniAppBuild) -> MiniAppBuild:
    return await build.insert()


async def get_by_id(build_id: PydanticObjectId) -> MiniAppBuild | None:
    return await MiniAppBuild.get(build_id)


async def list_for_script(script_id: PydanticObjectId) -> list[MiniAppBuild]:
    return await (
        MiniAppBuild.find(MiniAppBuild.script_id == script_id).sort("-created_at").to_list()
    )


async def get_ready_for_version(version_id: PydanticObjectId) -> MiniAppBuild | None:
    return await (
        MiniAppBuild.find(
            MiniAppBuild.script_version_id == version_id,
            MiniAppBuild.status == BuildStatus.READY,
        )
        .sort("-created_at")
        .first_or_none()
    )
