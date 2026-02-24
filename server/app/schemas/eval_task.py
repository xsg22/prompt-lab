"""评估任务相关的Pydantic模式"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import Field

from app.schemas.base import BaseSchema
from app.models.eval_task import TaskStatus, TaskItemStatus, LogLevel


# 基础模式
class EvalTaskBase(BaseSchema):
    """评估任务基础模式"""
    pipeline_id: int
    result_id: int
    column_id: int
    task_type: str = "column_evaluation"
    priority: int = 0
    max_retries: int = 3
    config: Optional[Dict[str, Any]] = None


class EvalTaskItemBase(BaseSchema):
    """评估任务项基础模式"""
    task_id: int
    cell_id: int
    dataset_item_id: int
    input_data: Optional[Dict[str, Any]] = None


class EvalTaskLogBase(BaseSchema):
    """评估任务日志基础模式"""
    task_id: int
    task_item_id: Optional[int] = None
    level: LogLevel = LogLevel.INFO
    message: str
    details: Optional[Dict[str, Any]] = None


# 创建模式
class EvalTaskCreate(EvalTaskBase):
    """创建评估任务模式"""
    pass


class EvalTaskItemCreate(EvalTaskItemBase):
    """创建评估任务项模式"""
    pass


class EvalTaskLogCreate(EvalTaskLogBase):
    """创建评估任务日志模式"""
    pass


# 更新模式
class EvalTaskUpdate(BaseSchema):
    """更新评估任务模式"""
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    max_retries: Optional[int] = None
    current_retry: Optional[int] = None
    total_items: Optional[int] = None
    completed_items: Optional[int] = None
    failed_items: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None


class EvalTaskItemUpdate(BaseSchema):
    """更新评估任务项模式"""
    status: Optional[TaskItemStatus] = None
    retry_count: Optional[int] = None
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# 响应模式
class EvalTaskResponse(EvalTaskBase):
    """评估任务响应模式"""
    id: int
    user_id: int
    status: TaskStatus
    current_retry: int
    total_items: int
    completed_items: int
    failed_items: int
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    progress_percentage: float
    is_finished: bool
    can_retry: bool

    class Config:
        from_attributes = True


class EvalTaskItemResponse(EvalTaskItemBase):
    """评估任务项响应模式"""
    id: int
    status: TaskItemStatus
    retry_count: int
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    is_finished: bool

    class Config:
        from_attributes = True


class EvalTaskLogResponse(EvalTaskLogBase):
    """评估任务日志响应模式"""
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# 统计模式
class EvalTaskStatsResponse(BaseSchema):
    """评估任务统计响应模式"""
    date: datetime
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    cancelled_tasks: int
    avg_execution_time_ms: Optional[int] = None
    total_retries: int
    success_rate: float
    
    class Config:
        from_attributes = True


# 任务详情模式
class EvalTaskDetailResponse(EvalTaskResponse):
    """评估任务详情响应模式"""
    task_items: List[EvalTaskItemResponse] = []
    recent_logs: List[EvalTaskLogResponse] = []


# 任务列表查询模式
class EvalTaskListQuery(BaseSchema):
    """评估任务列表查询模式"""
    pipeline_id: Optional[int] = None
    column_id: Optional[int] = None
    user_id: Optional[int] = None
    status: Optional[TaskStatus] = None
    task_type: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    order_by: str = "created_at"
    order_desc: bool = True


# 任务操作模式
class EvalTaskActionRequest(BaseSchema):
    """评估任务操作请求模式"""
    action: str = Field(..., description="操作类型：start, pause, resume, cancel, retry")
    reason: Optional[str] = None


# 批量操作模式
class EvalTaskBatchActionRequest(BaseSchema):
    """评估任务批量操作请求模式"""
    task_ids: List[int]
    action: str = Field(..., description="操作类型：start, pause, resume, cancel, retry")
    reason: Optional[str] = None


# 监控模式
class EvalTaskHealthResponse(BaseSchema):
    """评估任务健康状态响应模式"""
    total_tasks: int
    running_tasks: int
    pending_tasks: int
    failed_tasks: int
    system_load: float
    memory_usage: float
    database_status: str
    last_check: datetime


class EvalTaskMetricsResponse(BaseSchema):
    """评估任务指标响应模式"""
    total_tasks_today: int
    completed_tasks_today: int
    failed_tasks_today: int
    avg_execution_time_today: Optional[float] = None
    success_rate_today: float
    total_retries_today: int
    active_tasks: int
    queue_length: int


# 任务执行请求模式
class EvalTaskExecutionRequest(BaseSchema):
    """评估任务执行请求模式"""
    pipeline_id: int
    column_id: int
    dataset_item_ids: Optional[List[int]] = None  # 如果为空，则处理所有数据项
    priority: int = 0
    max_retries: int = 3
    config: Optional[Dict[str, Any]] = None


# 任务进度响应模式
class EvalTaskProgressResponse(BaseSchema):
    """评估任务进度响应模式"""
    task_id: int
    status: TaskStatus
    progress_percentage: float
    total_items: int
    completed_items: int
    failed_items: int
    estimated_remaining_time: Optional[int] = None  # 秒
    current_item: Optional[str] = None
    last_updated: datetime 