"""Tag routes: admin CRUD + public list."""

from beanie import PydanticObjectId
from fastapi import APIRouter, status

from app.api.deps import CurrentAdmin
from app.core.exceptions import ConflictError, NotFoundError
from app.models.tag import Tag
from app.repositories import tag as tag_repo
from app.schemas.tag import TagCreate, TagRead, TagUpdate
from app.utils.ids import slugify

router = APIRouter(tags=["tags"])

_MAX_SLUG_ATTEMPTS = 50


async def _unique_slug(name: str) -> str:
    base = slugify(name)
    for attempt in range(1, _MAX_SLUG_ATTEMPTS + 1):
        candidate = base if attempt == 1 else f"{base}-{attempt}"
        if await tag_repo.get_by_slug(candidate) is None:
            return candidate
    raise ConflictError("Could not derive a unique slug for this tag")


@router.get("/tags", response_model=list[TagRead], summary="List all tags")
async def list_tags() -> list[TagRead]:
    tags = await tag_repo.list_all()
    return [TagRead.model_validate(t) for t in tags]


@router.post(
    "/admin/tags",
    response_model=TagRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a tag",
)
async def create_tag(_admin: CurrentAdmin, payload: TagCreate) -> TagRead:
    tag = Tag(
        name=payload.name,
        slug=await _unique_slug(payload.name),
        description=payload.description,
        color=payload.color,
    )
    created = await tag_repo.insert(tag)
    return TagRead.model_validate(created)


@router.patch("/admin/tags/{tag_id}", response_model=TagRead, summary="Update a tag")
async def update_tag(
    tag_id: PydanticObjectId, _admin: CurrentAdmin, payload: TagUpdate
) -> TagRead:
    tag = await tag_repo.get_by_id(tag_id)
    if tag is None:
        raise NotFoundError("Tag not found")
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes:
        tag.name = changes["name"]
        tag.slug = await _unique_slug(tag.name)
    if "description" in changes:
        tag.description = changes["description"]
    if "color" in changes:
        tag.color = changes["color"]
    if changes:
        await tag.save()
    return TagRead.model_validate(tag)


@router.delete(
    "/admin/tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a tag",
)
async def delete_tag(tag_id: PydanticObjectId, _admin: CurrentAdmin) -> None:
    tag = await tag_repo.get_by_id(tag_id)
    if tag is None:
        raise NotFoundError("Tag not found")
    await tag_repo.delete(tag)
