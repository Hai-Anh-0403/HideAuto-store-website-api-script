"""Shared FastAPI dependencies: auth (seller/admin/app-user) + pagination."""

from typing import Annotated, Any

from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ValidationError

from app.core.enums import Role, SellerStatus
from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import decode_access_token
from app.models.admin import Admin
from app.models.seller import Seller
from app.models.seller_session import SellerSession
from app.repositories import admin as admin_repo
from app.repositories import seller as seller_repo
from app.schemas.common import Page  # noqa: F401  (re-exported for convenience)
from app.services import flowdesk_client, session_service
from app.utils.client_info import read_client

_portal_bearer = HTTPBearer(auto_error=True, description="Portal JWT (seller/admin)")
_app_bearer = HTTPBearer(auto_error=True, description="Flowdesk end-user access token")


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class SellerContext:
    """The signed-in seller plus the session row this request's token belongs to."""

    def __init__(self, seller: Seller, session: SellerSession) -> None:
        self.seller = seller
        self.session = session


async def get_seller_context(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_portal_bearer)],
) -> SellerContext:
    """Authenticate a seller and keep their session alive.

    A seller token is only good while its session row is: signing a device out from
    the device list invalidates the token it was issued with, right away.
    """
    data = decode_access_token(creds.credentials)
    if data is None or data.role != Role.SELLER or data.jti is None:
        raise _unauthorized()
    session = await session_service.resolve(data.jti)
    if session is None:
        # Signed out from another device, revoked, or simply aged out.
        raise AuthError("Session is no longer active", code="session_ended")
    # The session row owns the seller ref, so a malformed subject can't reach the DB.
    seller = await seller_repo.get_by_id(session.seller_id)
    if seller is None:
        raise _unauthorized()
    await session_service.touch(session, read_client(request))
    return SellerContext(seller=seller, session=session)


async def get_current_seller(ctx: Annotated[SellerContext, Depends(get_seller_context)]) -> Seller:
    return ctx.seller


async def require_approved_seller(
    seller: Annotated[Seller, Depends(get_current_seller)],
) -> Seller:
    if seller.status != SellerStatus.APPROVED:
        raise ForbiddenError(
            f"Seller not approved (status={seller.status.value})", code="seller_not_approved"
        )
    return seller


async def get_current_admin(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_portal_bearer)],
) -> Admin:
    data = decode_access_token(creds.credentials)
    if data is None or data.role != Role.ADMIN:
        raise _unauthorized()
    admin = await admin_repo.get_by_id(PydanticObjectId(data.subject_id))
    if admin is None or not admin.is_active:
        raise _unauthorized()
    return admin


class AppIdentity:
    """A verified end-user plus the raw flowdesk token (needed to call /devices)."""

    def __init__(self, user: flowdesk_client.FlowdeskUser, access_token: str) -> None:
        self.user = user
        self.access_token = access_token


async def get_app_identity(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_app_bearer)],
) -> AppIdentity:
    """Verify an end-user's flowdesk access token and keep the raw token."""
    user = await flowdesk_client.verify_token(creds.credentials)
    if user is None:
        raise _unauthorized("Invalid flowdesk token")
    return AppIdentity(user=user, access_token=creds.credentials)


async def get_current_app_user(
    identity: Annotated[AppIdentity, Depends(get_app_identity)],
) -> flowdesk_client.FlowdeskUser:
    return identity.user


def build_form_model[T: BaseModel](model: type[T], **fields: Any) -> T:
    """Validate multipart form fields through a Pydantic schema.

    FastAPI can only flatten a form model when it is the request's *only* body param;
    these endpoints also carry a file part, so the fields are declared one by one and
    the schema still owns every constraint. Failures come back as a normal 422.
    """
    try:
        return model(**fields)
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(include_url=False, include_context=False, include_input=False),
        ) from exc


class Pagination:
    def __init__(self, skip: int, limit: int) -> None:
        self.skip = skip
        self.limit = limit


def get_pagination(
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Pagination:
    return Pagination(skip=skip, limit=limit)


CurrentSeller = Annotated[Seller, Depends(get_current_seller)]
CurrentSellerCtx = Annotated[SellerContext, Depends(get_seller_context)]
ApprovedSeller = Annotated[Seller, Depends(require_approved_seller)]
CurrentAdmin = Annotated[Admin, Depends(get_current_admin)]
CurrentAppUser = Annotated[flowdesk_client.FlowdeskUser, Depends(get_current_app_user)]
CurrentAppIdentity = Annotated[AppIdentity, Depends(get_app_identity)]
Paginate = Annotated[Pagination, Depends(get_pagination)]
