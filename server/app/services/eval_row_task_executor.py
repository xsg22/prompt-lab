"""评估行任务执行器 - 按行执行模式"""

import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
import logging

from sqlalchemy import select, update, and_
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger
from app.db.session import get_db_session
from app.models.eval_result_row_task import (
    EvalResultRowTask, RowTaskStatus, RowTaskResult
)
from app.models.evaluation import EvalColumn, EvalCell, EvalResult
from app.models.dataset import DatasetItem
from app.services.evaluation_engine import EvaluationEngine
from app.schemas.eval_result_row_task import EvalResultRowTaskUpdate
from app.services.eval_task_executor import NonRetryableError
from app.services.llm_rate_limiter import LLMRateLimiter

logger = get_logger(__name__)


class EvalRowTaskExecutor:
    """评估行任务执行器"""
    
    def __init__(self, qps: float = 2.0, qpm: float = 60.0):
        self.evaluation_engine = EvaluationEngine()
        self.llm_rate_limiter = LLMRateLimiter(qps=qps, qpm=qpm)
        self._rate_limiting_enabled = False  # 当前是否启用限流
    
    async def _check_eval_result_has_llm_calls(self, result_id: int) -> bool:
        """检查评估结果是否包含大模型调用任务"""
        try:
            async with get_db_session() as db:
                result = await db.execute(
                    select(EvalResult.prompt_versions).where(EvalResult.id == result_id)
                )
                prompt_versions = result.scalar_one_or_none()
                
                # 如果prompt_versions不为空，则表示包含大模型调用
                has_llm_calls = prompt_versions is not None and prompt_versions
                logger.info(f"评估结果{result_id}包含大模型调用: {has_llm_calls}")
                return has_llm_calls
                
        except Exception as e:
            logger.error(f"检查评估结果大模型调用失败: {str(e)}", exc_info=True)
            # 出错时保守处理，假设包含大模型调用
            return True
    
    async def execute_row_tasks_batch(self, result_id: int, dataset_item_ids: Optional[List[int]] = None) -> bool:
        """批量执行行任务"""
        try:
            # 获取待执行的行任务
            row_tasks = await self._get_pending_row_tasks(result_id, dataset_item_ids)
            if not row_tasks:
                logger.info(f"没有待执行的行任务，result_id: {result_id}")
                return True
            
            logger.info(f"开始批量执行行任务，任务数量: {len(row_tasks)}")
            
            # 检查是否包含大模型调用，决定执行策略
            has_llm_calls = await self._check_eval_result_has_llm_calls(result_id)
            
            # 设置限流状态
            self._rate_limiting_enabled = has_llm_calls
            
            # 批量更新任务状态为运行中
            await self._batch_update_task_status(
                [task.id for task in row_tasks], 
                RowTaskStatus.RUNNING
            )
            
            if has_llm_calls:
                # 包含大模型调用，使用串行执行以应用限流
                logger.info(f"检测到大模型调用，使用串行执行模式进行限流")
                results = await self._execute_tasks_sequentially(row_tasks)
            else:
                # 不包含大模型调用，使用并发执行
                logger.info(f"未检测到大模型调用，使用并发执行模式")
                results = await self._execute_tasks_concurrently(row_tasks)
            
            # 统计执行结果
            success_count = sum(1 for result in results if result and not isinstance(result, Exception))
            
            # 记录异常信息
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"行任务执行异常: {row_tasks[i].id}, 错误: {result}")
            
            logger.info(f"批量执行完成，成功: {success_count}/{len(row_tasks)}")
            
            # 更新eval_result统计信息
            await self._update_eval_result_stats(result_id)
            
            return success_count == len(row_tasks)
            
        except Exception as e:
            logger.error(f"批量执行行任务失败: {str(e)}", exc_info=True)
            return False
    
    async def _execute_tasks_sequentially(self, row_tasks: List[EvalResultRowTask]) -> List[Any]:
        """串行执行任务（用于包含大模型调用的场景）"""
        results = []
        
        # 获取评估列信息（按position排序）
        columns = await self._get_pipeline_columns(row_tasks[0].result_id)
        if not columns:
            raise ValueError(f"找不到评估列，result_id: {row_tasks[0].result_id}")
        
        for i, row_task in enumerate(row_tasks):
            try:
                logger.debug(f"串行执行任务 {i+1}/{len(row_tasks)}: {row_task.id}")
                result = await self._execute_single_row_task(row_task, columns)
                results.append(result)
            except Exception as e:
                logger.error(f"串行执行任务异常: {row_task.id}, 错误: {str(e)}")
                results.append(e)
        return results
    
    async def _execute_tasks_concurrently(self, row_tasks: List[EvalResultRowTask]) -> List[Any]:
        """并发执行任务（用于不包含大模型调用的场景）"""
        tasks = []
        
        # 获取评估列信息（按position排序）
        columns = await self._get_pipeline_columns(row_tasks[0].result_id)
        if not columns:
            raise ValueError(f"找不到评估列，result_id: {row_tasks[0].result_id}")
        
        for row_task in row_tasks:
            task = asyncio.create_task(self._execute_single_row_task(row_task, columns))
            tasks.append(task)
        
        # 等待所有任务完成
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _execute_single_row_task(self, row_task: EvalResultRowTask, columns: List[EvalColumn]) -> bool:
        """执行单个行任务"""
        start_time = time.time()
        
        try:
            # 获取数据集项信息
            dataset_item = await self._get_dataset_item(row_task.dataset_item_id)
            if not dataset_item:
                raise ValueError(f"找不到数据集项，dataset_item_id: {row_task.dataset_item_id}")
            
            # 初始化执行变量（从数据集变量开始）
            execution_variables = dataset_item.variables_values.copy() if dataset_item.variables_values else {}
            
            # 按position顺序执行每列
            for column in columns:
                
                # 更新当前执行到的列位置
                await self._update_row_task_current_position(row_task.id, column.position)
                
                # 执行当前列
                logger.info(f"执行列: {column.name}")
                column_result = await self._execute_column_for_row(
                    column, dataset_item, execution_variables, row_task.result_id
                )
                if not column_result.get("success", False):
                    # 列执行失败
                    error_msg = column_result.get("error", f"列 {column.name} 执行失败")
                    await self._update_row_task_failed(
                        row_task.id, error_msg, int((time.time() - start_time) * 1000)
                    )
                    return False
                
                # 将当前列的结果添加到执行变量中，供下一列使用
                column_value = column_result.get("value")
                if column_value is not None:
                    execution_variables[column.name] = column_value
                
                logger.info(f"执行列: {column.name} 成功")
            
            # 所有列执行成功，判断最后一列的结果
            last_column = columns[-1]
            if last_column.column_type in ['exact_match', 'exact_multi_match', 'contains', 'regex']:
                # 最后一列是布尔类型，根据结果判断passed/unpassed
                last_value = execution_variables.get(last_column.name)
                row_result = RowTaskResult.PASSED if last_value else RowTaskResult.UNPASSED
            else:
                # 如果最后一列不是布尔类型，默认为passed
                row_result = RowTaskResult.PASSED
            
            # 更新行任务为完成状态
            await self._update_row_task_completed(
                row_task.id, 
                row_result, 
                execution_variables,
                int((time.time() - start_time) * 1000)
            )
            
            # 更新eval_result统计信息
            await self._update_eval_result_stats(row_task.result_id)
            
            return True
            
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            logger.error(f"执行行任务失败: {row_task.id}, 错误: {str(e)}", exc_info=True)
            
            await self._update_row_task_failed(
                row_task.id, str(e), execution_time_ms
            )
            return False
    
    async def _execute_column_for_row(
        self, 
        column: EvalColumn, 
        dataset_item: DatasetItem, 
        variables: Dict[str, Any],
        result_id: int
    ) -> Dict[str, Any]:
        """为行执行单个列"""
        try:
            # 获取对应的eval_cell
            eval_cell = await self._get_eval_cell(result_id, dataset_item.id, column.id)
            if not eval_cell:
                # 如果eval_cell不存在，则创建一个
                async with get_db_session() as db:
                    eval_cell = EvalCell(
                        pipeline_id=column.pipeline_id,
                        result_id=result_id,
                        dataset_item_id=dataset_item.id,
                        eval_column_id=column.id,
                        status="pending",
                    )
                    db.add(eval_cell)
                    await db.commit()
            
            config = column.config or {}

            # 根据列类型执行评估
            if column.column_type == "dataset_variable":
                # 数据集变量列，直接合并到变量中，不需要执行
                await self._update_eval_cell_success(eval_cell.id, variables)
                # 不用返回value
                return {"success": True}
            elif column.column_type == "prompt_template":
                # 提示词模板评估
                prompt_id = config.get("prompt_id")
                logger.info(f"prompt_id: {prompt_id}. {config}")
                if not prompt_id:
                    raise NonRetryableError("提示词模板ID未配置")
                
                variable_mappings = config.get("variable_mappings", {})
                prompt_variables = {}
                for key, value in variable_mappings.items():
                    if value in variables:
                        prompt_variables[key] = variables[value]

                # 如果启用限流，在调用大模型前等待许可
                if self._rate_limiting_enabled:
                    logger.debug(f"大模型调用前进行限流检查，prompt_id: {prompt_id}")
                    await self.llm_rate_limiter.acquire()

                template_result = await self.evaluation_engine.evaluate_prompt_version(
                    prompt_id=int(prompt_id),
                    user_id=config.get("user_id", 0),
                    input_variables=prompt_variables,
                    model_override=config.get("model_override")
                )
                
                if template_result.get("success", False):
                    output = template_result.get("output", "")
                    await self._update_eval_cell_success(eval_cell.id, output)
                    return {"success": True, "value": output}
                else:
                    error = template_result.get("error", "")
                    await self._update_eval_cell_failed(eval_cell.id, error)
                    return {"success": False, "error": error}
                        
            elif column.column_type == "human_input":
                # 人工输入，使用配置中的默认值或现有值
                value = eval_cell.value.get("value", "") if eval_cell.value else column.config.get("default_value", "")
                await self._update_eval_cell_success(eval_cell.id, value)
                return {"success": True, "value": value}

            elif column.column_type == 'exact_multi_match':
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
                detail = {
                    "success": passed,
                    "value": {"value": passed},
                    "display_value": {"value": output},
                    "details": eval_details,
                    "error": "\n".join(eval_details.get("failed_pairs", []))
                }
                await self._update_eval_cell_success(eval_cell.id, passed)
                return {"success": True, "value": passed}
            elif column.column_type in ["exact_match", "contains", "regex", "type_validation", "llm_assertion"]:
                # 检查是否需要从前面的列获取输入
                reference_column = config.get("reference_column")
                input_value = ""
                expected_output = ""
                if reference_column and str(reference_column) in variables:
                    input_value = variables[str(reference_column)]

                expected_column = config.get('expected_column')
                if expected_column and str(expected_column) in variables:
                    expected_output = variables[str(expected_column)]
                
                # 将exact_match转换为exact等评估策略名称
                column_type = column.column_type
                eval_strategy = column_type.replace("_match", "") if "_match" in column_type else column_type
                
                # 如果是llm_assertion类型且启用限流，在调用前等待许可
                if column.column_type == "llm_assertion" and self._rate_limiting_enabled:
                    logger.debug(f"LLM断言调用前进行限流检查，列: {column.name}")
                    await self.llm_rate_limiter.acquire()
                
                passed, eval_details = await self.evaluation_engine.evaluate_output(
                    output=str(input_value),
                    expected_output=expected_output,
                    strategy=eval_strategy,
                    config=config
                )
                
                await self._update_eval_cell_success(eval_cell.id, passed)
                return {"success": True, "value": passed}
            else:
                # 其他类型的列，直接失败
                await self._update_eval_cell_failed(eval_cell.id, "不支持的评估类型")
                return {"success": False, "error": "不支持的评估类型"}
        except Exception as e:
            error_msg = f"执行列 {column.name} 时发生异常: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {"success": False, "error": error_msg}
    
    # 数据库操作方法
    
    async def _get_pending_row_tasks(self, result_id: int, dataset_item_ids: Optional[List[int]] = None) -> List[EvalResultRowTask]:
        """获取待执行的行任务"""
        async with get_db_session() as db:
            query = select(EvalResultRowTask).where(
                and_(
                    EvalResultRowTask.result_id == result_id,
                    EvalResultRowTask.status == RowTaskStatus.PENDING
                )
            )
            
            if dataset_item_ids:
                query = query.where(EvalResultRowTask.dataset_item_id.in_(dataset_item_ids))
                
            result = await db.execute(query)
            return result.scalars().all()
    
    async def _get_pipeline_columns(self, result_id: int) -> List[EvalColumn]:
        """获取评估流水线的列（按position排序）"""
        async with get_db_session() as db:
            # 先获取pipeline_id
            result_query = await db.execute(
                select(EvalResult.pipeline_id).where(EvalResult.id == result_id)
            )
            pipeline_id = result_query.scalar_one_or_none()
            
            if not pipeline_id:
                return []
            
            # 获取列信息
            columns_result = await db.execute(
                select(EvalColumn).where(
                    EvalColumn.pipeline_id == pipeline_id
                ).order_by(EvalColumn.position)
            )
            return columns_result.scalars().all()
    
    async def _get_dataset_item(self, dataset_item_id: int) -> Optional[DatasetItem]:
        """获取数据集项"""
        async with get_db_session() as db:
            result = await db.execute(
                select(DatasetItem).where(DatasetItem.id == dataset_item_id)
            )
            return result.scalar_one_or_none()
    
    async def _get_eval_cell(self, result_id: int, dataset_item_id: int, column_id: int) -> Optional[EvalCell]:
        """获取评估单元格"""
        async with get_db_session() as db:
            result = await db.execute(
                select(EvalCell).where(
                    and_(
                        EvalCell.result_id == result_id,
                        EvalCell.dataset_item_id == dataset_item_id,
                        EvalCell.eval_column_id == column_id
                    )
                )
            )
            return result.scalar_one_or_none()
    
    async def _batch_update_task_status(self, task_ids: List[int], status: RowTaskStatus) -> None:
        """批量更新任务状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalResultRowTask)
                    .where(EvalResultRowTask.id.in_(task_ids))
                    .values(
                        status=status,
                        started_at=datetime.utcnow() if status == RowTaskStatus.RUNNING else None
                    )
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"批量更新任务状态失败: {str(e)}", exc_info=True)
    
    async def _update_row_task_current_position(self, task_id: int, position: int) -> None:
        """更新行任务当前执行位置"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalResultRowTask)
                    .where(EvalResultRowTask.id == task_id)
                    .values(current_column_position=position)
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新行任务当前位置失败: {str(e)}", exc_info=True)
    
    async def _update_row_task_completed(
        self, 
        task_id: int, 
        row_result: RowTaskResult, 
        execution_variables: Dict[str, Any],
        execution_time_ms: int
    ) -> None:
        """更新行任务为完成状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalResultRowTask)
                    .where(EvalResultRowTask.id == task_id)
                    .values(
                        status=RowTaskStatus.COMPLETED,
                        row_result=row_result,
                        execution_variables=execution_variables,
                        execution_time_ms=execution_time_ms,
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新行任务完成状态失败: {str(e)}", exc_info=True)
    
    async def _update_row_task_failed(self, task_id: int, error_message: str, execution_time_ms: int) -> None:
        """更新行任务为失败状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalResultRowTask)
                    .where(EvalResultRowTask.id == task_id)
                    .values(
                        status=RowTaskStatus.FAILED,
                        row_result=RowTaskResult.FAILED,
                        error_message=error_message,
                        execution_time_ms=execution_time_ms,
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新行任务失败状态失败: {str(e)}", exc_info=True)
    
    async def _update_eval_cell_success(self, cell_id: int, value: Any) -> None:
        """更新评估单元格为成功状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalCell)
                    .where(EvalCell.id == cell_id)
                    .values(
                        status="completed",
                        value={"value": value},
                        display_value={"value": value},
                        error_message=None
                    )
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新评估单元格成功状态失败: {str(e)}", exc_info=True)
    
    async def _update_eval_cell_failed(self, cell_id: int, error_message: str) -> None:
        """更新评估单元格为失败状态"""
        try:
            async with get_db_session() as db:
                await db.execute(
                    update(EvalCell)
                    .where(EvalCell.id == cell_id)
                    .values(
                        status="failed",
                        error_message=error_message,
                        display_value={"value": error_message}
                    )
                )
                await db.commit()
        except SQLAlchemyError as e:
            logger.error(f"更新评估单元格失败状态失败: {str(e)}", exc_info=True)
    
    async def _update_eval_result_stats(self, result_id: int) -> None:
        """更新评估结果统计信息"""
        try:
            async with get_db_session() as db:
                # 统计行任务结果
                row_tasks_result = await db.execute(
                    select(EvalResultRowTask).where(EvalResultRowTask.result_id == result_id)
                )
                row_tasks = row_tasks_result.scalars().all()
                
                total_count = len(row_tasks)
                passed_count = len([t for t in row_tasks if t.row_result == RowTaskResult.PASSED])
                unpassed_count = len([t for t in row_tasks if t.row_result == RowTaskResult.UNPASSED])
                failed_count = len([t for t in row_tasks if t.row_result == RowTaskResult.FAILED])
                
                # 计算成功率（passed + unpassed 都算完成）
                completed_count = passed_count + unpassed_count
                success_rate = completed_count / total_count if total_count > 0 else 0.0
                
                # 检查是否所有任务都完成
                all_finished = all(task.is_finished for task in row_tasks)
                status = "completed" if all_finished else "running"
                
                # 更新eval_result
                await db.execute(
                    update(EvalResult)
                    .where(EvalResult.id == result_id)
                    .values(
                        status=status,
                        total_count=total_count,
                        passed_count=passed_count,
                        unpassed_count=unpassed_count,
                        failed_count=failed_count,
                        success_rate=round(success_rate, 2)
                    )
                )
                await db.commit()
                
        except SQLAlchemyError as e:
            logger.error(f"更新评估结果统计信息失败: {str(e)}", exc_info=True) 