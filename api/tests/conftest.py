"""Test fixtures: in-memory Mongo (mongomock-motor) + async HTTP client."""

from collections.abc import AsyncIterator

import httpx
import mongomock.database
import pytest_asyncio
from beanie import init_beanie
from fastapi import FastAPI
from mongomock_motor import AsyncMongoMockClient

from app.core.database import DOCUMENT_MODELS
from app.core.security import hash_password
from app.main import create_app
from app.models.admin import Admin

# Beanie calls list_collection_names(authorizedCollections=..., nameOnly=...); mongomock's
# signature doesn't accept those kwargs — swallow unknown kwargs for the in-memory test DB.
_orig_list_collection_names = mongomock.database.Database.list_collection_names


def _list_collection_names(self, *args, **kwargs):  # type: ignore[no-untyped-def]
    return _orig_list_collection_names(self)


mongomock.database.Database.list_collection_names = _list_collection_names  # type: ignore[assignment]

ADMIN_EMAIL = "admin@teststore.com"
ADMIN_PASSWORD = "admin12345"


@pytest_asyncio.fixture
async def app() -> AsyncIterator[FastAPI]:
    client = AsyncMongoMockClient()
    await init_beanie(database=client["test_db"], document_models=DOCUMENT_MODELS)
    await Admin(
        email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), name="Admin"
    ).insert()
    # create_app() is used without its lifespan (ASGITransport skips it); Beanie is
    # already initialized above against the in-memory client.
    yield create_app()


@pytest_asyncio.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
