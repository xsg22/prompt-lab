"""
背景任务服务
提供异步任务执行的通用框架，确保每个任务都有独立的数据库会话
"""

import asyncio
import inspect
from typing import Any, Callable, Coroutine, Dict, List, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal

logger = get_logger(__name__)


class BackgroundTaskService:
    """背景任务服务"""
    
    @staticmethod
    def run_background_task(
        task_func: Callable,
        *args,
        task_name: Optional[str] = None,
        **kwargs
    ) -> None:
        """
        运行背景任务
        
        Args:
            task_func: 要执行的异步函数
            *args: 传递给任务函数的位置参数
            task_name: 任务名称（用于日志）
            **kwargs: 传递给任务函数的关键字参数
        """
        if task_name is None:
            task_name = task_func.__name__
        
        async def _execute_background_task():
            """执行背景任务的包装函数"""
            logger.info(f"开始执行背景任务: {task_name}")
            start_time = datetime.utcnow()
            
            try:
                # 检查函数是否需要数据库会话
                sig = inspect.signature(task_func)
                needs_db = any(
                    param.annotation.__name__ == 'AsyncSession' 
                    for param in sig.parameters.values() 
                    if hasattr(param.annotation, '__name__')
                )
                
                if needs_db:
                    # 为需要数据库会话的任务创建独立会话
                    async with AsyncSessionLocal() as db:
                        if asyncio.iscoroutinefunction(task_func):
                            await task_func(db, *args, **kwargs)
                        else:
                            task_func(db, *args, **kwargs)
                else:
                    # 不需要数据库会话的任务直接执行
                    if asyncio.iscoroutinefunction(task_func):
                        await task_func(*args, **kwargs)
                    else:
                        task_func(*args, **kwargs)
                
                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.info(f"背景任务执行成功: {task_name}, 耗时: {duration:.2f}秒")
                
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds()
                logger.error(
                    f"背景任务执行失败: {task_name}, 耗时: {duration:.2f}秒, 错误: {str(e)}", 
                    exc_info=True
                )
        
        # 创建异步任务
        asyncio.create_task(_execute_background_task())
    
    @staticmethod
    @asynccontextmanager
    async def with_independent_session():
        """
        提供独立数据库会话的上下文管理器
        用于需要手动管理会话的场景
        """
        async with AsyncSessionLocal() as db:
            try:
                yield db
            except Exception as e:
                await db.rollback()
                logger.error(f"数据库会话操作失败: {str(e)}", exc_info=True)
                raise
    
    @staticmethod
    def create_task_with_session(
        task_func: Callable[..., Coroutine[Any, Any, Any]],
        *args,
        task_name: Optional[str] = None,
        **kwargs
    ) -> asyncio.Task:
        """
        创建带有独立数据库会话的异步任务
        
        Args:
            task_func: 异步任务函数（第一个参数必须是 AsyncSession）
            *args: 传递给任务函数的其他参数
            task_name: 任务名称
            **kwargs: 关键字参数
            
        Returns:
            asyncio.Task: 创建的异步任务
        """
        if task_name is None:
            task_name = task_func.__name__
        
        async def _wrapped_task():
            async with BackgroundTaskService.with_independent_session() as db:
                logger.info(f"开始执行任务: {task_name}")
                try:
                    result = await task_func(db, *args, **kwargs)
                    logger.info(f"任务执行成功: {task_name}")
                    return result
                except Exception as e:
                    logger.error(f"任务执行失败: {task_name}, 错误: {str(e)}", exc_info=True)
                    raise
        
        return asyncio.create_task(_wrapped_task())


# 便捷函数
def run_background_task(task_func: Callable, *args, task_name: Optional[str] = None, **kwargs):
    """运行背景任务的便捷函数"""
    BackgroundTaskService.run_background_task(task_func, *args, task_name=task_name, **kwargs)


def create_task_with_session(
    task_func: Callable[..., Coroutine[Any, Any, Any]], 
    *args, 
    task_name: Optional[str] = None, 
    **kwargs
) -> asyncio.Task:
    """创建带有独立数据库会话的异步任务的便捷函数"""
    return BackgroundTaskService.create_task_with_session(
        task_func, *args, task_name=task_name, **kwargs
    ) 