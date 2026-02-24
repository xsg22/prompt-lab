from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import Users
from app.schemas.user import LoginResponse, UserCreate, User as UserSchema
from app.services.auth import AuthService

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    login_data: OAuth2PasswordRequestForm = Depends(),
    auth_service: AuthService = Depends(),
) -> Any:
    """登录获取令牌"""
    user = await auth_service.authenticate(
        username=login_data.username,
        password=login_data.password,
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被禁用",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    access_token = create_access_token(
        subject=user.id,
        expires_delta=access_token_expires,
    )
    
    expires_at = int((datetime.utcnow() + access_token_expires).timestamp())

    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        expires=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=UserSchema.model_validate(user),
    )


@router.post("/register", response_model=UserSchema)
async def register(
    user_data: UserCreate,
    auth_service: AuthService = Depends(),
) -> Any:
    """注册新用户"""
    new_user = await auth_service.create_user(user_data=user_data)
    return UserSchema.model_validate(new_user)


@router.get("/me", response_model=UserSchema)
async def read_current_user(
    current_user: Users = Depends(get_current_user),
) -> Any:
    """获取当前登录用户信息"""
    return UserSchema.model_validate(current_user)


@router.post("/logout")
async def logout(response: Response) -> Any:
    """用户登出"""
    response.delete_cookie(key="access_token")
    return {"detail": "登出成功"}