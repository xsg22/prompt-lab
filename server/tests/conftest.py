import asyncio
import os
from typing import AsyncGenerator, Generator

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

# 创建测试数据库URL
TEST_DATABASE_URL = settings.DATABASE_URL.replace("mysql+asyncmy", "sqlite+aiosqlite")

# 创建测试引擎
engine = create_async_engine(
    TEST_DATABASE_URL, echo=False, future=True, connect_args={"check_same_thread": False}
)

# 创建测试会话工厂
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession
)


# 创建数据库依赖
async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session


# 覆盖数据库依赖
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def setup_database() -> AsyncGenerator[None, None]:
    """设置测试数据库"""
    # 创建表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # 清理
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """数据库会话"""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    """测试客户端"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
async def authenticated_client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    """认证的测试客户端"""
    # 这里可以实现登录逻辑，获取认证令牌
    # 创建测试用户并获取令牌
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 这里实现登录，获取令牌
        # 设置认证头
        # client.headers["Authorization"] = f"Bearer {token}"
        
        yield client 