import asyncio
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.evaluation import EvalPipeline, EvalColumn, EvalResult, EvalCell
from app.models.dataset import Dataset, DatasetItem
from app.schemas.evaluation import (
    EvalPipelineCreate, EvalPipelineList, EvalPipelineUpdate, EvalColumnCreate, 
    EvalColumnUpdate, EvalResultCreate, EvalCellUpdate, SingleColumnEvalRequest
)
from app.schemas.pagination import PaginatedResponse
from app.services.base import CRUDBase
from app.services.evaluation_engine import EvaluationEngine
from app.services.eval_task_manager import EvalTaskManager
from app.services.eval_row_task_manager import EvalRowTaskManager
from app.models.user import Users

logger = get_logger(__name__)


class EvaluationService:
    """评估服务"""
    
    def __init__(self, db: AsyncSession = Depends(get_db), 
                 eval_task_manager: EvalTaskManager = Depends()):
        """初始化"""
        self.db = db
        self.evaluation_engine = EvaluationEngine()
        self.eval_task_manager = eval_task_manager
        
        # 初始化行执行模式相关服务
        self.eval_row_task_manager = EvalRowTaskManager()
        
        self.pipeline_crud = CRUDBase(EvalPipeline)
        self.column_crud = CRUDBase(EvalColumn)
        self.result_crud = CRUDBase(EvalResult)
        self.cell_crud = CRUDBase(EvalCell)
        self.dataset_crud = CRUDBase(Dataset)
        self._task_map = {}  # 存储正在执行的评估任务
    
    # 评估流水线相关方法
    
    async def create_pipeline(self, data: EvalPipelineCreate, user_id: int) -> EvalPipeline:
        """创建评估流水线"""
        try:
            # 创建评估流水线对象
            pipeline = EvalPipeline(
                name=data.name,
                description=data.description,
                project_id=data.project_id,
                dataset_id=data.dataset_id,
                user_id=user_id,
            )
            
            # 添加到数据库
            self.db.add(pipeline)
            await self.db.flush()
            
            # 创建评估结果
            eval_result_create = EvalResultCreate(pipeline_id=pipeline.id, run_type='staging', execution_mode='column_based')
            await self.create_result(pipeline, eval_result_create, data.selected_item_ids)
            
            return pipeline
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建评估流水线失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建评估流水线失败: {str(e)}",
            )
    
    async def change_dataset(self, pipeline_id: int, dataset_id: int, selected_item_ids: Optional[List[int]] = None) -> EvalPipeline:
        # 更新流水线的数据集
        eval_pipeline = await self.get_pipeline(pipeline_id)
        old_dataset_id = eval_pipeline.dataset_id
        eval_pipeline.dataset_id = dataset_id

        # 获取当前的staging eval_result
        eval_result = await self.get_staging_result(pipeline_id)
        if not eval_result:
            # 如果没有staging result，创建一个新的
            eval_result = await self.create_result(eval_pipeline, EvalResultCreate(pipeline_id=eval_pipeline.id, run_type='staging'), selected_item_ids)
            return eval_pipeline

        # 删除当前eval_result下的所有cells数据
        await self.db.execute(delete(EvalCell).where(EvalCell.result_id == eval_result.id))

        # 判断是否更换了数据集
        if old_dataset_id != dataset_id:
            # 换成了新的数据集，删除原来的dataset_variable列
            await self.db.execute(delete(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id, EvalColumn.column_type == 'dataset_variable'))
            # 创建新数据集的dataset_variable列和对应的cells
            await self.create_dataset_variable_column(pipeline_id, dataset_id, eval_result.id, selected_item_ids)
        else:
            # 依然是当前数据集，保留dataset_variable列，只插入新的数据项行
            # 获取现有的dataset_variable列
            dataset_columns = await self.db.execute(
                select(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id, EvalColumn.column_type == 'dataset_variable')
            )
            dataset_column = dataset_columns.scalars().first()
            
            if dataset_column:
                # 为dataset_variable列创建新的数据项cells
                await self._create_dataset_variable_cells(pipeline_id, dataset_id, eval_result.id, dataset_column, selected_item_ids)
            else:
                # 如果没有dataset_variable列，创建一个
                await self.create_dataset_variable_column(pipeline_id, dataset_id, eval_result.id, selected_item_ids)
        
        # 为其他评估列创建新的eval_cell
        columns = await self.db.execute(select(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id, EvalColumn.column_type != 'dataset_variable'))
        columns = columns.scalars().all()
        
        for column in columns:
            await self.create_eval_cells_by_column(pipeline_id, dataset_id, eval_result.id, column)
            
        return eval_pipeline

    async def get_pipeline(self, pipeline_id: int) -> EvalPipeline:
        """获取评估流水线"""
        pipeline = await self.pipeline_crud.get(self.db, pipeline_id)
        if not pipeline:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估流水线未找到",
            )
        return pipeline
    
    async def get_project_pipelines(self, project_id: int, staging: bool) -> List[EvalPipelineList]:
        """获取项目下的所有评估流水线"""
        query = select(
                EvalPipeline, 
                Dataset.name.label("dataset_name"), 
                Users.nickname.label("creator_name"),
                EvalResult.run_type.label("run_type")
            )
        query = query.outerjoin(Dataset, EvalPipeline.dataset_id == Dataset.id)
        query = query.outerjoin(Users, EvalPipeline.user_id == Users.id)
        query = query.outerjoin(EvalResult, EvalPipeline.id == EvalResult.pipeline_id)
        query = query.where(EvalPipeline.project_id == project_id)
        query = query.where(EvalResult.run_type == 'staging') if staging else None
        query = query.order_by(EvalPipeline.updated_at.desc())
        result = await self.db.execute(query)
        result = result.all()
        
        return [EvalPipelineList(
            **pipeline.to_dict(),
            dataset_name=dataset_name,
            creator_name=creator_name,
            run_type=run_type,
        ) for pipeline, dataset_name, creator_name, run_type in result]
    
    async def update_pipeline(self, pipeline_id: int, data: EvalPipelineUpdate) -> EvalPipeline:
        """更新评估流水线"""
        # 获取现有评估流水线
        pipeline = await self.get_pipeline(pipeline_id)
        
        try:
            # 更新评估流水线
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(pipeline, key):
                    setattr(pipeline, key, value)
            
            # 保存更改
            self.db.add(pipeline)
            await self.db.commit()
            await self.db.refresh(pipeline)
            
            return pipeline
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新评估流水线失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新评估流水线失败: {str(e)}",
            )
    
    async def delete_pipeline(self, pipeline_id: int) -> None:
        """删除评估流水线"""
        # 获取现有评估流水线
        pipeline = await self.get_pipeline(pipeline_id)
        
        try:
            # 删除评估流水线
            await self.db.delete(pipeline)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除评估流水线失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除评估流水线失败: {str(e)}",
            )
    
    # 评估列相关方法
    
    async def create_column(self, data: EvalColumnCreate) -> EvalColumn:
        """创建评估列"""
        
        try:
            # 创建评估列
            db_column = EvalColumn(
                pipeline_id=data.pipeline_id,
                name=data.name,
                column_type=data.column_type,
                position=data.position,
                config=data.config,
            )
            
            # 添加到数据库
            self.db.add(db_column)
            await self.db.flush()
            
            return db_column
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建评估列失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建评估列失败: {str(e)}",
            )
    
    async def get_column(self, column_id: int) -> EvalColumn:
        """获取评估列"""
        column = await self.column_crud.get(self.db, column_id)
        if not column:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估列未找到",
            )
        return column
    
    async def get_pipeline_columns(self, pipeline_id: int) -> List[EvalColumn]:
        """获取流水线的所有评估列"""
        result = await self.db.execute(
            select(EvalColumn)
            .where(EvalColumn.pipeline_id == pipeline_id)
            .order_by(EvalColumn.position)
        )
        return result.scalars().all()
    
    async def update_column(self, column_id: int, data: EvalColumnUpdate) -> EvalColumn:
        """更新评估列"""
        # 获取现有评估列
        column = await self.get_column(column_id)
        
        try:
            # 更新评估列
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(column, key):
                    setattr(column, key, value)
            
            # 保存更改
            self.db.add(column)
            await self.db.commit()
            await self.db.refresh(column)
            
            return column
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新评估列失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新评估列失败: {str(e)}",
            )
    
    async def delete_column(self, column_id: int) -> None:
        """删除评估列"""
        # 获取现有评估列
        column = await self.get_column(column_id)
        
        try:
            # 删除评估列
            await self.db.delete(column)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除评估列失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除评估列失败: {str(e)}",
            )
    
    # 评估结果相关方法
    
    async def create_result(self, pipeline: EvalPipeline, data: EvalResultCreate, selected_item_ids: Optional[List[int]] = None) -> EvalResult:
        """创建评估结果"""
        # 检查评估流水线是否存在
        
        try:
            # 获取流水线列配置中的提示词版本信息
            prompt_versions = await self._get_prompt_versions_for_pipeline(pipeline.id)
            
            # 创建评估结果
            eval_result = EvalResult(
                pipeline_id=data.pipeline_id,
                run_type=data.run_type,
                prompt_versions=prompt_versions,
            )
            
            # 添加到数据库
            self.db.add(eval_result)
            await self.db.flush()
            
            # 如果是staging类型，为每个数据集项和每个列创建评估单元格
            if data.run_type == 'staging':
                # 插入数据集变量列
                await self.create_dataset_variable_column(pipeline.id, pipeline.dataset_id, eval_result.id, selected_item_ids)
            else:
                # 对于非staging类型，创建完整的评估结果
                await self.create_full_evaluation_result(pipeline, eval_result)
            
            return eval_result
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建评估结果失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建评估结果失败: {str(e)}",
            )
    
    async def get_result(self, result_id: int) -> EvalResult:
        """获取评估结果"""
        result = await self.result_crud.get(self.db, result_id)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估结果未找到",
            )
        return result
    
    async def get_staging_result(self, pipeline_id: int) -> EvalResult:
        """获取流水线的最新评估结果"""
        result = await self.db.execute(
            select(EvalResult)
            .where(EvalResult.pipeline_id == pipeline_id)
            .where(EvalResult.run_type == 'staging')
            .order_by(EvalResult.created_at.desc())
        )
        return result.scalar_one_or_none()
    
    async def get_pipeline_results(self, pipeline_id: int, exclude_staging: bool = False) -> List[EvalResult]:
        """获取流水线的所有评估结果"""
        query = select(EvalResult).where(EvalResult.pipeline_id == pipeline_id)
        
        if exclude_staging:
            query = query.where(EvalResult.run_type != 'staging')
            
        query = query.order_by(EvalResult.created_at.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_project_evaluation_results(self, project_id: int, exclude_staging: bool = True) -> List[EvalResult]:
        """获取项目下所有流水线的评估结果"""
        query = select(EvalResult).join(EvalPipeline).where(EvalPipeline.project_id == project_id)
        
        if exclude_staging:
            query = query.where(EvalResult.run_type != 'staging')
            
        query = query.order_by(EvalResult.created_at.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def create_full_evaluation_result(self, pipeline: EvalPipeline, eval_result: EvalResult) -> None:
        """创建完整的评估结果，包括所有列和数据集项的单元格"""
        
        # 获取数据集和数据集项
        # dataset = await self.dataset_crud.get(self.db, pipeline.dataset_id)
        dataset_items = await self.db.execute(
            select(DatasetItem).where(DatasetItem.dataset_id == pipeline.dataset_id, DatasetItem.is_enabled == True)
        )
        dataset_items = dataset_items.scalars().all()
        if (len(dataset_items) == 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="启用数据集项为空, 请先创建数据集项",
            )
        
        # 获取流水线的所有列
        columns = await self.get_pipeline_columns(pipeline.id)
        
        # 如果非数据库列数量为0，则直接返回
        custom_columns = [col for col in columns if col.column_type != 'dataset_variable']
        if (len(custom_columns) == 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="评估列数量为0, 请先创建评估列",
            )
        
        # 验证最后一列必须是评估列（exact_multi_match/exact_match/contains/regex）
        last_column = max(custom_columns, key=lambda x: x.position)
        if last_column.column_type not in ['exact_multi_match', 'exact_match', 'contains', 'regex']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="最后一个评估列必须是Boolean类型",
            )
        
        # 批量创建评估单元格
        eval_cells = []
        for dataset_item in dataset_items:
            for column in columns:
                if (column.column_type == 'dataset_variable'):
                    eval_cell = EvalCell(
                        pipeline_id=pipeline.id,
                        dataset_item_id=dataset_item.id,
                        eval_column_id=column.id,
                        result_id=eval_result.id,
                        status='completed',
                        value=dataset_item.variables_values,
                        display_value=dataset_item.variables_values
                    )
                elif (column.column_type == 'human_input'):
                    eval_cell = EvalCell(
                        pipeline_id=pipeline.id,
                        dataset_item_id=dataset_item.id,
                        eval_column_id=column.id,
                        result_id=eval_result.id,
                        status='completed',
                        value={"value": column.config.get('default_value', '')},
                        display_value={"value": column.config.get('default_value', '')}
                    )
                else:
                    eval_cell = EvalCell(
                        pipeline_id=pipeline.id,
                        dataset_item_id=dataset_item.id,
                        eval_column_id=column.id,
                        result_id=eval_result.id,
                        status='new'
                    )
                eval_cells.append(eval_cell)
        
        # 批量插入数据库 - 使用高性能批量插入
        if eval_cells:
            # 将ORM对象转换为字典
            cell_mappings = []
            for cell in eval_cells:
                cell_dict = {
                    'pipeline_id': cell.pipeline_id,
                    'dataset_item_id': cell.dataset_item_id,
                    'eval_column_id': cell.eval_column_id,
                    'result_id': cell.result_id,
                    'status': cell.status,
                    'value': cell.value,
                    'display_value': cell.display_value,
                    'error_message': cell.error_message
                }
                cell_mappings.append(cell_dict)
            
            # 使用bulk_insert_mappings进行真正的批量插入
            await self.db.run_sync(
                lambda session: session.bulk_insert_mappings(EvalCell, cell_mappings)
            )
            await self.db.commit()
        
        # 为非静态列创建任务
        await self.create_evaluation_tasks(pipeline, eval_result, dataset_items, custom_columns)

    async def create_evaluation_tasks(self, pipeline: EvalPipeline, eval_result: EvalResult, 
                                    dataset_items: List, columns: List) -> None:
        """为非静态列创建评估任务"""
        from app.schemas.eval_task import EvalTaskExecutionRequest
        
        # 过滤出需要执行的列（非数据集变量和人工输入列）
        executable_columns = [col for col in columns 
                            if col.column_type not in ['dataset_variable', 'human_input']]
        
        for column in executable_columns:
            # 获取该列对应的数据集项ID列表
            dataset_item_ids = [item.id for item in dataset_items]
            
            # 创建任务执行请求
            task_request = EvalTaskExecutionRequest(
                pipeline_id=pipeline.id,
                column_id=column.id,
                dataset_item_ids=dataset_item_ids,
                priority=column.position or 0,  # 按列的位置排序
                max_retries=3,
                config={}
            )
            
            # 创建持久化任务
            await self.eval_task_manager.create_task_by_pipeline(task_request, pipeline, eval_result.id, pipeline.user_id, dataset_items)
    
    # 评估单元格相关方法
    
    async def get_cell(self, cell_id: int) -> EvalCell:
        """获取评估单元格"""
        cell = await self.cell_crud.get(self.db, cell_id)
        if not cell:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估单元格未找到",
            )
        return cell
    
    async def get_result_cells(self, result_id: int) -> List[EvalCell]:
        """获取评估结果的所有单元格"""
        cells = await self.db.execute(
            select(EvalCell).where(EvalCell.result_id == result_id)
        )
        return cells.scalars().all()
    
    async def get_result_cells_with_column_name(self, result_id: int) -> List[Dict[str, Any]]:
        """获取评估结果的所有单元格"""
        cells = await self.db.execute(
            select(EvalCell, EvalColumn.name.label("column_name"), EvalColumn.column_type.label("column_type"))
            .join(EvalColumn, EvalCell.eval_column_id == EvalColumn.id)
            .where(EvalCell.result_id == result_id)
        )
        cells = cells.all()

        return [dict(cell.to_dict(), **{"column_name": column_name, "column_type": column_type}) for cell, column_name, column_type in cells]
    
    async def get_result_cells_with_column_name_paginated(self, result_id: int, page: int, page_size: int, show_failed_only: bool = False) -> PaginatedResponse:
        """获取评估结果的单元格（按数据行分页）"""
        from sqlalchemy import func, and_
        
        # 如果需要过滤失败记录，先获取最后一列的信息
        if show_failed_only:
            # 获取该结果对应的pipeline_id
            pipeline_result = await self.db.execute(
                select(EvalResult.pipeline_id).where(EvalResult.id == result_id)
            )
            pipeline_id = pipeline_result.scalar_one_or_none()
            
            if not pipeline_id:
                return PaginatedResponse.create([], 0, page, page_size)
            
            # 获取最后一列（按position排序的最后一个非dataset_variable列）
            last_column_result = await self.db.execute(
                select(EvalColumn)
                .where(
                    and_(
                        EvalColumn.pipeline_id == pipeline_id,
                        EvalColumn.column_type != 'dataset_variable'
                    )
                )
                .order_by(EvalColumn.position.desc())
                .limit(1)
            )
            last_column = last_column_result.scalar_one_or_none()
            
            if not last_column:
                return PaginatedResponse.create([], 0, page, page_size)
            
            # 使用更高效的SQL查询来筛选失败的dataset_item_id
            # 这里我们直接使用JSON函数来检查值
            failed_items_result = await self.db.execute(
                select(EvalCell.dataset_item_id)
                .where(
                    and_(
                        EvalCell.result_id == result_id,
                        EvalCell.eval_column_id == last_column.id,
                        EvalCell.status == 'completed',
                        # 检查value.value是否为false
                        func.json_extract(EvalCell.value, '$.value') == False
                    )
                )
                .distinct()
            )
            
            failed_item_ids = [row[0] for row in failed_items_result.all()]
            
            if not failed_item_ids:
                return PaginatedResponse.create([], 0, page, page_size)
            
            # 获取失败记录的总数
            total_items = len(failed_item_ids)
            
            # 对失败的dataset_item_id进行分页
            offset = (page - 1) * page_size
            paginated_item_ids = failed_item_ids[offset:offset + page_size]
            
        else:
            # 原有逻辑：获取该结果的所有不重复的dataset_item_id（总行数）
            distinct_items_result = await self.db.execute(
                select(func.count(func.distinct(EvalCell.dataset_item_id))).where(EvalCell.result_id == result_id)
            )
            total_items = distinct_items_result.scalar()
            
            # 获取分页的dataset_item_id列表
            offset = (page - 1) * page_size
            paginated_items_result = await self.db.execute(
                select(func.distinct(EvalCell.dataset_item_id))
                .where(EvalCell.result_id == result_id)
                .order_by(EvalCell.dataset_item_id)
                .offset(offset)
                .limit(page_size)
            )
            paginated_item_ids = [row[0] for row in paginated_items_result.all()]
        
        # 获取这些dataset_item_id对应的所有单元格数据
        cells_result = await self.db.execute(
            select(EvalCell, EvalColumn.name.label("column_name"), EvalColumn.column_type.label("column_type"))
            .join(EvalColumn, EvalCell.eval_column_id == EvalColumn.id)
            .where(
                EvalCell.result_id == result_id,
                EvalCell.dataset_item_id.in_(paginated_item_ids)
            )
            .order_by(EvalCell.dataset_item_id, EvalColumn.position)
        )
        cells = cells_result.all()
        
        # 转换数据格式
        data = [dict(cell.to_dict(), **{"column_name": column_name, "column_type": column_type}) for cell, column_name, column_type in cells]
        
        return PaginatedResponse.create(data, total_items, page, page_size)
    
    async def get_cell_by_item_column(
        self, result_id: int, dataset_item_id: int, column_id: int
    ) -> EvalCell:
        """根据数据集项和列获取单元格"""
        result = await self.db.execute(
            select(EvalCell).where(
                EvalCell.result_id == result_id,
                EvalCell.dataset_item_id == dataset_item_id,
                EvalCell.column_id == column_id,
            )
        )
        cell = result.scalar_one_or_none()
        
        if not cell:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="评估单元格未找到",
            )
        
        return cell
    
    async def update_cell(self, cell_id: int, data: EvalCellUpdate) -> EvalCell:
        """更新评估单元格"""
        # 获取现有评估单元格
        cell = await self.get_cell(cell_id)
        
        try:
            # 更新评估单元格
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(cell, key):
                    setattr(cell, key, value)
            
            # 保存更改
            self.db.add(cell)
            await self.db.commit()
            await self.db.refresh(cell)
            
            return cell
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新评估单元格失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新评估单元格失败: {str(e)}",
            )
        
    async def create_dataset_variable_column(self, pipeline_id: int, dataset_id: int, result_id: int, selected_item_ids: Optional[List[int]] = None):
        """创建数据集变量列"""
        dataset = await self.dataset_crud.get(self.db, dataset_id)
        eval_column = EvalColumn(
            pipeline_id=pipeline_id, name='数据集变量', 
            column_type='dataset_variable', 
            position=0, 
            config={"variables": dataset.variables}
        )
        self.db.add(eval_column)
        await self.db.flush()
        
        # 创建数据项cells
        await self._create_dataset_variable_cells(pipeline_id, dataset_id, result_id, eval_column, selected_item_ids)

    async def _create_dataset_variable_cells(self, pipeline_id: int, dataset_id: int, result_id: int, eval_column: EvalColumn, selected_item_ids: Optional[List[int]] = None):
        """为dataset_variable列创建数据项cells"""
        # 如果指定了选中的数据项ID，使用它们；否则使用前5条启用的数据项
        if selected_item_ids:
            query = select(DatasetItem).where(
                DatasetItem.dataset_id == dataset_id, 
                DatasetItem.is_enabled == True,
                DatasetItem.id.in_(selected_item_ids)
            ).order_by(DatasetItem.id.desc())
        else:
            query = select(DatasetItem).where(
                DatasetItem.dataset_id == dataset_id, 
                DatasetItem.is_enabled == True
            ).order_by(DatasetItem.id.desc()).limit(5)
            
        dataset_items = await self.db.execute(query)
        dataset_items = dataset_items.scalars().all()
        
        if dataset_items:
            # 准备批量插入数据
            cell_mappings = []
            for dataset_item in dataset_items:
                cell_dict = {
                    'pipeline_id': pipeline_id,
                    'dataset_item_id': dataset_item.id,
                    'eval_column_id': eval_column.id,
                    'result_id': result_id,
                    'status': 'completed',
                    'value': dataset_item.variables_values,
                    'display_value': None,
                    'error_message': None,
                    'created_at': datetime.now(),
                    'updated_at': datetime.now()
                }
                cell_mappings.append(cell_dict)
            
            # 使用bulk_insert_mappings进行高性能批量插入
            await self.db.run_sync(
                lambda session: session.bulk_insert_mappings(EvalCell, cell_mappings)
            )
            await self.db.flush()
        
    async def create_eval_cells_by_column(self, pipeline_id: int, dataset_id: int, result_id: int, column: EvalColumnUpdate):
        """
        根据列创建评估单元格
        """
        # 获取当前result的数据集列
        columns = await self.db.execute(select(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id, EvalColumn.column_type == 'dataset_variable').limit(1))
        dataset_column = columns.scalars().one()
        
        previous_cells = await self.get_eval_cells_by_result_id_dao(result_id, [dataset_column.id])
        previous_dataset_item_ids = [cell.dataset_item_id for cell in previous_cells]
        
        if (len(previous_dataset_item_ids) == 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="数据集项为空, 请先创建数据集项",
            )
            
        logging.info(f"previous_dataset_item_ids: {previous_dataset_item_ids}")

        query = select(DatasetItem).where(DatasetItem.id.in_(previous_dataset_item_ids))
        dataset_items = await self.db.execute(query)
        dataset_items = dataset_items.scalars().all()

        for dataset_item in dataset_items:
            cell = EvalCell(
                pipeline_id=pipeline_id,
                dataset_item_id=dataset_item.id,
                eval_column_id=column.id,
                result_id=result_id,
                status='new',
                error_message=None
            )
            if (column.column_type == 'human_input'):
                cell.status = 'completed'
                cell.value = {"value": column.config.get('default_value', '')}
                cell.display_value = {"value": column.config.get('default_value', '')}
            self.db.add(cell)

        await self.db.flush()

    async def start_evaluate_column(self, request: SingleColumnEvalRequest, pipeline_id: int, user_id: int) -> Dict[str, Any]:
        """
        同步执行评估列任务
        """
        # 获取列信息，如果是数据库列、人工列已经是完成状态，则直接返回
        column = await self.get_column(request.column_id)
        if column.column_type in ["dataset_variable", "human_input"]:
            return {
                "success": True,
                "message": "静态列无需评估"
            }
        
        # 获取当前列的cell对应的dataset_item_id
        eval_result = await self.get_staging_result(pipeline_id)

        dataset_item_ids = []
        if request.dataset_item_id:
            dataset_item_ids = [request.dataset_item_id]
        else:
            cells = await self.get_eval_cells_by_result_id_dao(eval_result.id, [request.column_id])
            dataset_item_ids = [cell.dataset_item_id for cell in cells]
        
        logging.info(f"开始同步执行评估列任务，dataset_item_ids: {dataset_item_ids}")
        
        try:
            # 同步执行评估任务
            success_count = 0
            total_count = len(dataset_item_ids)
            
            for dataset_item_id in dataset_item_ids:
                try:
                    # 执行单个数据集项的评估
                    await self._execute_single_dataset_item_evaluation(
                        pipeline_id=pipeline_id,
                        column=column,
                        dataset_item_id=dataset_item_id,
                        eval_result=eval_result,
                        user_config={
                            "value": request.value,
                            "previous_values": request.previous_values or {}
                        }
                    )
                    success_count += 1
                    logging.info(f"成功执行数据集项 {dataset_item_id} 的评估")
                except Exception as e:
                    logging.error(f"执行数据集项 {dataset_item_id} 的评估失败: {str(e)}", exc_info=True)
            
            return {
                "success": True,
                "message": f"评估完成，成功: {success_count}/{total_count}",
                "details": {
                    "success_count": success_count,
                    "total_count": total_count,
                    "column_id": request.column_id,
                    "dataset_item_ids": dataset_item_ids
                }
            }
            
        except Exception as e:
            logging.error(f"同步执行评估列任务失败: {str(e)}")
            return {
                "success": False,
                "message": f"评估执行失败: {str(e)}"
            }
    
    async def _execute_single_dataset_item_evaluation(
        self, 
        pipeline_id: int, 
        column: EvalColumn, 
        dataset_item_id: int,
        eval_result: EvalResult,
        user_config: Dict[str, Any]
    ) -> None:
        """执行单个数据集项的评估"""
        # 获取数据集项信息
        dataset_item = await self._get_dataset_item(dataset_item_id)
        if not dataset_item:
            raise ValueError(f"找不到数据集项，dataset_item_id: {dataset_item_id}")
        
        # 获取前置列的执行结果作为执行变量
        execution_variables = await self._get_execution_variables(
            eval_result.id, dataset_item_id, column.position, pipeline_id
        )
        
        # 复用原有的行任务执行器来执行列评估
        from app.services.eval_row_task_executor import EvalRowTaskExecutor
        
        # 创建行任务执行器实例
        row_task_executor = EvalRowTaskExecutor()
        
        # 处理用户自定义配置
        # 对于评估类型列，我们将用户输入的期望值合并到执行变量中
        # 这样原有的_execute_column_for_row逻辑可以正常获取期望值
        if user_config.get("value") is not None:
            if column.column_type in ['exact_match', 'exact_multi_match', 'contains', 'regex']:
                # 对于评估类型，从列配置中获取期望值列名
                column_config = column.config or {}
                expected_column = column_config.get('expected_column')
                if expected_column:
                    # 将用户输入的期望值设置到对应的变量中
                    execution_variables[str(expected_column)] = user_config["value"]
            elif column.column_type == "human_input":
                # 对于人工输入列，修改列配置
                from copy import deepcopy
                temp_column = deepcopy(column)
                temp_column.config = (column.config or {}).copy()
                temp_column.config["default_value"] = user_config["value"]
                column = temp_column
        
        # 调用原有的列执行逻辑
        result = await row_task_executor._execute_column_for_row(
            column=column,
            dataset_item=dataset_item,
            variables=execution_variables,
            result_id=eval_result.id
        )
        
        if not result.get("success", False):
            error_msg = result.get("error", f"列 {column.name} 执行失败")
            raise ValueError(error_msg)
    
    async def _get_dataset_item(self, dataset_item_id: int) -> DatasetItem:
        """获取数据集项"""
        result = await self.db.execute(
            select(DatasetItem).where(DatasetItem.id == dataset_item_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_execution_variables(
        self, 
        result_id: int, 
        dataset_item_id: int, 
        current_position: int,
        pipeline_id: int
    ) -> Dict[str, Any]:
        """获取执行变量（包括数据集变量和前置列的结果）"""
        # 获取数据集项的变量
        dataset_item = await self._get_dataset_item(dataset_item_id)
        execution_variables = dataset_item.variables_values.copy() if dataset_item.variables_values else {}
        
        # 获取前置列的结果
        previous_columns = await self.get_eval_columns_by_position_dao(
            pipeline_id, current_position - 1
        )
        
        if previous_columns:
            previous_column_ids = [col.id for col in previous_columns]
            previous_cells = await self.get_eval_cells_by_result_id_dao(
                result_id, previous_column_ids, dataset_item_id
            )
            
            # 将前置列的结果合并到执行变量中
            column_name_map = {col.id: col.name for col in previous_columns}
            for cell in previous_cells:
                if cell.status == 'completed' and cell.value:
                    column_name = column_name_map.get(cell.eval_column_id)
                    if column_name and isinstance(cell.value, dict) and 'value' in cell.value:
                        execution_variables[column_name] = cell.value['value']
        
        return execution_variables
    

    
    def _on_task_complete(self, task_id: str, task) -> None:
        """
        任务完成回调
        """
        if task_id in self._task_map:
            try:
                # 获取任务结果
                result = task.result()
                self._task_map[task_id]["status"] = "completed"
                self._task_map[task_id]["result"] = result
            except Exception as e:
                # 处理任务异常
                self._task_map[task_id]["status"] = "failed"
                self._task_map[task_id]["error"] = str(e)
            
            # 30分钟后删除任务记录（避免内存泄漏）
            asyncio.create_task(self._remove_task_after_delay(task_id, 1800))
    
    async def _remove_task_after_delay(self, task_id: str, delay: int) -> None:
        """
        延迟后删除任务记录
        """
        await asyncio.sleep(delay)
        if task_id in self._task_map:
            del self._task_map[task_id]
    
    async def get_task_status(self, task_id: int) -> Dict[str, Any]:
        """
        获取任务状态（使用新的持久化任务系统）
        """
        
        try:
            # 获取任务进度
            progress = await self.eval_task_manager.get_task_progress(task_id)
            
            return {
                "task_id": progress.task_id,
                "status": progress.status,
                "progress_percentage": progress.progress_percentage,
                "total_items": progress.total_items,
                "completed_items": progress.completed_items,
                "failed_items": progress.failed_items,
                "estimated_remaining_time": progress.estimated_remaining_time,
                "current_item": progress.current_item,
                "last_updated": progress.last_updated.isoformat()
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}")
    async def get_eval_columns_by_position_dao(self, pipeline_id: int, position: int) -> List[EvalColumn]:
        """获取流水线中位置小于等于position的列"""
        columns = await self.db.execute(select(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id, EvalColumn.position <= position))
        return columns.scalars().all()
    
    async def get_eval_cells_by_result_id_dao(self, result_id: int, column_ids: List[int] = None, dataset_item_id: int = None) -> List[EvalCell]:
        """获取结果中前置列对应的cell"""
        query = select(EvalCell).where(EvalCell.result_id == result_id)
        if column_ids:
            query = query.where(EvalCell.eval_column_id.in_(column_ids))
        if dataset_item_id:
            query = query.where(EvalCell.dataset_item_id == dataset_item_id)
        cells = await self.db.execute(query)
        return cells.scalars().all()
    
    async def _evaluate_column_task(self, request: SingleColumnEvalRequest, pipeline_id: int, user_id: int, 
                                   task_id: str) -> Dict[str, Any]:
        """
        评估列的异步任务处理函数
        """
        # 验证流水线是否存在
        pipeline = await self.get_pipeline(pipeline_id)
        
        if not pipeline:
            raise HTTPException(status_code=404, detail="评估流水线不存在")
        
        # 验证列是否存在
        column = await self.get_column(request.column_id)
            
        if not column:
            raise HTTPException(status_code=404, detail="评估列不存在")
        
        # 取出流水线中前置的列和cell
        eval_result = await self.get_staging_result(pipeline_id)
        previous_columns = await self.get_eval_columns_by_position_dao(pipeline_id, column.position)
        previous_column_ids = {column.id: column.name for column in previous_columns}
        previous_cells = await self.get_eval_cells_by_result_id_dao(eval_result.id, previous_column_ids.keys(), request.dataset_item_id)

        # 按照dataset_item_id和column.name分组, 组成一个字典，作为执行的上下文
        row_variable_dict = {}
        execute_cells = []
        for cell in previous_cells:
            if cell.dataset_item_id not in row_variable_dict:
                row_variable_dict[cell.dataset_item_id] = {}
            if (cell.eval_column_id == request.column_id):
                execute_cells.append(cell)
            else:
                column_name = previous_column_ids[cell.eval_column_id]
                row_variable_dict[cell.dataset_item_id][column_name] = cell.value['value']
        
        # 准备评估
        column_type = column.column_type
        config = column.config or {}
        previous_values = request.previous_values or {}
        passed = False
        details = {}
        output = None
        
        results = []
        for cell in execute_cells:
            variables = row_variable_dict[cell.dataset_item_id]
            cell.status = 'running'
            try:
                # 根据列类型执行评估
                if column_type == "prompt_template":
                    # 提示词模板评估
                    
                    # 获取模板ID
                    template_id = config.get("template_id")
                    if template_id:
                        # 执行提示词模板
                        template_result = await self.evaluation_engine.evaluate_prompt_version(
                            prompt_id=int(template_id),
                            user_id=user_id,
                            input_variables=variables,
                            model_override=config.get("model_override")
                        )
                        
                        # 设置结果
                        passed = template_result.get("success", False)
                        if passed:
                            cell.value = {"value": template_result.get("output", "")}
                            cell.display_value = {"value": template_result.get("output", "")}
                        else:
                            cell.error_message = template_result.get("error", "")
                            cell.display_value = {"value": template_result.get("error", "")}
                elif column_type == "human_input":
                    # 人工输入，直接使用提供的值
                    output = request.value or config.get("value", "")
                    cell.value = {"value": output}
                    cell.display_value = {"value": output}
                
                elif column_type in ["exact_match", "contains", "regex", "exact", "regex_match"]:
                    # 基本评估类型
                    variable_mappings = config.get('variable_mappings', {})
                    expected_output = variables.get(variable_mappings.get('target', ''), "")
                    input_value = variables.get(variable_mappings.get('source', ''), "")
                    
                    # 检查是否需要从前面的列获取输入
                    reference_column = config.get("reference_column")
                    if reference_column and str(reference_column) in [str(k) for k in previous_values.keys()]:
                        reference_data = previous_values[int(reference_column)]
                        if isinstance(reference_data, dict) and "output" in reference_data:
                            input_value = reference_data["output"]
                    
                    # 将exact_match转换为exact等评估策略名称
                    eval_strategy = column_type.replace("_match", "") if "_match" in column_type else column_type
                    
                    passed, eval_details = await self.evaluation_engine.evaluate_output(
                        output=str(input_value),
                        expected_output=expected_output,
                        strategy=eval_strategy,
                        config=config
                    )
                    
                    output = "通过" if passed else "未通过"
                    cell.value = {"value": passed}
                    cell.display_value = {"value": output}
                
                elif column_type in ["json_extraction", "parse_value", "static_value", 
                                    "type_validation", "coalesce", "count"]:
                    # 辅助函数
                    input_value = request.value or ""
                    
                    # 如果有引用列，使用引用列的输出
                    reference_column = config.get("reference_column")
                    if reference_column and str(reference_column) in [str(k) for k in previous_values.keys()]:
                        reference_data = previous_values[int(reference_column)]
                        if isinstance(reference_data, dict) and "output" in reference_data:
                            input_value = reference_data["output"]
                    
                    passed, eval_details = await self.evaluation_engine.evaluate_output(
                        output=str(input_value),
                        expected_output="",
                        strategy=column_type,
                        config=config
                    )
                    
                    # 对于这些函数，如果成功，使用返回的值
                    if passed and "extracted_value" in eval_details:
                        output = eval_details["extracted_value"]
                    elif passed and "parsed_value" in eval_details:
                        output = eval_details["parsed_value"]
                    elif passed and "static_value" in eval_details:
                        output = eval_details["static_value"]
                    elif passed and "coalesced_value" in eval_details:
                        output = eval_details["coalesced_value"]
                    elif passed and "count" in eval_details:
                        output = eval_details["count"]
                    else:
                        output = input_value
                    
                    cell.value = {"value": output}
                    cell.display_value = {"value": output}
                
                else:
                    # 未知的评估类型
                    details = {"error": f"不支持的评估类型: {column_type}"}
                    cell.error_message = "不支持的评估类型"
                    cell.display_value = {'value': output, 'details': details}
                    cell.status = 'failed'
                    
                if cell.status != 'failed':
                    cell.status = 'completed'
            except Exception as e:
                # 评估过程中出现异常
                logging.error(f"评估过程中出现异常: {e}", exc_info=True)
                cell.error_message = str(e)
                cell.display_value = {'value': output, 'details': details}
                cell.status = 'failed'
            
            logging.info(f"评估结果: {cell.value}")
            logging.info(f"评估结果: {cell.display_value}")
            logging.info(f"评估结果: {cell.status}")
            logging.info(f"评估结果: {cell.error_message}")
            
            # 收集结果
            results.append({
                "cell_id": cell.id,
                "status": cell.status,
                "value": cell.value,
                "display_value": cell.display_value
            })
            
        # 更新所有单元格
        await self.update_eval_cell_batch(execute_cells)
        
        return {
            "success": True,
            "results": results,
            "completed_at": datetime.now().isoformat()
        }
    
    async def update_eval_cell_batch(self, cells: List[EvalCell]):
        """批量更新评估单元"""
        if len(cells) > 0:
            for cell in cells:
                self.db.add(cell)
            await self.db.commit()
    
    # 行执行模式相关方法
    
    async def create_result_with_row_execution(
        self, 
        result_data: EvalResultCreate, 
        selected_item_ids: Optional[List[int]] = None
    ) -> EvalResult:
        """使用行执行模式创建评估结果"""
        try:
            # 获取流水线列配置中的提示词版本信息
            prompt_versions = await self._get_prompt_versions_for_pipeline(result_data.pipeline_id)
            
            # 创建评估结果记录
            eval_result = EvalResult(
                pipeline_id=result_data.pipeline_id,
                run_type=result_data.run_type,
                prompt_versions=prompt_versions,
            )

            # 添加到数据库
            self.db.add(eval_result)
            await self.db.commit()
            
            # 创建完整的评估结果（包括eval_cells）
            # await self.create_full_evaluation_result(pipeline, eval_result)
            
            # 为行执行模式创建行任务
            from app.services.eval_row_task_manager import EvalRowTaskManager
            
            row_task_manager = EvalRowTaskManager()
            
            # 创建行任务
            row_tasks = await row_task_manager.create_row_tasks_for_result(
                eval_result.id, 
                selected_item_ids
            )
            
            if row_tasks:
                logger.info(f"成功创建行执行模式评估结果，ID: {eval_result.id}, 行任务数: {len(row_tasks)}")
                
                # 启动调度器执行（异步，不等待完成）
                from app.services.eval_task_scheduler import get_scheduler
                
                scheduler = await get_scheduler()
                await scheduler.force_schedule_row_task_batch(
                    eval_result.id,
                    selected_item_ids
                )
            else:
                logger.warning(f"未能创建行任务，eval_result_id: {eval_result.id}")
            
            return eval_result
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"创建行执行模式评估结果失败: {str(e)}", exc_info=True)
            raise
    
    async def execute_result_with_row_mode(self, result_id: int, dataset_item_ids: Optional[List[int]] = None) -> Dict[str, Any]:
        """使用行执行模式执行评估结果"""
        from app.schemas.eval_result_row_task import RowTaskBatchExecutionRequest
        
        request = RowTaskBatchExecutionRequest(
            result_id=result_id,
            dataset_item_ids=dataset_item_ids,
            execution_mode="row_based"
        )
        
        return await self.eval_row_task_manager.execute_row_tasks_batch(request)
    
    async def get_row_task_progress(self, result_id: int) -> Dict[str, Any]:
        """获取行任务执行进度"""
        return await self.eval_row_task_manager.get_row_task_progress(result_id)
    
    async def get_row_tasks_for_result(self, result_id: int):
        """获取评估结果的行任务"""
        return await self.eval_row_task_manager.get_row_tasks_for_result(result_id)
    
    async def _get_prompt_versions_for_pipeline(self, pipeline_id: int) -> Dict[str, Any]:
        """获取流水线中使用的提示词版本信息"""
        try:
            # 获取流水线的所有列配置
            columns = await self.db.execute(
                select(EvalColumn).where(EvalColumn.pipeline_id == pipeline_id)
            )
            columns = columns.scalars().all()
            
            prompt_versions = {}
            
            # 查找提示词模板类型的列
            for column in columns:
                if column.column_type == 'prompt_template' and column.config and column.config.get('prompt_id'):
                    prompt_id = column.config['prompt_id']
                    
                    try:
                        # 获取提示词基本信息
                        from app.services.prompt import PromptService
                        prompt_service = PromptService(self.db)
                        prompt = await prompt_service.get_prompt(prompt_id)
                        
                        # 获取活跃版本信息
                        active_version = await prompt_service.get_latest_version(prompt_id)
                        
                        if active_version:
                            prompt_versions[str(prompt_id)] = {
                                "prompt_id": prompt_id,
                                "prompt_name": prompt.name,
                                "version_id": active_version.id,
                                "version_number": active_version.version_number,
                                "column_id": column.id,
                                "column_name": column.name
                            }
                    except Exception as e:
                        logger.warning(f"获取提示词 {prompt_id} 版本信息失败: {str(e)}")
                        # 如果获取失败，记录基本信息
                        prompt_versions[str(prompt_id)] = {
                            "prompt_id": prompt_id,
                            "prompt_name": f"提示词{prompt_id}",
                            "version_id": None,
                            "version_number": 1,
                            "column_id": column.id,
                            "column_name": column.name,
                            "error": str(e)
                        }
            
            return prompt_versions
            
        except Exception as e:
            logger.error(f"获取流水线 {pipeline_id} 提示词版本信息失败: {str(e)}", exc_info=True)
            return {}