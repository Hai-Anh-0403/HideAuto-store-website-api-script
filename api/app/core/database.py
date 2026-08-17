"""PyMongo async client + Beanie initialization.

Beanie 2.x uses PyMongo's native async driver (`AsyncMongoClient`), not Motor.
"""

from pymongo import AsyncMongoClient

from app.core.config import settings
from app.models.admin import Admin
from app.models.mini_app_build import MiniAppBuild
from app.models.script import Script
from app.models.script_version import ScriptVersion
from app.models.seller import Seller
from app.models.seller_key import SellerKey
from app.models.seller_member import SellerMember
from app.models.seller_session import SellerSession
from app.models.upload import Upload

# All Beanie document models must be registered here.
DOCUMENT_MODELS = [
    Admin,
    Seller,
    SellerKey,
    SellerMember,
    SellerSession,
    Script,
    ScriptVersion,
    Upload,
    MiniAppBuild,
]

_client: AsyncMongoClient | None = None


def get_client() -> AsyncMongoClient:
    if _client is None:
        raise RuntimeError("Mongo client not initialized; call init_db() first.")
    return _client


async def init_db() -> None:
    global _client
    from beanie import init_beanie

    # tz_aware: BSON dates come back as UTC-aware datetimes, so responses carry an
    # offset. Without it every timestamp serializes naive and clients read it as local
    # time — "seen 1 minute ago" shows up hours off.
    _client = AsyncMongoClient(settings.mongodb_uri, tz_aware=True)
    await init_beanie(database=_client[settings.mongodb_db], document_models=DOCUMENT_MODELS)


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
