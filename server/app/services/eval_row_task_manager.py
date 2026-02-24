"""评估行任务管理器"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy import select, and_, update
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.db.session import get_db_session
from app.models.eval_result_row_task import EvalResultRowTask, RowTaskStatus
from app.models.evaluation import EvalResult, EvalPipeline
from app.models.dataset import DatasetItem
from app.schemas.eval_result_row_task import (
    EvalResultRowTaskCreate, RowTaskBatchExecutionRequest
)
from app.services.eval_row_task_executor import EvalRowTaskExecutor

logger = get_logger(__name__)


class EvalRowTaskManager:
    """评估行任务管理器"""
    
    def __init__(self):
        pass
    
    async def create_row_tasks_for_result(
        self, 
        result_id: int, 
        dataset_item_ids: Optional[List[int]] = None
    ) -> List[EvalResultRowTask]:
        """为评估结果创建行任务"""
        try:
            logger.info(f"开始为评估结果创建行任务: result_id={result_id}, dataset_item_ids={dataset_item_ids}")
            
            # 获取评估结果信息
            eval_result = await self._get_eval_result(result_id)
            if not eval_result:
                raise ValueError(f"找不到评估结果，result_id: {result_id}")
            
            # 获取数据集项
            if dataset_item_ids:
                dataset_items = await self._get_dataset_items_by_ids(dataset_item_ids)
            else:
                dataset_items = await self._get_all_dataset_items_for_result(result_id)
            
            if not dataset_items:
                logger.warning(f"没有找到数据集项，result_id: {result_id}")
                return []
           
            # 批量创建行任务
            row_tasks = []
            for dataset_item in dataset_items:
                # 创建新的行任务
                row_task = EvalResultRowTask(
                    result_id=result_id,
                    dataset_item_id=dataset_item.id,
                    status=RowTaskStatus.PENDING,
                    execution_variables=dataset_item.variables_values
                )
                row_tasks.append(row_task)
            
            if row_tasks:
                # 批量插入到数据库
                async with get_db_session() as db:
                    # 批量插入到数据库，使用bulk_insert_mappings
                    row_tasks_dict = [task.to_dict() for task in row_tasks]
                    await db.run_sync(
                        lambda session: session.bulk_insert_mappings(EvalResultRowTask, row_tasks_dict)
                    )
                    await db.commit()
                
                logger.info(f"成功创建 {len(row_tasks)} 个行任务，result_id: {result_id}")
                
                # 重新查询返回创建的任务
                created_tasks_result = await db.execute(
                    select(EvalResultRowTask).where(
                        EvalResultRowTask.result_id == result_id
                    )
                )
                return created_tasks_result.scalars().all()
                
        except Exception as e:
            logger.error(f"创建行任务失败: {str(e)}", exc_info=True)
            return []
    
    async def execute_row_tasks_batch(self, request: RowTaskBatchExecutionRequest) -> Dict[str, Any]:
        """批量执行行任务 - 通过统一调度器调度"""
        try:
            logger.info(f"开始批量执行行任务: {request}")
            
            # 确保存在行任务，如果没有则创建
            await self.create_row_tasks_for_result(
                request.result_id, 
                request.dataset_item_ids
            )
            
            # 更新eval_result状态为运行中
            await self._update_eval_result_status(request.result_id, "running")
            
            # 通过统一调度器执行行任务批次
            from app.services.eval_task_scheduler import get_scheduler
            
            scheduler = await get_scheduler()
            success = await scheduler.force_schedule_row_task_batch(
                request.result_id,
                request.dataset_item_ids
            )
            
            if success:
                logger.info(f"成功提交行任务批次到调度器: result_id={request.result_id}")
                return {
                    "success": True,
                    "message": "行任务批次已提交到调度器执行",
                    "stats": await self._get_execution_stats(request.result_id)
                }
            else:
                logger.error(f"提交行任务批次到调度器失败: result_id={request.result_id}")
                await self._update_eval_result_status(request.result_id, "failed")
                return {
                    "success": False,
                    "message": "提交行任务批次到调度器失败",
                    "stats": {}
                }
            
        except Exception as e:
            logger.error(f"批量执行行任务失败: {str(e)}", exc_info=True)
            
            # 更新eval_result状态为失败
            await self._update_eval_result_status(request.result_id, "failed")
            
            return {
                "success": False,
                "message": f"批量执行失败: {str(e)}",
                "stats": {}
            }
    
    async def execute_row_tasks_directly(self, result_id: int, dataset_item_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """直接执行行任务（不通过调度器）- 用于小规模测试或特殊情况"""
        try:
            logger.info(f"开始直接执行行任务: result_id={result_id}")
            
            # 确保存在行任务，如果没有则创建
            await self.create_row_tasks_for_result(result_id, dataset_item_ids)
            
            # 更新eval_result状态为运行中
            await self._update_eval_result_status(result_id, "running")
            
            # 直接执行行任务
            success = await EvalRowTaskExecutor().execute_row_tasks_batch(
                result_id,
                dataset_item_ids
            )
            
            # 获取执行统计
            stats = await self._get_execution_stats(result_id)
            
            return {
                "success": success,
                "message": "直接执行完成" if success else "直接执行部分失败",
                "stats": stats
            }
            
        except Exception as e:
            logger.error(f"直接执行行任务失败: {str(e)}", exc_info=True)
            
            # 更新eval_result状态为失败
            await self._update_eval_result_status(result_id, "failed")
            
            return {
                "success": False,
                "message": f"直接执行失败: {str(e)}",
                "stats": {}
            }
    
    async def get_row_tasks_for_result(self, result_id: int) -> List[EvalResultRowTask]:
        """获取评估结果的所有行任务"""
        try:
            async with get_db_session() as db:
                result = await db.execute(
                    select(EvalResultRowTask).where(
                        EvalResultRowTask.result_id == result_id
                    ).order_by(EvalResultRowTask.dataset_item_id)
                )
                return result.scalars().all()
                
        except Exception as e:
            logger.error(f"获取行任务失败: {str(e)}", exc_info=True)
            return []
    
    async def get_row_task_progress(self, result_id: int) -> Dict[str, Any]:
        """获取行任务执行进度"""
        try:
            row_tasks = await self.get_row_tasks_for_result(result_id)
            
            total = len(row_tasks)
            if total == 0:
                return {
                    "total": 0,
                    "pending": 0,
                    "running": 0,
                    "completed": 0,
                    "failed": 0,
                    "progress_percent": 0
                }
            
            pending = len([t for t in row_tasks if t.status == RowTaskStatus.PENDING])
            running = len([t for t in row_tasks if t.status == RowTaskStatus.RUNNING])
            completed = len([t for t in row_tasks if t.status == RowTaskStatus.COMPLETED])
            failed = len([t for t in row_tasks if t.status == RowTaskStatus.FAILED])
            
            progress_percent = int(((completed + failed) / total) * 100)
            
            return {
                "total": total,
                "pending": pending,
                "running": running,
                "completed": completed,
                "failed": failed,
                "progress_percent": progress_percent
            }
            
        except Exception as e:
            logger.error(f"获取行任务进度失败: {str(e)}", exc_info=True)
            return {"error": str(e)}
    
    # 私有方法
    
    async def _get_eval_result(self, result_id: int) -> Optional[EvalResult]:
        """获取评估结果"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalResult).where(EvalResult.id == result_id)
            )
            return result.scalar_one_or_none()
    
    async def _get_dataset_items_by_ids(self, item_ids: List[int]) -> List[DatasetItem]:
        """根据ID列表获取数据集项"""
        async with get_db_session() as db:
            result = await db.execute(
                select(DatasetItem).where(
                    and_(
                        DatasetItem.id.in_(item_ids),
                        DatasetItem.is_enabled == True
                    )
                )
            )
            return result.scalars().all()
    
    async def _get_all_dataset_items_for_result(self, result_id: int) -> List[DatasetItem]:
        """获取评估结果对应的所有数据集项"""
        async with get_db_session() as db:
            # 先获取pipeline_id和dataset_id
            result_query = await db.execute(
                select(EvalResult.pipeline_id).where(EvalResult.id == result_id)
            )
            pipeline_id = result_query.scalar_one_or_none()
            
            if not pipeline_id:
                return []
            
            pipeline_query = await db.execute(
                select(EvalPipeline.dataset_id).where(EvalPipeline.id == pipeline_id)
            )
            dataset_id = pipeline_query.scalar_one_or_none()
            
            if not dataset_id:
                return []
            
            # 获取数据集项
            items_result = await db.execute(
                select(DatasetItem).where(
                    and_(
                        DatasetItem.dataset_id == dataset_id,
                        DatasetItem.is_enabled == True
                    )
                )
            )
            return items_result.scalars().all()
    
    async def _get_existing_row_task(self, result_id: int, dataset_item_id: int) -> Optional[EvalResultRowTask]:
        """检查是否已存在行任务"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalResultRowTask).where(
                    and_(
                        EvalResultRowTask.result_id == result_id,
                        EvalResultRowTask.dataset_item_id == dataset_item_id
                    )
                )
            )
            return result.scalar_one_or_none()
    
    async def _update_eval_result_status(self, result_id: int, status: str) -> None:
        """更新评估结果状态"""
        try:
            async with get_db_session() as db:
                from sqlalchemy import update
                await db.execute(
                    update(EvalResult)
                    .where(EvalResult.id == result_id)
                    .values(status=status)
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新评估结果状态失败: {str(e)}", exc_info=True)
    
    async def _get_execution_stats(self, result_id: int) -> Dict[str, Any]:
        """获取执行统计信息"""
        try:
            row_tasks = await self.get_row_tasks_for_result(result_id)
            
            total = len(row_tasks)
            if total == 0:
                return {"total": 0}
            
            from app.models.eval_result_row_task import RowTaskResult
            
            completed_tasks = [t for t in row_tasks if t.status == RowTaskStatus.COMPLETED]
            failed_tasks = [t for t in row_tasks if t.status == RowTaskStatus.FAILED]
            
            passed_count = len([t for t in completed_tasks if t.row_result == RowTaskResult.PASSED])
            unpassed_count = len([t for t in completed_tasks if t.row_result == RowTaskResult.UNPASSED])
            failed_count = len(failed_tasks)
            
            success_rate = (passed_count + unpassed_count) / total if total > 0 else 0.0
            
            return {
                "total": total,
                "passed": passed_count,
                "unpassed": unpassed_count,
                "failed": failed_count,
                "success_rate": round(success_rate, 2),
                "completed": len(completed_tasks),
                "pending": len([t for t in row_tasks if t.status == RowTaskStatus.PENDING]),
                "running": len([t for t in row_tasks if t.status == RowTaskStatus.RUNNING])
            }
            
        except Exception as e:
            logger.error(f"获取执行统计失败: {str(e)}", exc_info=True)
            return {"error": str(e)} 