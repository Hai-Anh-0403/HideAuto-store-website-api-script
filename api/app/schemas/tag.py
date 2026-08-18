"""Tag DTOs."""

from datetime import datetime

from beanie import PydanticObjectId
from pydantic import BaseModel, ConfigDict, Field


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    color: str | None = Field(default=None, max_length=20)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    description: str | None = Field(default=None, max_length=200)
    color: str | None = Field(default=None, max_length=20)


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: PydanticObjectId
    name: str
    slug: str
    description: str | None
    color: str | None
    created_at: datetime
