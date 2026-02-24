from typing import List, Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class Dataset(Base, TimestampMixin):
    """数据集模型"""
    __tablename__ = "datasets"
    
    name = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    variables = Column(JSON, nullable=True)
    # 新增字段：变量字段描述信息
    variable_descriptions = Column(JSON, nullable=True)
    
    # 关系
    # user = relationship("Users", back_populates="datasets")
    # project = relationship("Project", back_populates="datasets")
    # items = relationship("DatasetItem", back_populates="dataset")
    # eval_pipelines = relationship("EvalPipeline", back_populates="dataset")
    # upload_tasks = relationship("DatasetUploadTask", back_populates="dataset")


class DatasetItem(Base, TimestampMixin):
    """数据集项模型"""
    __tablename__ = "dataset_items"
    
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    name = Column(String(255), nullable=True)
    variables_values = Column(JSON, nullable=True)
    expected_output = Column(String(1024), nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    
    # 关系
    # dataset = relationship("Dataset", back_populates="items")
    # eval_cells = relationship("EvalCell", back_populates="dataset_item")
    # task_items = relationship("EvalTaskItem", back_populates="dataset_item") 