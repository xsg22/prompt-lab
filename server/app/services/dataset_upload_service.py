import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.models.dataset import Dataset, DatasetItem
from app.models.dataset_upload import DatasetUploadTask, DatasetUploadError, UploadStatus
from app.schemas.dataset_upload import (
    DatasetUploadPreviewRequest, DatasetUploadPreviewResponse,
    DatasetUploadStartRequest, DatasetUploadStartResponse,
    DatasetUploadStatusResponse, DatasetUploadResultResponse,
    DatasetUploadRetryRequest, DatasetRowError
)
from app.services.file_processor import FileProcessorService
from app.db.session import AsyncSessionLocal, get_db
from app.core.logging import get_logger
from app.services.background_task_service import create_task_with_session

logger = get_logger(__name__)

class DatasetUploadService:
    """数据集上传服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.file_processor = FileProcessorService()
        self.batch_size = 100  # 批量处理大小
    
    async def preview_upload(
        self, 
        dataset_id: int, 
        request: DatasetUploadPreviewRequest
    ) -> DatasetUploadPreviewResponse:
        """预览上传文件"""
        # 获取数据集信息
        dataset = await self._get_dataset(dataset_id)
        if not dataset:
            raise ValueError("数据集不存在")
        
        # 使用文件处理服务预览
        return self.file_processor.preview_dataset_upload(
            file_content=request.file_content,
            file_name=request.file_name,
            variables=dataset.variables or []
        )
    
    async def start_upload(
        self, 
        dataset_id: int, 
        user_id: int, 
        request: DatasetUploadStartRequest
    ) -> DatasetUploadStartResponse:
        """开始上传任务"""
        # 获取数据集信息
        dataset = await self._get_dataset(dataset_id)
        if not dataset:
            raise ValueError("数据集不存在")
        
        # 处理上传数据
        try:
            processed_data, errors = self.file_processor.process_upload_data(
                file_content=request.file_content,
                variables=dataset.variables or [],
                skip_invalid_rows=request.skip_invalid_rows
            )
        except Exception as e:
            raise ValueError(f"文件处理失败: {str(e)}")
        
        # 获取erros里的行数量，DatasetRowError
        unique_row_numbers = {error.row_number for error in errors}
        
        # 创建上传任务
        upload_task = DatasetUploadTask(
            dataset_id=dataset_id,
            user_id=user_id,
            status=UploadStatus.PENDING,
            total_rows=len(processed_data) + len(unique_row_numbers),
            file_name=request.file_name,
            error_details={"initial_errors_count": len(unique_row_numbers)}
        )
        
        self.db.add(upload_task)
        await self.db.flush()
        
        # 记录初始错误
        for error in errors:
            upload_error = DatasetUploadError(
                upload_task_id=upload_task.id,
                row_number=error.row_number,
                error_type=error.error_type,
                error_message=error.error_message,
                row_data=error.row_data
            )
            self.db.add(upload_error)
        
        # 提交事务
        await self.db.commit()
        
        # 使用背景任务服务启动上传任务
        create_task_with_session(
            self._execute_upload_task,
            upload_task.id,
            processed_data,
            task_name=f"dataset_upload_{upload_task.id}"
        )
        
        return DatasetUploadStartResponse(
            task_id=upload_task.id,
            message="上传任务已创建，正在后台处理"
        )
    
    async def get_upload_status(self, task_id: int) -> DatasetUploadStatusResponse:
        """获取上传状态"""
        task = await self._get_upload_task(task_id)
        if not task:
            raise ValueError("上传任务不存在")
        
        # 计算进度百分比
        progress_percentage = 0.0
        if task.total_rows > 0:
            progress_percentage = (task.processed_rows / task.total_rows) * 100
        
        # 估算剩余时间(简单估算)
        estimated_time_remaining = None
        if task.status == UploadStatus.PROCESSING and task.processed_rows > 0:
            elapsed_time = (datetime.utcnow() - task.created_at).total_seconds()
            avg_time_per_row = elapsed_time / task.processed_rows
            remaining_rows = task.total_rows - task.processed_rows
            estimated_time_remaining = int(avg_time_per_row * remaining_rows)
        
        return DatasetUploadStatusResponse(
            task=task,
            progress_percentage=progress_percentage,
            estimated_time_remaining=estimated_time_remaining
        )
    
    async def get_upload_result(self, task_id: int) -> DatasetUploadResultResponse:
        """获取上传结果"""
        task = await self._get_upload_task_with_errors(task_id)
        if not task:
            raise ValueError("上传任务不存在")
        
        success_rate = 0.0
        if task.total_rows > 0:
            success_rate = (task.success_rows / task.total_rows) * 100
        
        return DatasetUploadResultResponse(
            task=task,
            errors=task.errors,
            success_rate=success_rate,
            has_errors=len(task.errors) > 0
        )
    
    async def retry_upload(
        self, 
        request: DatasetUploadRetryRequest, 
        user_id: int
    ) -> DatasetUploadStartResponse:
        """重试上传"""
        original_task = await self._get_upload_task_with_errors(request.task_id)
        if not original_task:
            raise ValueError("原上传任务不存在")
        
        # 获取数据集信息
        dataset = await self._get_dataset(original_task.dataset_id)
        if not dataset:
            raise ValueError("数据集不存在")
        
        if request.retry_failed_only:
            # 只重试失败的行
            retry_data = []
            for error in original_task.errors:
                if error.row_data:
                    # 重新标准化数据
                    normalized_data = self.file_processor.normalize_row_data(
                        error.row_data, dataset.variables or []
                    )
                    retry_data.append(normalized_data)
        else:
            # 重试整个文件(需要重新处理文件内容)
            raise NotImplementedError("完整重试功能待实现")
        
        # 创建新的上传任务
        new_task = DatasetUploadTask(
            dataset_id=original_task.dataset_id,
            user_id=user_id,
            status=UploadStatus.PENDING,
            total_rows=len(retry_data),
            file_name=f"重试_{original_task.file_name}",
            error_details={"retry_from_task": request.task_id}
        )
        
        self.db.add(new_task)
        await self.db.flush()
        await self.db.commit()
        
        # 使用背景任务服务启动重试任务
        create_task_with_session(
            self._execute_upload_task,
            new_task.id,
            retry_data,
            task_name=f"dataset_upload_retry_{new_task.id}"
        )
        
        return DatasetUploadStartResponse(
            task_id=new_task.id,
            message="重试任务已创建，正在后台处理"
        )
    
    async def _execute_upload_task(self, db: AsyncSession, task_id: int, data: List[Dict[str, Any]]):
        """执行上传任务（异步）- 使用独立的数据库会话"""
        upload_service = DatasetUploadService(db)
        
        try:
            # 更新任务状态为处理中
            await upload_service._update_task_status(task_id, UploadStatus.PROCESSING)
            
            # 分批处理数据
            success_count = 0
            failed_count = 0
            
            for i in range(0, len(data), self.batch_size):
                batch = data[i:i + self.batch_size]
                batch_success, batch_failed = await upload_service._process_batch(task_id, batch, i)
                
                success_count += batch_success
                failed_count += batch_failed
                
                # 更新进度
                await upload_service._update_task_progress(
                    task_id, 
                    processed_rows=i + len(batch),
                    success_rows=success_count,
                    failed_rows=failed_count
                )
            
            # 完成任务
            await upload_service._complete_task(task_id, success_count, failed_count)
            logger.info(f"上传任务完成: task_id={task_id}, 成功={success_count}, 失败={failed_count}")
            
        except Exception as e:
            # 任务失败
            await upload_service._fail_task(task_id, str(e))
            logger.error(f"上传任务失败: task_id={task_id}, error={str(e)}")
            raise
    
    async def _process_batch(
        self, 
        task_id: int, 
        batch: List[Dict[str, Any]], 
        start_index: int
    ) -> tuple[int, int]:
        """处理数据批次"""
        success_count = 0
        failed_count = 0
        
        # 获取任务信息
        task = await self._get_upload_task(task_id)
        if not task:
            return success_count, failed_count
        
        for i, item_data in enumerate(batch):
            try:
                # 创建数据集条目
                dataset_item = DatasetItem(
                    dataset_id=task.dataset_id,
                    name=item_data.get('name'),
                    variables_values=item_data.get('variables_values', {}),
                    is_enabled=item_data.get('is_enabled', True)
                )
                
                self.db.add(dataset_item)
                success_count += 1
                
            except Exception as e:
                # 记录错误
                upload_error = DatasetUploadError(
                    upload_task_id=task_id,
                    row_number=start_index + i + 2,  # CSV行号
                    error_type="database_error",
                    error_message=str(e),
                    row_data=item_data
                )
                self.db.add(upload_error)
                failed_count += 1
        
        # 提交批次
        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            # 所有批次都失败
            failed_count = len(batch)
            success_count = 0
            
            # 记录批次错误
            for i, item_data in enumerate(batch):
                upload_error = DatasetUploadError(
                    upload_task_id=task_id,
                    row_number=start_index + i + 2,
                    error_type="batch_error",
                    error_message=f"批次提交失败: {str(e)}",
                    row_data=item_data
                )
                self.db.add(upload_error)
            
            await self.db.commit()
        
        return success_count, failed_count
    
    async def _get_dataset(self, dataset_id: int) -> Optional[Dataset]:
        """获取数据集"""
        result = await self.db.execute(
            select(Dataset).where(Dataset.id == dataset_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_upload_task(self, task_id: int) -> Optional[DatasetUploadTask]:
        """获取上传任务"""
        result = await self.db.execute(
            select(DatasetUploadTask).where(DatasetUploadTask.id == task_id)
        )
        return result.scalar_one_or_none()
    
    async def _get_upload_task_with_errors(self, task_id: int) -> Optional[DatasetUploadTask]:
        """获取带错误记录的上传任务"""
        result = await self.db.execute(
            select(DatasetUploadTask)
            .options(selectinload(DatasetUploadTask.errors))
            .where(DatasetUploadTask.id == task_id)
        )
        return result.scalar_one_or_none()
    
    async def _update_task_status(self, task_id: int, status: UploadStatus):
        """更新任务状态"""
        await self.db.execute(
            update(DatasetUploadTask)
            .where(DatasetUploadTask.id == task_id)
            .values(status=status, updated_at=datetime.utcnow())
        )
        await self.db.commit()
    
    async def _update_task_progress(
        self, 
        task_id: int, 
        processed_rows: int, 
        success_rows: int, 
        failed_rows: int
    ):
        """更新任务进度"""
        await self.db.execute(
            update(DatasetUploadTask)
            .where(DatasetUploadTask.id == task_id)
            .values(
                processed_rows=processed_rows,
                success_rows=success_rows,
                failed_rows=failed_rows
            )
        )
        await self.db.commit()
    
    async def _complete_task(self, task_id: int, success_rows: int, failed_rows: int):
        """完成任务"""
        await self.db.execute(
            update(DatasetUploadTask)
            .where(DatasetUploadTask.id == task_id)
            .values(
                status=UploadStatus.COMPLETED,
                success_rows=success_rows,
                failed_rows=failed_rows
            )
        )
        await self.db.commit()
    
    async def _fail_task(self, task_id: int, error_message: str):
        """任务失败"""
        await self.db.execute(
            update(DatasetUploadTask)
            .where(DatasetUploadTask.id == task_id)
            .values(
                status=UploadStatus.FAILED,
                error_details={"system_error": error_message},
                updated_at=datetime.utcnow()
            )
        )
        await self.db.commit() 