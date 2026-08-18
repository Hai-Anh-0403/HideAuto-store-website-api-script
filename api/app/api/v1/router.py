"""Aggregate all v1 routers."""

from fastapi import APIRouter

from app.api.v1.routes import (
    admin_users,
    app_client,
    auth,
    keys,
    members,
    scripts,
    sellers,
    sessions,
    tags,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(sellers.router)
api_router.include_router(sessions.router)
api_router.include_router(keys.router)
api_router.include_router(members.router)
api_router.include_router(scripts.router)
api_router.include_router(tags.router)
api_router.include_router(app_client.router)
api_router.include_router(admin_users.router)
