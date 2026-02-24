"""评估结果行任务模型"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Index
from app.db.base import Base, TimestampMixin


class RowTaskStatus(str, Enum):
    """行任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running" 
    COMPLETED = "completed"
    FAILED = "failed"


class RowTaskResult(str, Enum):
    """行任务结果枚举"""
    PASSED = "passed"      # 最后一列执行结果为true
    UNPASSED = "unpassed"  # 最后一列执行结果为false
    FAILED = "failed"      # 执行过程中出现异常


class EvalResultRowTask(Base, TimestampMixin):
    """评估结果行任务模型"""
    __tablename__ = "eval_result_row_tasks"
    
    result_id = Column(Integer, ForeignKey("eval_results.id"), nullable=False, comment="评估结果ID")
    dataset_item_id = Column(Integer, ForeignKey("dataset_items.id"), nullable=False, comment="数据集项ID")
    status = Column(String(32), nullable=False, default=RowTaskStatus.PENDING, comment="任务状态，pending表示待执行，running表示执行中，completed表示执行完成，failed表示执行失败")
    row_result = Column(String(32), nullable=True, comment="行执行结果")
    current_column_position = Column(Integer, nullable=True, comment="当前执行到的列位置")
    execution_variables = Column(JSON, nullable=True, comment="执行过程中的变量数据")
    error_message = Column(Text, nullable=True, comment="错误信息")
    execution_time_ms = Column(Integer, nullable=True, comment="总执行时间（毫秒）")
    started_at = Column(DateTime, nullable=True, comment="开始时间")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")
    
    # 关系
    # result = relationship("EvalResult", back_populates="row_tasks")
    # dataset_item = relationship("DatasetItem", back_populates="row_tasks")
    
    # 索引
    __table_args__ = (
        Index('idx_result_status', 'result_id', 'status'),
        Index('idx_dataset_item_id', 'dataset_item_id'),
        Index('idx_status', 'status'),
        Index('uk_result_dataset_item', 'result_id', 'dataset_item_id', unique=True),
    )
    
    @property
    def is_finished(self) -> bool:
        """判断行任务是否已结束"""
        return self.status in [RowTaskStatus.COMPLETED, RowTaskStatus.FAILED]
    
    @property
    def is_successful(self) -> bool:
        """判断行任务是否成功完成"""
        return self.status == RowTaskStatus.COMPLETED and self.row_result in [RowTaskResult.PASSED, RowTaskResult.UNPASSED] 