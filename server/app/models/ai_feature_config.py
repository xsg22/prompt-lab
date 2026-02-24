from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint

from app.db.base import Base, TimestampMixin


class AIFeatureConfig(Base, TimestampMixin):
    """AI功能模型配置表，存储各功能使用的模型配置"""
    __tablename__ = "project_ai_feature_configs"

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, comment="所属项目ID")
    feature_key = Column(String(64), nullable=False, comment="功能标识，如 translate / prompt_optimizer 等")
    provider = Column(String(64), nullable=False, comment="模型提供商，如 openai")
    model_id = Column(String(128), nullable=False, comment="模型ID，如 gpt-4.1")

    __table_args__ = (
        UniqueConstraint("project_id", "feature_key", name="uq_project_feature"),
    )
