"""PyMongo async client + Beanie initialization.

Beanie 2.x uses PyMongo's native async driver (`AsyncMongoClient`), not Motor.
"""

from pymongo import AsyncMongoClient

from app.core.config import settings
from app.models.admin import Admin
from app.models.seller import Seller
from app.models.seller_key import SellerKey
from app.models.seller_member import SellerMember

# All Beanie document models must be registered here.
DOCUMENT_MODELS = [Admin, Seller, SellerKey, SellerMember]

_client: AsyncMongoClient | None = None


def get_client() -> AsyncMongoClient:
    if _client is None:
        raise RuntimeError("Mongo client not initialized; call init_db() first.")
    return _client


async def init_db() -> None:
    global _client
    from beanie import init_beanie

    _client = AsyncMongoClient(settings.mongodb_uri)
    await init_beanie(database=_client[settings.mongodb_db], document_models=DOCUMENT_MODELS)


async def close_db() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
