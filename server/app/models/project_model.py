from datetime import datetime
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON, Float
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class ProjectModel(Base, TimestampMixin):
    """自定义模型"""
    __tablename__ = "project_models"
    
    name = Column(String(255), nullable=False, comment="模型显示名称")
    model_id = Column(String(255), nullable=False, comment="模型ID，用于API调用")
    provider_instance_id = Column(Integer, ForeignKey("model_provider_instances.id"), nullable=False, comment="关联的提供商实例ID")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, comment="所属项目ID")
    
    # 模型信息
    description = Column(String(500), nullable=True, comment="模型描述")
    context_window = Column(Integer, nullable=True, comment="上下文窗口大小")
    input_cost_per_token = Column(Float, nullable=True, comment="输入token单价")
    output_cost_per_token = Column(Float, nullable=True, comment="输出token单价")
    
    # 特性支持
    supports_streaming = Column(Boolean, nullable=False, default=True, comment="是否支持流式输出")
    supports_tools = Column(Boolean, nullable=False, default=False, comment="是否支持工具调用")
    supports_vision = Column(Boolean, nullable=False, default=False, comment="是否支持视觉功能")
    
    # 其他配置
    config = Column(JSON, nullable=False, default=dict, comment="模型特定配置")
    is_enabled = Column(Boolean, nullable=False, default=True, comment="是否启用")
    
    # 关系
    # project = relationship("Project", back_populates="project_models")
    # provider_instance = relationship("ModelProviderInstance", back_populates="project_models") 