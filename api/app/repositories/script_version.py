"""Script version DB access."""

from beanie import PydanticObjectId

from app.models.script_version import ScriptVersion


async def insert(version: ScriptVersion) -> ScriptVersion:
    return await version.insert()


async def get_by_id(version_id: PydanticObjectId) -> ScriptVersion | None:
    return await ScriptVersion.get(version_id)


async def delete(version: ScriptVersion) -> None:
    await version.delete()


async def list_for_script(script_id: PydanticObjectId) -> list[ScriptVersion]:
    return await (
        ScriptVersion.find(ScriptVersion.script_id == script_id).sort("-created_at").to_list()
    )
