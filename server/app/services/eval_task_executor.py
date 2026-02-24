"""评估任务执行器"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

from sqlalchemy import select, update, and_
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.core.eval_config import get_eval_config
from app.db.session import get_db_session
from app.models.eval_task import (
    EvalTask, EvalTaskItem, EvalTaskLog,
    TaskStatus, TaskItemStatus, LogLevel
)
from app.models.evaluation import EvalColumn, EvalCell
from app.models.dataset import DatasetItem
from app.services.evaluation_engine import EvaluationEngine
from app.services.eval_task_manager import EvalTaskManager

logger = get_logger(__name__)


class RetryableError(Exception):
    """可重试的错误"""
    pass


class NonRetryableError(Exception):
    """不可重试的错误"""
    pass


class EvalTaskExecutor:
    """评估任务执行器"""
    
    def __init__(self):
        self.evaluation_engine = EvaluationEngine()
        self.task_manager = EvalTaskManager()
        self._running_tasks = set()  # 正在运行的任务ID集合
        
    async def execute_task(self, task_id: int) -> bool:
        """执行任务"""
        if task_id in self._running_tasks:
            logger.warning(f"任务 {task_id} 已在执行中")
            return False
        
        try:
            self._running_tasks.add(task_id)
            
            # 获取任务信息
            task = await self._get_task(task_id)
            if not task:
                logger.error(f"任务 {task_id} 不存在")
                return False
            
            # 检查任务状态
            if task.status not in [TaskStatus.PENDING, TaskStatus.RETRYING]:
                logger.warning(f"任务 {task_id} 状态为 {task.status}，无法执行")
                return False
            
            # 更新任务状态为运行中
            await self.task_manager.start_task(task_id)
            
            # 记录开始执行日志
            await self._log_task_event(
                task_id,
                LogLevel.INFO,
                f"开始执行任务，共 {task.total_items} 个数据项"
            )
            
            # 获取待执行的任务项
            pending_items = await self._get_pending_task_items(task_id)
            
            if not pending_items:
                # 没有待执行的项目，直接完成任务
                await self.task_manager.complete_task(task_id, success=True)
                return True
            
            # 执行任务项
            success = await self._execute_task_items(task, pending_items)
            
            # 更新任务完成状态
            await self.task_manager.complete_task(task_id, success=success)
            
            return success
            
        except Exception as e:
            logger.error(f"执行任务 {task_id} 时发生错误: {str(e)}", exc_info=True)
            
            # 记录错误日志
            await self._log_task_event(
                task_id,
                LogLevel.ERROR,
                f"任务执行失败: {str(e)}",
                details={"error_type": type(e).__name__, "traceback": str(e)}
            )
            
            # 判断是否可以重试
            if isinstance(e, RetryableError):
                await self._handle_task_retry(task_id, str(e))
            else:
                await self.task_manager.complete_task(task_id, success=False)
            
            return False
            
        finally:
            self._running_tasks.discard(task_id)
    
    async def execute_task_item(self, task_item_id: int) -> bool:
        """执行单个任务项"""
        start_time = time.time()
        
        try:
            # 获取任务项信息
            task_item = await self._get_task_item(task_item_id)
            if not task_item:
                logger.error(f"任务项 {task_item_id} 不存在")
                return False
            
            # 检查任务项状态
            if task_item.status != TaskItemStatus.PENDING:
                logger.warning(f"任务项 {task_item_id} 状态为 {task_item.status}，无法执行")
                return False
            
            # 更新任务项状态为运行中
            await self._update_task_item_status(
                task_item_id,
                TaskItemStatus.RUNNING,
                {"started_at": datetime.utcnow()}
            )
            
            # 获取相关信息
            task = await self._get_task(task_item.task_id)
            column = await self._get_column(task.column_id)
            
            # 获取前置列的数据
            previous_data = await self._get_previous_column_data(
                task.pipeline_id,
                column.position,
                task_item.dataset_item_id,
                task.result_id
            )
            
            # 执行评估
            result = await self._execute_evaluation(
                column,
                task_item.input_data,
                previous_data,
                task.user_id,
                task.config or {}
            )
            
            # 计算执行时间
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # 更新任务项结果
            await self._update_task_item_result(
                task_item_id,
                result,
                execution_time_ms,
                {"variables": previous_data}
            )
            
            # 更新对应的评估单元格
            await self._update_eval_cell(task_item.cell_id, result)
            
            # 记录成功日志
            await self._log_task_event(
                task.id,
                LogLevel.INFO,
                f"任务项 {task_item_id} 执行成功",
                task_item_id=task_item_id,
                details={"execution_time_ms": execution_time_ms}
            )
            
            return True
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            logger.error(f"执行任务项 {task_item_id} 时发生错误: {str(e)}", exc_info=True)
            
            # 更新任务项为失败状态
            await self._update_task_item_status(
                task_item_id,
                TaskItemStatus.FAILED,
                {
                    "error_message": str(e),
                    "execution_time_ms": execution_time_ms,
                    "completed_at": datetime.utcnow()
                }
            )
            
            # 记录错误日志
            task_item = await self._get_task_item(task_item_id)
            if task_item:
                await self._log_task_event(
                    task_item.task_id,
                    LogLevel.ERROR,
                    f"任务项 {task_item_id} 执行失败: {str(e)}",
                    task_item_id=task_item_id,
                    details={
                        "error_type": type(e).__name__,
                        "execution_time_ms": execution_time_ms
                    }
                )
                
            # 更新对应的评估单元格
            await self._update_eval_cell(task_item.cell_id, {
                "success": False,
                "error": str(e),
                "error_message": str(e)
            })
            
            return False
    
    async def _execute_task_items(
        self, 
        task: EvalTask, 
        task_items: List[EvalTaskItem]
    ) -> bool:
        """执行任务项列表"""
        # 获取并发配置
        max_concurrent_items = self._get_max_concurrent_items()
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(max_concurrent_items)
        
        async def execute_with_semaphore(task_item: EvalTaskItem) -> bool:
            async with semaphore:
                return await self.execute_task_item(task_item.id)
        
        # 并发执行任务项
        tasks = [execute_with_semaphore(item) for item in task_items]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 统计结果
        completed_count = 0
        failed_count = 0
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"任务项 {task_items[i].id} 执行异常: {result}")
                failed_count += 1
            elif result:
                completed_count += 1
            else:
                failed_count += 1
        
        # 更新任务进度
        total_completed = task.completed_items + completed_count
        total_failed = task.failed_items + failed_count
        
        await self.task_manager.update_task_progress(
            task.id,
            total_completed,
            total_failed
        )
        
        # 记录执行结果
        await self._log_task_event(
            task.id,
            LogLevel.INFO,
            f"任务项执行完成：成功 {completed_count}，失败 {failed_count}"
        )
        
        # 判断任务是否成功（至少有一个成功的项目）
        return completed_count > 0
    
    async def _execute_evaluation(
        self,
        column: EvalColumn,
        input_data: Dict[str, Any],
        previous_data: Dict[str, Any],
        user_id: int,
        task_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """执行评估逻辑"""
        column_type = column.column_type
        config = column.config or {}
        variables = input_data.get("variables", {})
        
        # 合并前置列数据到变量中
        variables.update(previous_data)
        
        try:
            if column_type == "prompt_template":
                # 提示词模板评估
                prompt_id = config.get("prompt_id")
                logging.info(f"prompt_id: {prompt_id}. {config}")
                if not prompt_id:
                    raise NonRetryableError("提示词模板ID未配置")
                
                variable_mappings = config.get("variable_mappings", {})
                prompt_variables = {}
                for key, value in variable_mappings.items():
                    if value in variables:
                        prompt_variables[key] = variables[value]
                
                prompt_result = await self.evaluation_engine.evaluate_prompt_version(
                    prompt_id=int(prompt_id),
                    user_id=user_id,
                    input_variables=prompt_variables,
                    model_override=config.get("model_override")
                )
                
                if prompt_result.get("success", False):
                    output = prompt_result.get("output", "")
                    return {
                        "success": True,
                        "value": {"value": output},
                        "display_value": {"value": output},
                        "details": prompt_result
                    }
                else:
                    error_msg = prompt_result.get("error", "提示词执行失败")
                    # 根据错误类型判断是否可重试
                    if "network" in error_msg.lower() or "timeout" in error_msg.lower():
                        raise RetryableError(error_msg)
                    else:
                        raise NonRetryableError(error_msg)
            
            elif column_type == "human_input":
                # 人工输入
                output = config.get("value", "")
                return {
                    "success": True,
                    "value": {"value": output},
                    "display_value": {"value": output}
                }
            
            elif column_type in ["exact_match", "contains", "regex", "exact", "regex_match"]:
                
                # 检查是否需要从前面的列获取输入
                reference_column = config.get("reference_column")
                if reference_column and str(reference_column) in variables:
                    input_value = variables[str(reference_column)]

                expected_column = config.get('expected_column')
                if expected_column and str(expected_column) in variables:
                    expected_output = variables[str(expected_column)]

                logging.info(f"variables: {variables}, expected_column: {expected_column}, config: {config}")
                # 转换评估策略名称
                eval_strategy = column_type.replace("_match", "") if "_match" in column_type else column_type
                
                passed, eval_details = await self.evaluation_engine.evaluate_output(
                    output=str(input_value),
                    expected_output=expected_output,
                    strategy=eval_strategy,
                    config=config
                )
                
                output = "通过" if passed else "未通过"
                return {
                    "success": True,
                    "value": {"value": passed},
                    "display_value": {"value": output},
                    "details": eval_details
                }
            
            elif column_type == "exact_multi_match":
                # 多列精确匹配需要特殊处理
                # 将variables数据添加到config中，供评估引擎使用
                enhanced_config = config.copy()
                enhanced_config["variables"] = variables
                
                passed, eval_details = await self.evaluation_engine.evaluate_output(
                    output="",  # 不使用单一输出值
                    expected_output="",  # 不使用单一期望值
                    strategy="exact_multi_match",
                    config=enhanced_config
                )
                
                output = "通过" if passed else "未通过"
                return {
                    "success": passed,
                    "value": {"value": passed},
                    "display_value": {"value": output},
                    "details": eval_details,
                    "error": "\n".join(eval_details.get("failed_pairs", []))
                }
            
            elif column_type in ["json_extraction", "parse_value", "static_value", 
                                "type_validation", "coalesce", "count"]:
                # 辅助函数
                input_value = ""
                
                # 如果有引用列，使用引用列的输出
                reference_column = config.get("reference_column")
                if reference_column and str(reference_column) in variables:
                    input_value = variables[str(reference_column)]
                
                passed, eval_details = await self.evaluation_engine.evaluate_output(
                    output=str(input_value),
                    expected_output="",
                    strategy=column_type,
                    config=config
                )
                
                # 提取结果值
                output = input_value
                if passed:
                    if "extracted_value" in eval_details:
                        output = eval_details["extracted_value"]
                    elif "parsed_value" in eval_details:
                        output = eval_details["parsed_value"]
                    elif "static_value" in eval_details:
                        output = eval_details["static_value"]
                    elif "coalesced_value" in eval_details:
                        output = eval_details["coalesced_value"]
                    elif "count" in eval_details:
                        output = eval_details["count"]
                
                return {
                    "success": True,
                    "value": {"value": output},
                    "display_value": {"value": output},
                    "details": eval_details
                }
            
            else:
                raise NonRetryableError(f"不支持的评估类型: {column_type}")
                
        except RetryableError as e:
            logger.error(f"评估执行异常, 可重试: {str(e)}", exc_info=True)
            raise  # 重新抛出可重试错误
        except NonRetryableError as e:
            logger.error(f"评估执行异常, 不可重试: {str(e)}", exc_info=True)
            raise  # 重新抛出不可重试错误
        except Exception as e:
            logger.error(f"评估执行异常, 未知错误: {str(e)}", exc_info=True)
            # 其他异常默认为可重试
            raise RetryableError(f"评估执行异常: {str(e)}")
    
    # 辅助方法
    
    async def _get_task(self, task_id: int) -> Optional[EvalTask]:
        """获取任务"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTask).where(EvalTask.id == task_id)
            )
        return result.scalar_one_or_none()
    
    
    async def _get_task_item(self, task_item_id: int) -> Optional[EvalTaskItem]:
        """获取任务项"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTaskItem).where(EvalTaskItem.id == task_item_id)
            )
        return result.scalar_one_or_none()
    
    
    async def _get_column(self, column_id: int) -> Optional[EvalColumn]:
        """获取评估列"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalColumn).where(EvalColumn.id == column_id)
            )
        return result.scalar_one_or_none()
    
    
    async def _get_dataset_item(self, dataset_item_id: int) -> Optional[DatasetItem]:
        """获取数据集项"""
        async with get_db_session() as db:
            result = await db.execute(
                select(DatasetItem).where(DatasetItem.id == dataset_item_id)
            )
        return result.scalar_one_or_none()
    
    
    async def _get_pending_task_items(self, task_id: int) -> List[EvalTaskItem]:
        """获取待执行的任务项"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalTaskItem).where(
                    and_(
                        EvalTaskItem.task_id == task_id,
                        EvalTaskItem.status == TaskItemStatus.PENDING
                    )
                )
            )
        return result.scalars().all()
    
    
    async def _get_previous_column_data(
        self,
        pipeline_id: int,
        current_position: int,
        dataset_item_id: int,
        result_id: int
    ) -> Dict[str, Any]:
        """获取前置列的数据"""
        # 获取位置小于当前列的所有列
        async with get_db_session() as db:
            previous_columns_result = await db.execute(
                select(EvalColumn).where(
                    and_(
                        EvalColumn.pipeline_id == pipeline_id,
                        EvalColumn.position < current_position
                    )
                ).order_by(EvalColumn.position)
            )
        previous_columns = previous_columns_result.scalars().all()
        columns_map = {column.id: column for column in previous_columns}
        
        previous_data = {}
        
        # 获取该列对应数据项的单元格值
        async with get_db_session() as db:
            cell_result = await db.execute(
                select(EvalCell).where(
                    and_(
                        EvalCell.result_id == result_id,
                        EvalCell.eval_column_id.in_([column.id for column in previous_columns]),
                        EvalCell.dataset_item_id == dataset_item_id
                    )
                )
            )
        cells = cell_result.scalars().all()
        
        # 获取数据列的id
        dataset_column_ids = [column.id for column in previous_columns if column.column_type == 'dataset_variable']
        
        for cell in cells:
            if cell.eval_column_id in dataset_column_ids:
                # 数据集变量列，cell.value = {"flag": "1", "quesiton": "qqq", "question_id": "12"}
                for key, value in cell.value.items():
                    previous_data[key] = value
            else:
                # 其他列，cell.value = {"value": "123"}
                if cell.value and "value" in cell.value:
                    previous_data[columns_map[cell.eval_column_id].name] = cell.value.get("value", "")
                else:
                    logger.warning(f"单元格 {cell.id} 的值为空，无法获取前置列数据, cell.value: {cell.to_dict()}")
        
        return previous_data
    
    
    async def _update_task_item_status(
        self,
        task_item_id: int,
        status: TaskItemStatus,
        extra_fields: Dict[str, Any]
    ) -> None:
        """更新任务项状态"""
        try:
            update_data = {"status": status}
            update_data.update(extra_fields)
            
            async with get_db_session() as db:
                await db.execute(
                    update(EvalTaskItem)
                    .where(EvalTaskItem.id == task_item_id)
                    .values(**update_data)
                )
        except SQLAlchemyError as e:
            logger.error(f"更新任务项状态失败: {str(e)}", exc_info=True)
    
    
    async def _update_task_item_result(
        self,
        task_item_id: int,
        result: Dict[str, Any],
        execution_time_ms: int,
        input_data: Dict[str, Any]
    ) -> None:
        """更新任务项结果"""
        status = TaskItemStatus.COMPLETED if result.get("success", False) else TaskItemStatus.FAILED
        
        update_data = {
            "status": status,
            "output_data": result,
            "execution_time_ms": execution_time_ms,
            "input_data": input_data
        }
        
        if not result.get("success", False):
            update_data["error_message"] = result.get("error", "执行失败")
        
        await self._update_task_item_status(task_item_id, status, update_data)
    
    
    async def _update_eval_cell(self, cell_id: int, result: Dict[str, Any]) -> None:
        """更新评估单元格"""
        try:
            status = "completed" if result.get("success", False) else "failed"
            
            update_data = {
                "status": status
            }
            
            if result.get("success", False):
                update_data["value"] = result.get("value")
                update_data["display_value"] = result.get("display_value")
                update_data["error_message"] = None
            else:
                update_data["error_message"] = result.get("error", "执行失败")
                update_data["display_value"] = {"value": result.get("error", "执行失败")}
            
            async with get_db_session() as db:
                await db.execute(
                    update(EvalCell)
                    .where(EvalCell.id == cell_id)
                    .values(**update_data)
                )
        except SQLAlchemyError as e:
            logger.error(f"更新评估单元格失败: {str(e)}", exc_info=True)
    
    
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
    
    
    async def _handle_task_retry(self, task_id: int, error_message: str) -> None:
        """处理任务重试"""
        try:
            # 检查任务是否可以重试
            task = await self._get_task(task_id)
            if not task or not task.can_retry:
                await self.task_manager.complete_task(task_id, success=False)
                return
            
            # 安排重试
            await self.task_manager.retry_task(task_id)
            
        except Exception as e:
            logger.error(f"处理任务重试失败: {str(e)}", exc_info=True)
            await self.task_manager.complete_task(task_id, success=False)
    
    def _get_max_concurrent_items(self) -> int:
        """获取最大并发任务项数"""
        config = get_eval_config()
        return config.get_max_concurrent_items_per_task() 