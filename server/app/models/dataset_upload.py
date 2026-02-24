from enum import Enum
from typing import Optional
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, TIMESTAMP, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class UploadStatus(str, Enum):
    """上传状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DatasetUploadTask(Base, TimestampMixin):
    """数据集上传任务模型"""
    __tablename__ = "dataset_upload_tasks"
    
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(UploadStatus), nullable=False, default=UploadStatus.PENDING)
    total_rows = Column(Integer, nullable=False, default=0)
    processed_rows = Column(Integer, nullable=False, default=0)
    success_rows = Column(Integer, nullable=False, default=0)
    failed_rows = Column(Integer, nullable=False, default=0)
    file_name = Column(String(255), nullable=True)
    error_details = Column(JSON, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    
    # 关系
    # dataset = relationship("Dataset", back_populates="upload_tasks")
    # user = relationship("Users", back_populates="upload_tasks")
    errors = relationship("DatasetUploadError", back_populates="upload_task")

    def __repr__(self):
        return f"<DatasetUploadTask(id={self.id}, dataset_id={self.dataset_id}, status={self.status})>"


class DatasetUploadError(Base):
    """数据集上传错误记录模型"""
    __tablename__ = "dataset_upload_errors"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_task_id = Column(Integer, ForeignKey("dataset_upload_tasks.id", ondelete="CASCADE"), nullable=False)
    row_number = Column(Integer, nullable=False)
    error_type = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=True)
    row_data = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default="CURRENT_TIMESTAMP")
    
    # 关系
    upload_task = relationship("DatasetUploadTask", back_populates="errors")

    def __repr__(self):
        return f"<DatasetUploadError(id={self.id}, task_id={self.upload_task_id}, row={self.row_number})>" 