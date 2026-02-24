"""评估任务相关的数据模型"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class TaskItemStatus(str, Enum):
    """任务项状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class LogLevel(str, Enum):
    """日志级别枚举"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


class EvalTask(Base, TimestampMixin):
    """评估任务模型"""
    __tablename__ = "eval_tasks"
    
    pipeline_id = Column(Integer, ForeignKey("eval_pipelines.id"), nullable=False, comment="评估流水线ID")
    result_id = Column(Integer, ForeignKey("eval_results.id"), nullable=False, comment="评估结果ID")
    column_id = Column(Integer, ForeignKey("eval_columns.id"), nullable=False, comment="评估列ID")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, comment="用户ID")
    task_type = Column(String(64), nullable=False, default="column_evaluation", comment="任务类型")
    status = Column(String(32), nullable=False, default=TaskStatus.PENDING, comment="任务状态")
    priority = Column(Integer, nullable=False, default=0, comment="任务优先级")
    max_retries = Column(Integer, nullable=False, default=3, comment="最大重试次数")
    current_retry = Column(Integer, nullable=False, default=0, comment="当前重试次数")
    total_items = Column(Integer, nullable=False, default=0, comment="总任务项数")
    completed_items = Column(Integer, nullable=False, default=0, comment="已完成任务项数")
    failed_items = Column(Integer, nullable=False, default=0, comment="失败任务项数")
    config = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    
    # 关系
        # pipeline = relationship("EvalPipeline", back_populates="tasks")
        # column = relationship("EvalColumn", back_populates="tasks")
        # user = relationship("Users", back_populates="eval_tasks")
        # task_items = relationship("EvalTaskItem", back_populates="task")
        # logs = relationship("EvalTaskLog", back_populates="task")
    
    # 索引
    __table_args__ = (
        Index('idx_status_priority', 'status', 'priority'),
        Index('idx_next_retry', 'next_retry_at'),
        Index('idx_pipeline_column', 'pipeline_id', 'column_id'),
        Index('idx_user_id', 'user_id'),
        Index('idx_created_at', 'created_at'),
    )
    
    @property
    def progress_percentage(self) -> float:
        """计算任务进度百分比"""
        if self.total_items == 0:
            return 0.0
        return (self.completed_items / self.total_items) * 100
    
    @property
    def is_finished(self) -> bool:
        """判断任务是否已结束"""
        return self.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
    
    @property
    def can_retry(self) -> bool:
        """判断任务是否可以重试"""
        return (self.status == TaskStatus.FAILED and 
                self.current_retry < self.max_retries)


class EvalTaskItem(Base, TimestampMixin):
    """评估任务项模型"""
    __tablename__ = "eval_task_items"
    
    task_id = Column(Integer, ForeignKey("eval_tasks.id"), nullable=False)
    cell_id = Column(Integer, ForeignKey("eval_cells.id"), nullable=False)
    dataset_item_id = Column(Integer, ForeignKey("dataset_items.id"), nullable=False)
    status = Column(String(32), nullable=False, default=TaskItemStatus.PENDING)
    retry_count = Column(Integer, nullable=False, default=0)
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # 关系
    # task = relationship("EvalTask", back_populates="task_items")
    # cell = relationship("EvalCell", back_populates="task_items")
    # dataset_item = relationship("DatasetItem", back_populates="task_items")
    # logs = relationship("EvalTaskLog", back_populates="task_item")
    
    # 索引
    __table_args__ = (
        Index('idx_task_status', 'task_id', 'status'),
        Index('idx_cell_id', 'cell_id'),
        Index('idx_dataset_item_id', 'dataset_item_id'),
        Index('idx_status', 'status'),
        Index('uk_task_cell', 'task_id', 'cell_id', unique=True),
    )
    
    @property
    def is_finished(self) -> bool:
        """判断任务项是否已结束"""
        return self.status in [TaskItemStatus.COMPLETED, TaskItemStatus.FAILED, TaskItemStatus.SKIPPED]


class EvalTaskLog(Base):
    """评估任务日志模型"""
    __tablename__ = "eval_task_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("eval_tasks.id"), nullable=False)
    task_item_id = Column(Integer, ForeignKey("eval_task_items.id"), nullable=True)
    level = Column(String(16), nullable=False, default=LogLevel.INFO)
    message = Column(Text, nullable=False)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # 关系
    # task = relationship("EvalTask", back_populates="logs")
    # task_item = relationship("EvalTaskItem", back_populates="logs")
    
    # 索引
    __table_args__ = (
        Index('idx_task_level', 'task_id', 'level'),
        Index('idx_task_item', 'task_item_id'),
        Index('idx_created_at', 'created_at'),
        Index('idx_level', 'level'),
    )

 