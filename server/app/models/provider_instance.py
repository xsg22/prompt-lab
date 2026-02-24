from datetime import datetime
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON, Text
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class ModelProviderInstance(Base, TimestampMixin):
    """提供商实例模型 - 存储用户在项目中配置的提供商实例"""
    __tablename__ = "model_provider_instances"
    
    name = Column(String(255), nullable=False, comment="实例名称，用户自定义")
    provider_type = Column(String(50), nullable=False, comment="提供商类型，如openai、anthropic等")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, comment="所属项目ID")
    
    # 配置信息，存储为JSON格式
    config = Column(JSON, nullable=False, default=dict, comment="提供商配置信息，如API密钥、base_url等")
    
    # 状态信息
    is_enabled = Column(Boolean, nullable=False, default=True, comment="是否启用")
    enabled_models = Column(JSON, nullable=False, default=list, comment="启用的模型ID列表")
    last_tested_at = Column(TimestampMixin.updated_at.type, nullable=True, comment="最后测试时间")
    connection_status = Column(String(20), nullable=False, default='unknown', comment="连接状态：connected, failed, unknown")
    error_message = Column(Text, nullable=True, comment="连接错误信息")
    
    # 自定义模型列表，存储为JSON格式
    custom_models = Column(JSON, nullable=False, default=list, comment="自定义模型列表")
    
    # 关系
    # project = relationship("Project", back_populates="model_provider_instances")
