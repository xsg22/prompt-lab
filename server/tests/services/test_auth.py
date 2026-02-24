import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.user import Users
from app.schemas.user import UserCreate
from app.services.auth import AuthService


@pytest.mark.asyncio
async def test_create_user(db_session: AsyncSession):
    """测试创建用户"""
    auth_service = AuthService(db_session)
    
    # 创建测试用户数据
    user_data = UserCreate(
        email="test@example.com",
        password="TestPassword123",
        nickname="TestUser",
    )
    
    # 创建用户
    user = await auth_service.register_user(user_data)
    
    # 验证用户信息
    assert user is not None
    assert user.email == user_data.email
    assert user.nickname == user_data.nickname
    assert not user.is_superuser
    assert verify_password("TestPassword123", user.hashed_password)


@pytest.mark.asyncio
async def test_authenticate_user(db_session: AsyncSession):
    """测试用户认证"""
    auth_service = AuthService(db_session)
    
    # 创建测试用户数据
    user_data = UserCreate(
        email="auth@example.com",
        password="AuthPassword123",
        nickname="AuthUser",
    )
    
    # 创建用户
    await auth_service.register_user(user_data)
    
    # 验证用户认证
    user = await auth_service.authenticate_user(user_data.email, user_data.password)
    assert user is not None
    assert user.email == user_data.email
    
    # 验证错误密码
    user = await auth_service.authenticate_user(user_data.email, "WrongPassword")
    assert user is None


@pytest.mark.asyncio
async def test_get_user_by_email(db_session: AsyncSession):
    """测试通过邮箱获取用户"""
    auth_service = AuthService(db_session)
    
    # 创建测试用户数据
    user_data = UserCreate(
        email="email@example.com",
        password="EmailPassword123",
        nickname="EmailUser",
    )
    
    # 创建用户
    await auth_service.register_user(user_data)
    
    # 获取用户
    user = await auth_service.get_user_by_email(user_data.email)
    assert user is not None
    assert user.email == user_data.email
    
    # 测试不存在的邮箱
    user = await auth_service.get_user_by_email("nonexistent@example.com")
    assert user is None 