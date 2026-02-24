from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Column, ForeignKey, Integer, String, JSON, Float
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin
from app.schemas.base import BaseSchema


class EvalPipeline(Base, TimestampMixin):
    """评估流水线模型"""
    __tablename__ = "eval_pipelines"
    
    name = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class EvalColumn(Base, TimestampMixin):
    """评估列模型"""
    __tablename__ = "eval_columns"
    
    pipeline_id = Column(Integer, ForeignKey("eval_pipelines.id"), nullable=False)
    name = Column(String(255), nullable=False)
    column_type = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False)
    config = Column(JSON, nullable=True)
    
    # 关系
    # pipeline = relationship("EvalPipeline", back_populates="columns")
    # cells = relationship("EvalCell", back_populates="column")
    # tasks = relationship("EvalTask", back_populates="column")


class EvalResult(Base, TimestampMixin):
    """评估结果模型"""
    __tablename__ = "eval_results"
    
    pipeline_id = Column(Integer, ForeignKey("eval_pipelines.id"), nullable=False)
    run_type = Column(String(64), nullable=False)
    status = Column(String(64), nullable=False, default='new', comment='状态, 如new, running, completed')
    
    # 评估统计字段
    total_count = Column(Integer, nullable=True, default=0, comment='总评估数量')
    passed_count = Column(Integer, nullable=True, default=0, comment='通过评估数量') 
    failed_count = Column(Integer, nullable=True, default=0, comment='失败评估数量')
    unpassed_count = Column(Integer, nullable=True, default=0, comment='未通过评估数量')
    success_rate = Column(Float, nullable=True, default=0.0, comment='成功率')
    
    # 提示词版本信息
    prompt_versions = Column(JSON, nullable=True, comment='评估执行时使用的提示词版本信息')
    
    # 关系
    # pipeline = relationship("EvalPipeline", back_populates="results")
    # cells = relationship("EvalCell", back_populates="result")


class EvalCell(Base, TimestampMixin):
    """评估单元格模型"""
    __tablename__ = "eval_cells"
    
    pipeline_id = Column(Integer, ForeignKey("eval_pipelines.id"), nullable=False)
    dataset_item_id = Column(Integer, ForeignKey("dataset_items.id"), nullable=False)
    eval_column_id = Column(Integer, ForeignKey("eval_columns.id"), nullable=False)
    result_id = Column(Integer, ForeignKey("eval_results.id"), nullable=False)
    display_value = Column(JSON, nullable=True)
    value = Column(JSON, nullable=True)
    error_message = Column(String(255), nullable=True)
    status = Column(String(255), nullable=False, default='pending', comment='状态, 如pending, running, completed, failed')
    
    # 关系
    # pipeline = relationship("EvalPipeline", back_populates="cells")
    # dataset_item = relationship("DatasetItem", back_populates="eval_cells")
    # column = relationship("EvalColumn", back_populates="cells")
    # result = relationship("EvalResult", back_populates="cells")
    # task_items = relationship("EvalTaskItem", back_populates="cell")


class EvalColumnView(BaseSchema):

    id: Optional[int] = None
    pipeline_id: int
    name: str
    column_type: str
    config: Optional[Dict[str, Any]] = {}
    position: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ColumnConfig(BaseSchema):
    id: Optional[int] = None
    name: str
    column_type: str
    position: Optional[int] = None
    config: Optional[Dict[str, Any]] = {}
    
    
class EvalColumnDTO(BaseSchema):
    id: Optional[int] = None
    pipeline_id: Optional[int] = None
    name: Optional[str] = None
    column_type: Optional[str] = None
    position: Optional[int] = None
    config: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    

class SingleColumnEvalRequest(BaseSchema):
    dataset_item_id: Optional[int] = None
    column_id: int
    previous_values: Dict[int, Any] = {}  # 前面列的值
    value: Optional[Dict[str, Any]] = None  # 当前列的值