from typing import List, Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, JSON, Text, Table, DateTime
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin
from app.schemas.base import PydanticList


# 提示词标签关联表
prompt_tags = Table(
    'prompt_tags',
    Base.metadata,
    Column('prompt_id', Integer, ForeignKey('prompts.id', ondelete='CASCADE'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)
)


class Tag(Base, TimestampMixin):
    """标签模型"""
    __tablename__ = "tags"
    
    name = Column(String(100), nullable=False)
    color = Column(String(20), nullable=True)  # 十六进制颜色代码
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # 关系
    prompts = relationship("Prompt", secondary=prompt_tags, back_populates="tags")


class PromptFavorite(Base, TimestampMixin):
    """用户收藏提示词模型"""
    __tablename__ = "prompt_favorites"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    
    # 关系
    # user = relationship("User", back_populates="favorite_prompts")
    # prompt = relationship("Prompt", back_populates="favorited_by")


class Prompt(Base, TimestampMixin):
    """提示词模型"""
    __tablename__ = "prompts"
    
    name = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # 新增字段
    status = Column(String(20), nullable=False, default='active')  # active, archived, draft
    is_template = Column(Boolean, nullable=False, default=False)  # 是否为模板
    
    # 关系
    tags = relationship("Tag", secondary=prompt_tags, back_populates="prompts")
    favorites = relationship("PromptFavorite", backref="prompt")
    # user = relationship("Users", back_populates="prompts")
    # project = relationship("Project", back_populates="prompts")
    # versions = relationship("PromptVersion", back_populates="prompt")


class PromptVersion(Base, TimestampMixin):
    """提示词版本模型"""
    __tablename__ = "prompt_versions"
    
    prompt_id = Column(Integer, ForeignKey("prompts.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    messages = Column(PydanticList, nullable=False)
    variables = Column(JSON, nullable=False)
    model_name = Column(String(255), nullable=False)
    model_params = Column(JSON, nullable=False)
    
    # 关系
    # prompt = relationship("Prompt", back_populates="versions")
    # requests = relationship("Request", back_populates="prompt_version")
    # test_cases = relationship("TestCase", back_populates="prompt_version")


class TestCase(Base, TimestampMixin):
    """测试用例模型"""
    __tablename__ = "test_cases"
    
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=False)
    name = Column(String(255), nullable=True)
    variables_values = Column(JSON, nullable=False)
    metadatas = Column(JSON, nullable=True)
    
    # 关系
    # prompt_version = relationship("PromptVersion", back_populates="test_cases")


class Request(Base, TimestampMixin):
    """请求记录模型"""
    __tablename__ = "requests"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt_id = Column(Integer, nullable=True)
    prompt_version_id = Column(Integer, nullable=True)
    source = Column(String(255), nullable=False)
    input = Column(JSON, nullable=False)
    variables_values = Column(JSON, nullable=False)
    output = Column(Text, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    execution_time = Column(Integer, nullable=True)
    cost = Column(String(255), nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(String(255), nullable=True)
    
    # 关系
    # prompt_version = relationship("PromptVersion", back_populates="requests") 