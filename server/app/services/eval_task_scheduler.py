"""评估任务调度器"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set, Union
from abc import ABC, abstractmethod

from sqlalchemy import func, select, update, and_, or_
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.core.eval_config import get_eval_config
from app.db.session import get_db_session
from app.models.eval_task import (
    EvalTask, EvalTaskItem, EvalTaskLog,
    TaskStatus, TaskItemStatus
)
from app.models.eval_result_row_task import (
    EvalResultRowTask, RowTaskStatus, RowTaskResult
)
from app.services.eval_task_manager import EvalTaskManager
from app.services.eval_task_executor import EvalTaskExecutor
from app.services.eval_row_task_executor import EvalRowTaskExecutor
from app.services.evaluation_engine import EvaluationEngine

logger = get_logger(__name__)

# 统一任务接口
class SchedulableTask(ABC):
    """可调度任务的统一接口"""
    
    @property
    @abstractmethod
    def id(self) -> int:
        pass
    
    @property
    @abstractmethod
    def task_type(self) -> str:
        pass
    
    @property
    @abstractmethod
    def status(self) -> str:
        pass
    
    @property
    @abstractmethod
    def priority(self) -> int:
        pass
    
    @property
    @abstractmethod
    def result_id(self) -> int:
        pass
    
    @abstractmethod
    async def execute(self, executor) -> bool:
        pass

class ColumnTaskAdapter(SchedulableTask):
    """列任务适配器"""
    
    def __init__(self, eval_task: EvalTask):
        self._eval_task = eval_task
    
    @property
    def id(self) -> int:
        return self._eval_task.id
    
    @property
    def task_type(self) -> str:
        return "column_task"
    
    @property
    def status(self) -> str:
        return self._eval_task.status
    
    @property
    def priority(self) -> int:
        return self._eval_task.priority
    
    @property
    def result_id(self) -> int:
        return self._eval_task.result_id
    
    async def execute(self, executor) -> bool:
        """执行列任务"""
        if isinstance(executor, EvalTaskExecutor):
            await executor.execute_task(self.id)
            return True
        return False

class RowTaskAdapter(SchedulableTask):
    """行任务适配器"""
    
    def __init__(self, row_task: EvalResultRowTask):
        self._row_task = row_task
    
    @property
    def id(self) -> int:
        return self._row_task.id
    
    @property
    def task_type(self) -> str:
        return "row_task"
    
    @property
    def status(self) -> str:
        return self._row_task.status
    
    @property
    def priority(self) -> int:
        # 行任务使用固定优先级，或根据需要调整
        return 100  # 给行任务较高优先级
    
    @property
    def result_id(self) -> int:
        return self._row_task.result_id
    
    async def execute(self, executor) -> bool:
        """执行单个行任务"""
        if isinstance(executor, EvalRowTaskExecutor):
            # 获取评估列信息（按position排序）
            columns = await executor._get_pipeline_columns(self._row_task.result_id)
            if not columns:
                raise ValueError(f"找不到评估列，result_id: {self._row_task.result_id}")
            
            return await executor._execute_single_row_task(self._row_task, columns)
        return False

class EvalTaskScheduler:
    """评估任务调度器 - 支持列任务和行任务的统一调度"""
    
    def __init__(self):
        self.task_manager = EvalTaskManager()
        self.task_executor = EvalTaskExecutor()
        
        # 创建行任务执行器
        self.row_task_executor = EvalRowTaskExecutor()
        
        self._running = False
        self._scheduler_task = None
        self._active_tasks: Set[str] = set()  # 存储 "type:id" 格式的任务标识
        
    async def start_scheduler(self) -> None:
        """启动调度器"""
        if self._running:
            logger.warning("调度器已在运行中")
            return
        
        self._running = True
        logger.info("启动统一评估任务调度器")
        
        # 启动调度循环
        self._scheduler_task = asyncio.create_task(self._scheduler_loop())
        
        # 恢复中断的任务
        await self.recover_interrupted_tasks()
    
    async def stop_scheduler(self) -> None:
        """停止调度器"""
        if not self._running:
            return
        
        self._running = False
        logger.info("停止统一评估任务调度器")
        
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
    
    async def _scheduler_loop(self) -> None:
        """调度器主循环"""
        while self._running:
            try:
                # 调度待执行任务
                await self.schedule_pending_tasks()
                
                # 调度重试任务
                await self.schedule_retry_tasks()
                
                # 清理超时任务
                await self._cleanup_timeout_tasks()
                
                # 等待一段时间再进行下一轮调度
                config = get_eval_config()
                await asyncio.sleep(config.get_scheduler_interval_seconds())  # 可配置间隔
                
            except Exception as e:
                logger.error(f"调度器循环发生错误: {str(e)}", exc_info=True)
                await asyncio.sleep(10)  # 发生错误时等待更长时间
    
    async def schedule_pending_tasks(self) -> None:
        """调度待执行任务"""
        try:
            # 获取最大并发任务数
            max_concurrent_tasks = self._get_max_concurrent_tasks()
            
            # 如果当前活跃任务数已达上限，跳过调度
            if len(self._active_tasks) >= max_concurrent_tasks:
                logger.info(f"当前活跃任务数{len(self._active_tasks)}已达上限:{max_concurrent_tasks}，跳过调度")
                return
            
            # 计算可以启动的任务数
            available_slots = max_concurrent_tasks - len(self._active_tasks)
            
            # 获取待执行的任务（列任务和行任务混合，按优先级排序）
            pending_tasks = await self._get_pending_tasks_unified(limit=available_slots)
            
            if not pending_tasks:
                # logger.info("没有待执行任务，跳过调度")
                return
            
            logger.info(f"调度 {len(pending_tasks)} 个待执行任务")
            
            # 启动任务
            for task in pending_tasks:
                try:
                    # 生成任务标识
                    task_key = f"{task.task_type}:{task.id}"
                    
                    # 添加到活跃任务集合
                    self._active_tasks.add(task_key)
                    
                    # 异步执行任务
                    asyncio.create_task(
                        self._execute_task_with_cleanup(task, task_key)
                    )
                    
                    logger.info(f"启动任务 {task_key}")
                    
                except Exception as e:
                    logger.error(f"启动任务 {task.task_type}:{task.id} 失败: {str(e)}", exc_info=True)
                    task_key = f"{task.task_type}:{task.id}"
                    self._active_tasks.discard(task_key)
                    
        except Exception as e:
            logger.error(f"调度待执行任务失败: {str(e)}", exc_info=True)
    
    async def schedule_retry_tasks(self) -> None:
        """调度重试任务"""
        try:
            # 获取需要重试的列任务
            retry_column_tasks = await self._get_retry_column_tasks()
            
            # 获取需要重试的行任务
            retry_row_tasks = await self._get_retry_row_tasks()
            
            all_retry_tasks = []
            all_retry_tasks.extend([ColumnTaskAdapter(task) for task in retry_column_tasks])
            all_retry_tasks.extend([RowTaskAdapter(task) for task in retry_row_tasks])
            
            if not all_retry_tasks:
                return
            
            logger.info(f"调度 {len(all_retry_tasks)} 个重试任务")
            
            for task in all_retry_tasks:
                try:
                    task_key = f"{task.task_type}:{task.id}"
                    
                    # 检查是否已在活跃任务中
                    if task_key in self._active_tasks:
                        continue
                    
                    # 检查并发限制
                    max_concurrent_tasks = self._get_max_concurrent_tasks()
                    if len(self._active_tasks) >= max_concurrent_tasks:
                        break
                    
                    # 根据任务类型重置状态
                    if task.task_type == "column_task":
                        await self._reset_failed_task_items(task.id)
                    elif task.task_type == "row_task":
                        await self._reset_failed_row_task(task.id)
                    
                    # 添加到活跃任务集合
                    self._active_tasks.add(task_key)
                    
                    # 异步执行任务
                    asyncio.create_task(
                        self._execute_task_with_cleanup(task, task_key)
                    )
                    
                    logger.info(f"重试任务 {task_key}")
                    
                except Exception as e:
                    logger.error(f"重试任务 {task.task_type}:{task.id} 失败: {str(e)}", exc_info=True)
                    task_key = f"{task.task_type}:{task.id}"
                    self._active_tasks.discard(task_key)
                    
        except Exception as e:
            logger.error(f"调度重试任务失败: {str(e)}", exc_info=True)
    
    async def recover_interrupted_tasks(self) -> None:
        """恢复中断的任务"""
        try:
            # 查找状态为运行中但可能已中断的列任务
            interrupted_column_tasks = await self._get_interrupted_column_tasks()
            
            # 查找状态为运行中但可能已中断的行任务
            interrupted_row_tasks = await self._get_interrupted_row_tasks()
            
            all_interrupted_tasks = len(interrupted_column_tasks) + len(interrupted_row_tasks)
            
            if all_interrupted_tasks == 0:
                logger.info("没有发现中断的任务")
                return
            
            logger.info(f"发现 {all_interrupted_tasks} 个中断的任务，开始恢复")
            
            # 恢复中断的列任务
            for task in interrupted_column_tasks:
                try:
                    if await self._is_column_task_really_interrupted(task.id):
                        await self.task_manager._update_task_status(
                            task.id,
                            TaskStatus.PENDING,
                            {"started_at": None},
                            "任务已从中断状态恢复"
                        )
                        await self._reset_running_task_items(task.id)
                        logger.info(f"恢复中断列任务 {task.id}")
                except Exception as e:
                    logger.error(f"恢复列任务 {task.id} 失败: {str(e)}", exc_info=True)
                    await self.task_manager.complete_task(task.id, success=False)
            
            # 恢复中断的行任务
            for task in interrupted_row_tasks:
                try:
                    if await self._is_row_task_really_interrupted(task.id):
                        await self._update_row_task_status(
                            task.id,
                            RowTaskStatus.PENDING,
                            {"started_at": None}
                        )
                        logger.info(f"恢复中断行任务 {task.id}")
                except Exception as e:
                    logger.error(f"恢复行任务 {task.id} 失败: {str(e)}", exc_info=True)
                    await self._update_row_task_status(
                        task.id,
                        RowTaskStatus.FAILED,
                        {"error_message": "任务恢复失败"}
                    )
                    
        except Exception as e:
            logger.error(f"恢复中断任务失败: {str(e)}", exc_info=True)
    
    async def _execute_task_with_cleanup(self, task: SchedulableTask, task_key: str) -> None:
        """执行任务并清理"""
        try:
            # 根据任务类型选择对应的执行器
            if task.task_type == "column_task":
                success = await task.execute(self.task_executor)
            elif task.task_type == "row_task":
                success = await task.execute(self.row_task_executor)
            else:
                logger.error(f"未知任务类型: {task.task_type}")
                success = False
            
            if not success:
                logger.warning(f"任务 {task_key} 执行失败")
                
        except Exception as e:
            logger.error(f"执行任务 {task_key} 时发生异常: {str(e)}", exc_info=True)
        finally:
            # 从活跃任务集合中移除
            self._active_tasks.discard(task_key)
    
    async def _get_pending_tasks_unified(self, limit: int = 10) -> List[SchedulableTask]:
        """获取待执行的任务（列任务和行任务混合）"""
        try:
            # 获取待执行的列任务
            column_tasks = await self._get_pending_column_tasks(limit)
            
            # 获取待执行的行任务
            row_tasks = await self._get_pending_row_tasks(limit)
            
            # 转换为统一接口
            unified_tasks = []
            unified_tasks.extend([ColumnTaskAdapter(task) for task in column_tasks])
            unified_tasks.extend([RowTaskAdapter(task) for task in row_tasks])
            
            # 按优先级和result_id排序，确保同一个result_id的任务按顺序执行
            unified_tasks.sort(key=lambda x: (-x.priority, x.result_id))
            
            # 过滤掉同一个result_id已有运行任务的情况
            filtered_tasks = []
            result_ids_running = set()
            
            # 检查当前运行中的result_id
            for task_key in self._active_tasks:
                if ":" in task_key:
                    _, task_id = task_key.split(":")
                    # 这里需要查询获取result_id，为简化先跳过此过滤
            
            # 根据limit返回任务
            return unified_tasks[:limit]
            
        except Exception as e:
            logger.error(f"获取待执行任务失败: {str(e)}", exc_info=True)
            return []
    
    async def _get_pending_column_tasks(self, limit: int = 10) -> List[EvalTask]:
        """获取待执行的列任务"""
        async with get_db_session() as db:
            # 使用子查询实现
            subquery = (
                select(
                    EvalTask,
                    func.row_number().over(
                        partition_by=EvalTask.result_id, 
                        order_by=EvalTask.priority
                    ).label("rn")
                )
                .where(EvalTask.status == "pending")
                .subquery()
            )
            result = await db.execute(select(subquery).where(subquery.c.rn == 1).limit(limit//2))
            return [EvalTask(**{k: v for k, v in row.items() if k != 'rn'}) for row in result.mappings().all()]
    
    async def _get_pending_row_tasks(self, limit: int = 10) -> List[EvalResultRowTask]:
        """获取待执行的行任务"""
        async with get_db_session() as db:
            # 每个result_id只取一个待执行的行任务
            subquery = (
                select(
                    EvalResultRowTask,
                    func.row_number().over(
                        partition_by=EvalResultRowTask.result_id,
                        order_by=EvalResultRowTask.id
                    ).label("rn")
                )
                .where(EvalResultRowTask.status == RowTaskStatus.PENDING)
                .subquery()
            )
            result = await db.execute(select(subquery).where(subquery.c.rn == 1).limit(limit//2))
            return [EvalResultRowTask(**{k: v for k, v in row.items() if k != 'rn'}) for row in result.mappings().all()]
    
    async def _get_retry_column_tasks(self) -> List[EvalTask]:
        """获取需要重试的列任务"""
        current_time = datetime.utcnow()
        
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTask)
                .where(
                    and_(
                        EvalTask.status == TaskStatus.RETRYING,
                        or_(
                            EvalTask.next_retry_at.is_(None),
                            EvalTask.next_retry_at <= current_time
                        )
                    )
                )
                .order_by(EvalTask.priority.desc(), EvalTask.next_retry_at.asc())
            )
        return result.scalars().all()
    
    async def _get_retry_row_tasks(self) -> List[EvalResultRowTask]:
        """获取需要重试的行任务（暂时返回空，后续可扩展重试机制）"""
        # 行任务暂时不支持自动重试，可根据需要扩展
        return []
    
    async def _get_interrupted_column_tasks(self) -> List[EvalTask]:
        """获取可能中断的列任务"""
        timeout_minutes = self._get_task_timeout_minutes()
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTask)
                .where(
                    and_(
                        EvalTask.status == TaskStatus.RUNNING,
                        EvalTask.updated_at < cutoff_time
                    )
                )
            )
        return result.scalars().all()
    
    async def _get_interrupted_row_tasks(self) -> List[EvalResultRowTask]:
        """获取可能中断的行任务"""
        timeout_minutes = self._get_task_timeout_minutes()
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalResultRowTask)
                .where(
                    and_(
                        EvalResultRowTask.status == RowTaskStatus.RUNNING,
                        EvalResultRowTask.updated_at < cutoff_time
                    )
                )
            )
        return result.scalars().all()
    
    async def _is_column_task_really_interrupted(self, task_id: int) -> bool:
        """检查列任务是否真的中断了"""
        # 检查是否有最近的活动日志
        recent_time = datetime.utcnow() - timedelta(minutes=5)
        
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTaskLog)
                .where(
                    and_(
                        EvalTaskLog.task_id == task_id,
                        EvalTaskLog.created_at > recent_time
                    )
                )
                .limit(1)
            )
        
        # 如果有最近的日志，说明任务可能还在运行
        return result.scalar_one_or_none() is None
    
    async def _is_row_task_really_interrupted(self, task_id: int) -> bool:
        """检查行任务是否真的中断了"""
        # 行任务暂时简单检查更新时间
        timeout_minutes = 5
        cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalResultRowTask)
                .where(
                    and_(
                        EvalResultRowTask.id == task_id,
                        EvalResultRowTask.updated_at < cutoff_time
                    )
                )
            )
        
        return result.scalar_one_or_none() is not None
    
    async def _reset_failed_task_items(self, task_id: int) -> None:
        """重置失败的任务项状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalTaskItem)
                    .where(
                        and_(
                            EvalTaskItem.task_id == task_id,
                            EvalTaskItem.status == TaskItemStatus.FAILED
                        )
                    )
                    .values(
                        status=TaskItemStatus.PENDING,
                        retry_count=EvalTaskItem.retry_count + 1,
                        error_message=None,
                        started_at=None,
                        completed_at=None,
                        updated_at=datetime.utcnow()
                    )
                )
            await db.commit()
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"重置失败任务项状态失败: {str(e)}", exc_info=True)
    
    async def _reset_failed_row_task(self, task_id: int) -> None:
        """重置失败的行任务状态"""
        try:
            await self._update_row_task_status(
                task_id,
                RowTaskStatus.PENDING,
                {
                    "error_message": None,
                    "started_at": None,
                    "completed_at": None,
                    "current_column_position": None,
                    "execution_variables": None
                }
            )
        except Exception as e:
            logger.error(f"重置失败行任务状态失败: {str(e)}", exc_info=True)
    
    async def _reset_running_task_items(self, task_id: int) -> None:
        """重置运行中的任务项状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalTaskItem)
                    .where(
                        and_(
                        EvalTaskItem.task_id == task_id,
                        EvalTaskItem.status == TaskItemStatus.RUNNING
                    )
                    )
                    .values(
                        status=TaskItemStatus.PENDING,
                        started_at=None,
                        updated_at=datetime.utcnow()
                    )
                )
        except SQLAlchemyError as e:
            logger.error(f"重置运行中任务项状态失败: {str(e)}", exc_info=True)
    
    async def _update_row_task_status(self, task_id: int, status: RowTaskStatus, extra_fields: Dict[str, Any] = None) -> None:
        """更新行任务状态"""
        try:
            update_values = {
                "status": status,
                "updated_at": datetime.utcnow()
            }
            
            if extra_fields:
                update_values.update(extra_fields)
            
            async with get_db_session() as db:
                await db.execute(
                    update(EvalResultRowTask)
                    .where(EvalResultRowTask.id == task_id)
                    .values(update_values)
                )
                await db.commit()
                
        except SQLAlchemyError as e:
            logger.error(f"更新行任务状态失败: {str(e)}", exc_info=True)
    
    async def _cleanup_timeout_tasks(self) -> None:
        """清理超时任务"""
        try:
            timeout_minutes = self._get_task_timeout_minutes()
            cutoff_time = datetime.utcnow() - timedelta(minutes=timeout_minutes)
            
            # 清理超时的列任务
            await self._cleanup_timeout_column_tasks(cutoff_time)
            
            # 清理超时的行任务
            await self._cleanup_timeout_row_tasks(cutoff_time)
            
        except Exception as e:
            logger.error(f"清理超时任务失败: {str(e)}", exc_info=True)
    
    async def _cleanup_timeout_column_tasks(self, cutoff_time: datetime) -> None:
        """清理超时的列任务"""
        async with get_db_session() as db:
            timeout_tasks_result = await db.execute(
                select(EvalTask)
                .where(
                    and_(
                        EvalTask.status == TaskStatus.RUNNING,
                        EvalTask.started_at < cutoff_time
                    )
                )
            )
        timeout_tasks = timeout_tasks_result.scalars().all()
        
        for task in timeout_tasks:
            # 检查任务是否真的超时了
            if await self._is_column_task_really_interrupted(task.id):
                logger.warning(f"列任务 {task.id} 执行超时，标记为失败")
                
                await self.task_manager._update_task_status(
                    task.id,
                    TaskStatus.FAILED,
                    {
                        "completed_at": datetime.utcnow(),
                        "error_message": f"任务执行超时（超过 {self._get_task_timeout_minutes()} 分钟）"
                    },
                    f"任务执行超时，已标记为失败"
                )
                
                # 从活跃任务集合中移除
                task_key = f"column_task:{task.id}"
                self._active_tasks.discard(task_key)
    
    async def _cleanup_timeout_row_tasks(self, cutoff_time: datetime) -> None:
        """清理超时的行任务"""
        async with get_db_session() as db:
            timeout_tasks_result = await db.execute(
                select(EvalResultRowTask)
                .where(
                    and_(
                        EvalResultRowTask.status == RowTaskStatus.RUNNING,
                        EvalResultRowTask.started_at < cutoff_time
                    )
                )
            )
        timeout_tasks = timeout_tasks_result.scalars().all()
        
        for task in timeout_tasks:
            # 检查任务是否真的超时了
            if await self._is_row_task_really_interrupted(task.id):
                logger.warning(f"行任务 {task.id} 执行超时，标记为失败")
                
                await self._update_row_task_status(
                    task.id,
                    RowTaskStatus.FAILED,
                    {
                        "completed_at": datetime.utcnow(),
                        "error_message": f"任务执行超时（超过 {self._get_task_timeout_minutes()} 分钟）"
                    }
                )
                
                # 从活跃任务集合中移除
                task_key = f"row_task:{task.id}"
                self._active_tasks.discard(task_key)
            
    def _get_max_concurrent_tasks(self) -> int:
        """获取最大并发任务数"""
        config = get_eval_config()
        return config.get_max_concurrent_tasks()
    
    
    def _get_task_timeout_minutes(self) -> int:
        """获取任务超时时间（分钟）"""
        config = get_eval_config()
        return config.get_task_timeout_minutes()
    
    # 公共方法
    
    async def get_scheduler_status(self) -> Dict[str, Any]:
        """获取调度器状态"""
        # 统计不同类型的活跃任务
        column_tasks = len([k for k in self._active_tasks if k.startswith("column_task:")])
        row_tasks = len([k for k in self._active_tasks if k.startswith("row_task:")])
        
        return {
            "running": self._running,
            "active_tasks": len(self._active_tasks),
            "active_column_tasks": column_tasks,
            "active_row_tasks": row_tasks,
            "active_task_keys": list(self._active_tasks),
            "max_concurrent_tasks": self._get_max_concurrent_tasks(),
            "last_check": datetime.utcnow().isoformat()
        }
    
    async def force_schedule_row_task_batch(self, result_id: int, dataset_item_ids: Optional[List[int]] = None) -> bool:
        """强制调度指定result的行任务批次"""
        try:
            # 检查是否有可用的调度槽位
            max_concurrent_tasks = self._get_max_concurrent_tasks()
            if len(self._active_tasks) >= max_concurrent_tasks:
                logger.warning("无可用调度槽位，无法强制调度行任务批次")
                return False
            
            # 创建行任务批次执行任务
            row_task_executor = EvalRowTaskExecutor()
            
            # 生成任务标识
            task_key = f"row_batch:{result_id}"
            
            # 检查是否已在活跃任务中
            if task_key in self._active_tasks:
                logger.warning(f"行任务批次 {result_id} 已在执行中")
                return False
            
            # 添加到活跃任务集合
            self._active_tasks.add(task_key)
            
            # 异步执行批量行任务
            async def execute_batch():
                try:
                    success = await row_task_executor.execute_row_tasks_batch(result_id, dataset_item_ids)
                    logger.info(f"强制调度行任务批次 {result_id} 执行完成: {success}")
                    return success
                except Exception as e:
                    logger.error(f"强制调度行任务批次 {result_id} 执行失败: {str(e)}", exc_info=True)
                    return False
                finally:
                    self._active_tasks.discard(task_key)
            
            asyncio.create_task(execute_batch())
            
            logger.info(f"强制调度行任务批次 {result_id}")
            return True
            
        except Exception as e:
            logger.error(f"强制调度行任务批次 {result_id} 失败: {str(e)}", exc_info=True)
            task_key = f"row_batch:{result_id}"
            self._active_tasks.discard(task_key)
            return False
    
    async def pause_scheduler(self) -> None:
        """暂停调度器（不停止已运行的任务）"""
        self._running = False
        logger.info("调度器已暂停")
    
    async def resume_scheduler(self) -> None:
        """恢复调度器"""
        if not self._running:
            self._running = True
            logger.info("调度器已恢复")
            
            # 重新启动调度循环
            if not self._scheduler_task or self._scheduler_task.done():
                self._scheduler_task = asyncio.create_task(self._scheduler_loop())


# 全局调度器实例
_scheduler_instance: Optional[EvalTaskScheduler] = None


async def get_scheduler() -> EvalTaskScheduler:
    """获取调度器实例"""
    global _scheduler_instance
    if _scheduler_instance is None:
        # 创建调度器实例
        _scheduler_instance = EvalTaskScheduler()
    
    return _scheduler_instance


async def start_global_scheduler() -> None:
    """启动全局调度器"""
    scheduler = await get_scheduler()
    await scheduler.start_scheduler()


async def stop_global_scheduler() -> None:
    """停止全局调度器"""
    global _scheduler_instance
    if _scheduler_instance:
        await _scheduler_instance.stop_scheduler()
        _scheduler_instance = None 