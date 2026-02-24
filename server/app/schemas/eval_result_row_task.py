"""评估结果行任务相关的Pydantic模式"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import Field

from app.schemas.base import BaseSchema
from app.models.eval_result_row_task import RowTaskStatus, RowTaskResult


# 基础模式
class EvalResultRowTaskBase(BaseSchema):
    """评估结果行任务基础模式"""
    result_id: int
    dataset_item_id: int
    status: RowTaskStatus = RowTaskStatus.PENDING
    row_result: Optional[RowTaskResult] = None
    current_column_position: Optional[int] = None
    execution_variables: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


# 创建模式
class EvalResultRowTaskCreate(EvalResultRowTaskBase):
    """创建评估结果行任务模式"""
    pass


# 更新模式
class EvalResultRowTaskUpdate(BaseSchema):
    """更新评估结果行任务模式"""
    status: Optional[RowTaskStatus] = None
    row_result: Optional[RowTaskResult] = None
    current_column_position: Optional[int] = None
    execution_variables: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# 响应模式
class EvalResultRowTaskResponse(EvalResultRowTaskBase):
    """评估结果行任务响应模式"""
    id: int
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_finished: bool
    is_successful: bool

    class Config:
        from_attributes = True


# 批量执行请求模式
class RowTaskBatchExecutionRequest(BaseSchema):
    """行任务批量执行请求模式"""
    result_id: int
    dataset_item_ids: Optional[list[int]] = None  # 如果为空则执行全部
    execution_mode: str = "row_based"  # 执行模式标识
    config: Optional[Dict[str, Any]] = None 