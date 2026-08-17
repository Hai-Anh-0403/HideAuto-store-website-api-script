"""Auth routes: seller register/login + admin login."""

from fastapi import APIRouter, Request, status

from app.core.enums import Role
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, Token
from app.schemas.seller import SellerRead, SellerRegister
from app.services import admin_service, seller_service, session_service
from app.utils.client_info import read_client
from app.utils.ids import require_id

router = APIRouter(tags=["auth"])


@router.post("/sellers/register", response_model=SellerRead, status_code=status.HTTP_201_CREATED)
async def register_seller(payload: SellerRegister) -> SellerRead:
    seller = await seller_service.register(payload)
    return SellerRead.model_validate(seller)


@router.post("/sellers/login", response_model=Token)
async def login_seller(payload: LoginRequest, request: Request) -> Token:
    seller = await seller_service.authenticate(payload.email, payload.password)
    issued = create_access_token(subject_id=str(require_id(seller.id)), role=Role.SELLER)
    # The sign-in becomes a device the seller can see and sign out later.
    await session_service.start(require_id(seller.id), issued, read_client(request))
    return Token(access_token=issued.token, role=Role.SELLER.value)


@router.post("/admin/login", response_model=Token)
async def login_admin(payload: LoginRequest) -> Token:
    admin = await admin_service.authenticate(payload.email, payload.password)
    issued = create_access_token(subject_id=str(require_id(admin.id)), role=Role.ADMIN)
    return Token(access_token=issued.token, role=Role.ADMIN.value)
