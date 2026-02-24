from contextlib import asynccontextmanager
import time
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 创建异步数据库引擎
engine = create_async_engine(
    settings.MYSQL_CONNECTION_STRING,
    echo=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话依赖（支持自动刷新+提交）"""
    start_time = time.time()
    session = AsyncSessionLocal()
    try:
        yield session
        # 无异常时自动提交
        await session.commit()
        logger.debug(f"数据库操作成功提交，耗时: {time.time() - start_time:.4f}秒")
    except Exception as e:
        # 发生异常时回滚
        await session.rollback()
        
        if hasattr(e, 'detail') and hasattr(e, 'status_code'):
            logger.error(f"数据库操作回滚，原因: {str(e.detail)} status_code: {e.status_code}")
        else:
            logger.error(f"数据库操作回滚，原因: {str(e)}", exc_info=True)
        raise
    finally:
        await session.close()

@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """获取数据库会话依赖（支持自动刷新+提交）"""
    start_time = time.time()
    session = AsyncSessionLocal()
    try:
        yield session
        # 无异常时自动提交
        await session.commit()
        logger.debug(f"数据库操作成功提交，耗时: {time.time() - start_time:.4f}秒")
    except Exception as e:
        # 发生异常时回滚
        await session.rollback()
        logger.error(f"数据库操作回滚，原因: {str(e)}")
        raise
    finally:
        await session.close()

# 初始化日志消息
logger.info("数据库连接池初始化完成") 