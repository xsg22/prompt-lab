"""评估任务管理器"""

from datetime import datetime, timedelta
import logging
from typing import Dict, Any, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select, update, delete, and_, func
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.core.eval_config import get_eval_config
from app.db.session import get_db_session
from app.models.eval_task import (
    EvalTask, EvalTaskItem, EvalTaskLog, TaskStatus, TaskItemStatus, LogLevel
)
from app.models.evaluation import EvalPipeline, EvalColumn, EvalCell, EvalResult
from app.models.dataset import DatasetItem
from app.schemas.eval_task import (
    EvalTaskCreate, EvalTaskResponse, EvalTaskDetailResponse,
    EvalTaskListQuery, EvalTaskExecutionRequest, EvalTaskProgressResponse
)
from app.services.base import CRUDBase

logger = get_logger(__name__)

class EvalTaskManager:
    """评估任务管理器"""
    
    def __init__(self):
        # 保持兼容性，但优先使用独立会话
        self.task_crud = CRUDBase(EvalTask)
        self.task_item_crud = CRUDBase(EvalTaskItem)
        self.task_log_crud = CRUDBase(EvalTaskLog)
    
    def get_config(self, config_key: str):
        """获取配置值（兼容性方法）"""
        config = get_eval_config()
        return config.get(config_key)
    
    
    async def create_task(
        self, 
        request: EvalTaskExecutionRequest, 
        eval_result_id: int,
        user_id: int
    ) -> EvalTaskResponse:
        """创建评估任务"""
        # 验证流水线和列是否存在
        pipeline = await self._get_pipeline(request.pipeline_id)
        # 获取需要处理的数据项
        dataset_items = await self._get_dataset_items(
            pipeline.dataset_id, 
            request.dataset_item_ids
        )
        return await self.create_task_by_pipeline(request, pipeline, eval_result_id, user_id, dataset_items)
    
    
    async def create_task_by_pipeline(
        self, 
        request: EvalTaskExecutionRequest, 
        pipeline: EvalPipeline,
        eval_result_id: int,
        user_id: int,
        dataset_items: List[DatasetItem]
    ) -> EvalTaskResponse:
        """创建评估任务"""
        try:
            # 验证流水线和列是否存在
            column_id = request.column_id
            
            # 检查是否已有相同的任务在运行
            existing_task = await self._get_running_task(
                eval_result_id, 
                column_id
            )
            
            if existing_task:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"流水线 {request.pipeline_id} 的列 {column_id} 已有任务在运行"
                )
            
            if not dataset_items:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="没有找到需要处理的数据项"
                )
            
            # 创建任务            
            task = EvalTask(
                pipeline_id=request.pipeline_id,
                result_id=eval_result_id,
                column_id=column_id,
                task_type="column_evaluation",
                priority=request.priority,
                max_retries=request.max_retries,
                config=request.config or {},
                user_id=user_id,
                total_items=len(dataset_items),
                status=TaskStatus.PENDING
            )
            
            async with get_db_session() as db:
                db.add(task)
                await db.flush()  # 获取任务ID
            
            # 创建任务项
            await self._create_task_items(task.id, column_id, dataset_items, eval_result_id)
            
            # 记录日志
            await self._log_task_event(
                task.id, 
                LogLevel.INFO, 
                f"任务创建成功，共 {len(dataset_items)} 个数据项"
            )
            
            return EvalTaskResponse.model_validate(task)
            
        except SQLAlchemyError as e:
            logger.error(f"创建评估任务失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建评估任务失败: {str(e)}"
            )
    
    
    async def get_task(self, task_id: int) -> EvalTaskResponse:
        """获取任务信息"""
        async with get_db_session() as db:
            task = await self.task_crud.get(db, task_id)
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="任务不存在"
                )
            return EvalTaskResponse.model_validate(task)
    
    
    async def get_task_detail(self, task_id: int) -> EvalTaskDetailResponse:
        """获取任务详情"""
        async with get_db_session() as db:
            task = await self.task_crud.get(db, task_id)
            if not task:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="任务不存在"
                )
            
            # 获取任务项
            task_items_result = await db.execute(
                select(EvalTaskItem).where(EvalTaskItem.task_id == task_id)
            )
            task_items = task_items_result.scalars().all()
            
            # 获取最近的日志
            recent_logs_result = await db.execute(
                select(EvalTaskLog)
                .where(EvalTaskLog.task_id == task_id)
                .order_by(EvalTaskLog.created_at.desc())
                .limit(50)
            )
            recent_logs = recent_logs_result.scalars().all()
            
            return EvalTaskDetailResponse(
                **task.__dict__,
                task_items=task_items,
                recent_logs=recent_logs
            )
    
    
    async def list_tasks(
        self, 
        query: EvalTaskListQuery,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """获取任务列表"""
        # 构建查询条件
        conditions = []
        
        if query.pipeline_id:
            conditions.append(EvalTask.pipeline_id == query.pipeline_id)
        if query.column_id:
            conditions.append(EvalTask.column_id == query.column_id)
        if query.user_id:
            conditions.append(EvalTask.user_id == query.user_id)
        elif user_id:  # 如果没有指定用户ID，使用当前用户
            conditions.append(EvalTask.user_id == user_id)
        if query.status:
            conditions.append(EvalTask.status == query.status)
        if query.task_type:
            conditions.append(EvalTask.task_type == query.task_type)
        
        # 构建查询
        base_query = select(EvalTask)
        if conditions:
            base_query = base_query.where(and_(*conditions))
        
        # 排序
        if query.order_desc:
            base_query = base_query.order_by(getattr(EvalTask, query.order_by).desc())
        else:
            base_query = base_query.order_by(getattr(EvalTask, query.order_by))
        
        # 分页
        offset = (query.page - 1) * query.page_size
        paginated_query = base_query.offset(offset).limit(query.page_size)
        
        # 执行查询
        async with get_db_session() as db:
            result = await db.execute(paginated_query)
            tasks = result.scalars().all()
            
            # 获取总数
            count_query = select(func.count(EvalTask.id))
            if conditions:
                count_query = count_query.where(and_(*conditions))
            count_result = await db.execute(count_query)
            total = count_result.scalar()
            
            return {
                "tasks": [EvalTaskResponse.model_validate(task) for task in tasks],
                "total": total,
                "page": query.page,
                "page_size": query.page_size,
                "total_pages": (total + query.page_size - 1) // query.page_size
            }
    
    
    async def start_task(self, task_id: int) -> bool:
        """启动任务"""
        return await self._update_task_status(
            task_id, 
            TaskStatus.RUNNING,
            {"started_at": datetime.utcnow()},
            "任务已启动"
        )
    
    
    async def pause_task(self, task_id: int) -> bool:
        """暂停任务"""
        return await self._update_task_status(
            task_id,
            TaskStatus.PAUSED,
            {},
            "任务已暂停"
        )
    
    
    async def resume_task(self, task_id: int) -> bool:
        """恢复任务"""
        return await self._update_task_status(
            task_id,
            TaskStatus.RUNNING,
            {},
            "任务已恢复"
        )
    
    
    async def cancel_task(self, task_id: int) -> bool:
        """取消任务"""
        return await self._update_task_status(
            task_id,
            TaskStatus.CANCELLED,
            {"completed_at": datetime.utcnow()},
            "任务已取消"
        )
    
    
    async def retry_task(self, task_id: int) -> bool:
        """重试任务"""
        async with get_db_session() as db:
            task = await self.task_crud.get(db, task_id)
            if not task:
                return False
        
        if not task.can_retry:
            await self._log_task_event(
                task_id,
                LogLevel.WARN,
                f"任务无法重试：当前重试次数 {task.current_retry}，最大重试次数 {task.max_retries}"
            )
            return False
        
        # 计算下次重试时间
        next_retry_at = await self._calculate_next_retry_time(task.current_retry)
        
        return await self._update_task_status(
            task_id,
            TaskStatus.RETRYING,
            {
                "current_retry": task.current_retry + 1,
                "next_retry_at": next_retry_at,
                "error_message": None
            },
            f"任务已安排重试，第 {task.current_retry + 1} 次重试"
        )
    
    
    async def update_task_progress(
        self, 
        task_id: int, 
        completed_items: int, 
        failed_items: int = 0
    ) -> None:
        """更新任务进度"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalTask)
                    .where(EvalTask.id == task_id)
                    .values(
                        completed_items=completed_items,
                        failed_items=failed_items,
                        updated_at=datetime.utcnow()
                    )
                )
        except SQLAlchemyError as e:
            logger.error(f"更新任务进度失败: {str(e)}", exc_info=True)
    
    
    async def complete_task(self, task_id: int, success: bool = True) -> bool:
        """完成任务"""
        status = TaskStatus.COMPLETED if success else TaskStatus.FAILED
        message = "任务已完成" if success else "任务执行失败"
        
        # 获取任务信息，检查是否为最后一列
        async with get_db_session() as db:
            task = await self.task_crud.get(db, task_id)
            if task:
                await self._check_and_update_eval_result_stats(task.pipeline_id, task.result_id, task.column_id)
        
        return await self._update_task_status(
            task_id,
            status,
            {"completed_at": datetime.utcnow()},
            message
        )
    
    
    async def get_task_progress(self, task_id: int) -> EvalTaskProgressResponse:
        """获取任务进度"""
        async with get_db_session() as db:
            task = await self.task_crud.get(db, task_id)
            if not task:
                raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="任务不存在"
            )
        
        # 估算剩余时间
        estimated_remaining_time = None
        if task.status == TaskStatus.RUNNING and task.completed_items > 0:
            elapsed_time = (datetime.utcnow() - task.started_at).total_seconds()
            avg_time_per_item = elapsed_time / task.completed_items
            remaining_items = task.total_items - task.completed_items
            estimated_remaining_time = int(avg_time_per_item * remaining_items)
        
        # 获取当前处理的项目
        current_item = None
        if task.status == TaskStatus.RUNNING:
            async with get_db_session() as db:
                current_item_result = await db.execute(
                    select(EvalTaskItem)
                    .where(
                        EvalTaskItem.task_id == task_id,
                        EvalTaskItem.status == TaskItemStatus.RUNNING
                    )
                    .limit(1)
                )
            current_task_item = current_item_result.scalar_one_or_none()
            if current_task_item:
                current_item = f"数据项 {current_task_item.dataset_item_id}"
        
        return EvalTaskProgressResponse(
            task_id=task.id,
            status=task.status,
            progress_percentage=task.progress_percentage,
            total_items=task.total_items,
            completed_items=task.completed_items,
            failed_items=task.failed_items,
            estimated_remaining_time=estimated_remaining_time,
            current_item=current_item,
            last_updated=task.updated_at
        )
    
    
    async def cleanup_completed_tasks(self, days: Optional[int] = None) -> int:
        """清理已完成的任务"""
        if days is None:
            config = get_eval_config()
            days = config.get_cleanup_completed_tasks_days()
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        try:
            async with get_db_session() as db:
                result = await db.execute(
                    delete(EvalTask)
                    .where(
                        and_(
                            EvalTask.status.in_([TaskStatus.COMPLETED, TaskStatus.CANCELLED]),
                            EvalTask.completed_at < cutoff_date
                        )
                    )
                )
            
            deleted_count = result.rowcount
            
            logger.info(f"清理了 {deleted_count} 个已完成的任务")
            return deleted_count
            
        except SQLAlchemyError as e:
            logger.error(f"清理任务失败: {str(e)}", exc_info=True)
            return 0
    

    
    # 私有方法
    
    async def _get_pipeline(self, pipeline_id: int) -> EvalPipeline:
        """获取流水线"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalPipeline).where(EvalPipeline.id == pipeline_id)
            )
        pipeline = result.scalar_one_or_none()
        
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估流水线不存在"
            )
        
        return pipeline
    
    async def _get_column(self, column_id: int) -> EvalColumn:
        """获取列"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalColumn).where(EvalColumn.id == column_id)
            )
        column = result.scalar_one_or_none()
        
        if not column:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估列不存在"
            )
        
        return column
    
    async def _get_running_task(
        self, 
        result_id: int, 
        column_id: int
    ) -> Optional[EvalTask]:
        """获取正在运行的任务"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTask).where(
                    and_(
                        EvalTask.result_id == result_id,
                        EvalTask.column_id == column_id,
                        EvalTask.status.in_([TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.RETRYING])
                    )
                )
            )
        return result.scalar_one_or_none()
    
    async def _get_dataset_items(
        self, 
        dataset_id: int, 
        item_ids: Optional[List[int]] = None
    ) -> List[DatasetItem]:
        """获取数据集项"""
        query = select(DatasetItem).where(DatasetItem.dataset_id == dataset_id)
        
        if item_ids:
            query = query.where(DatasetItem.id.in_(item_ids))
        
        async with get_db_session() as db:
            result = await db.execute(query)
            return result.scalars().all()
    
    async def _create_task_items(
        self, 
        task_id: int, 
        column_id: int, 
        dataset_items: List[DatasetItem],
        eval_result_id: int
    ) -> None:
        """创建任务项"""
        logging.info(f"创建任务项: {task_id}, {column_id}, {eval_result_id}")
        # 批量创建任务项
        dataset_item_map = {dataset_item.id: dataset_item for dataset_item in dataset_items}
        async with get_db_session() as db:
            cells = await db.execute(
                select(EvalCell).where(
                    and_(
                        EvalCell.eval_column_id == column_id,
                        EvalCell.dataset_item_id.in_(dataset_item_map.keys()),
                        EvalCell.result_id == eval_result_id,
                        EvalCell.status == 'new'
                    )
                )
            )
        cells = cells.scalars().all()
        logging.info(f"获取到的评估单元格: {cells}")
        
        # 批量创建任务项
        task_items = []
        for cell in cells:
            task_item = EvalTaskItem(
                task_id=task_id,
                cell_id=cell.id,
                dataset_item_id=cell.dataset_item_id,
                status=TaskItemStatus.PENDING,
                input_data={"variables": dataset_item_map[cell.dataset_item_id].variables_values}
            )
            task_items.append(task_item)
        
        async with get_db_session() as db:
            if task_items:
                # 将ORM对象转换为字典进行高性能批量插入
                task_item_mappings = []
                for item in task_items:
                    item_dict = {
                        'task_id': item.task_id,
                        'cell_id': item.cell_id,
                        'dataset_item_id': item.dataset_item_id,
                        'status': item.status,
                        'retry_count': item.retry_count,
                        'input_data': item.input_data,
                        'output_data': item.output_data,
                        'error_message': item.error_message,
                        'execution_time_ms': item.execution_time_ms,
                        'started_at': item.started_at,
                        'completed_at': item.completed_at
                    }
                    task_item_mappings.append(item_dict)
                
                # 使用bulk_insert_mappings进行真正的批量插入
                await db.run_sync(
                    lambda session: session.bulk_insert_mappings(EvalTaskItem, task_item_mappings)
                )
            await db.commit()
    
    async def _update_task_status(
        self, 
        task_id: int, 
        status: TaskStatus,
        extra_fields: Dict[str, Any],
        log_message: str
    ) -> bool:
        """更新任务状态"""
        try:
            update_data = {"status": status}
            update_data.update(extra_fields)
            
            async with get_db_session() as db:
                result = await db.execute(
                    update(EvalTask)
                    .where(EvalTask.id == task_id)
                    .values(**update_data)
                )
            
            if result.rowcount == 0:
                return False
            
            # 记录日志
            await self._log_task_event(task_id, LogLevel.INFO, log_message)
            
            return True
            
        except SQLAlchemyError as e:
            logger.error(f"更新任务状态失败: {str(e)}", exc_info=True)
            return False
        
    async def _log_task_event(
        self, 
        task_id: int, 
        level: LogLevel, 
        message: str,
        task_item_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """记录任务事件"""
        try:
            log_entry = EvalTaskLog(
                task_id=task_id,
                task_item_id=task_item_id,
                level=level,
                message=message,
                details=details
            )
            async with get_db_session() as db:
                db.add(log_entry)
        except Exception as e:
            logger.error(f"记录任务日志失败: {str(e)}", exc_info=True)
    
    async def _calculate_next_retry_time(self, retry_count: int) -> datetime:
        """计算下次重试时间"""
        # 获取重试延迟配置
        config = get_eval_config()
        delays = config.get_retry_delays()
        
        # 获取对应的延迟时间
        delay_index = min(retry_count, len(delays) - 1)
        delay_seconds = delays[delay_index]
        
        return datetime.utcnow() + timedelta(seconds=delay_seconds)
    
    async def _check_and_update_eval_result_stats(self, pipeline_id: int, result_id: int, completed_column_id: int) -> None:
        """检查是否为最后一列完成，并更新评估结果统计信息"""
        try:
            async with get_db_session() as db:
                # 获取流水线的所有评估列（排除dataset_variable和human_input）
                eval_columns_result = await db.execute(
                    select(EvalColumn).where(
                        and_(
                            EvalColumn.pipeline_id == pipeline_id,
                            EvalColumn.column_type.notin_(['dataset_variable', 'human_input'])
                        )
                    ).order_by(EvalColumn.position)
                )
                eval_columns = eval_columns_result.scalars().all()
                
                if not eval_columns:
                    return
                
                # 获取最后一列（位置最大的列）
                last_column = max(eval_columns, key=lambda x: x.position)
                
                # 检查是否刚刚完成的是最后一列
                if completed_column_id != last_column.id:
                    return
                
                # 检查最后一列是否所有任务都已完成
                pending_tasks_result = await db.execute(
                    select(func.count(EvalTask.id)).where(
                        and_(
                            EvalTask.result_id == result_id,
                            EvalTask.column_id == last_column.id,
                            EvalTask.status.in_([TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.RETRYING])
                        )
                    )
                )
                pending_count = pending_tasks_result.scalar()
                
                if pending_count > 0:
                    return  # 还有未完成的任务
                
                # 统计最后一列的true/false结果
                last_column_cells_result = await db.execute(
                    select(EvalCell).where(
                        and_(
                            EvalCell.result_id == result_id,
                            EvalCell.eval_column_id == last_column.id,
                            EvalCell.status == 'completed'
                        )
                    )
                )
                last_column_cells = last_column_cells_result.scalars().all()
                
                total_count = len(last_column_cells)
                passed_count = 0
                failed_count = 0
                
                # 统计true/false结果
                for cell in last_column_cells:
                    if cell.value and isinstance(cell.value, dict):
                        value = cell.value.get('value')
                        # 检查结果是否为true（布尔值或字符串）
                        if value is True or (isinstance(value, str) and value.lower() in ['true', '1', 'yes', 'pass', 'passed']):
                            passed_count += 1
                        else:
                            failed_count += 1
                    else:
                        failed_count += 1  # 无效结果视为失败
                
                # 计算成功率
                success_rate = (passed_count / total_count) if total_count > 0 else 0.0
                
                # 更新EvalResult的统计字段
                await db.execute(
                    update(EvalResult).where(EvalResult.id == result_id).values(
                        total_count=total_count,
                        passed_count=passed_count,
                        failed_count=failed_count,
                        success_rate=success_rate
                    )
                )
                await db.commit()
                
                logger.info(f"评估结果统计更新完成 - 结果ID: {result_id}, 总数: {total_count}, 通过: {passed_count}, 失败: {failed_count}, 成功率: {success_rate:.2%}")
                
        except Exception as e:
            logger.error(f"更新评估结果统计信息失败: {str(e)}", exc_info=True)