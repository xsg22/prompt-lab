from typing import List, Optional

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    """项目模型"""
    __tablename__ = "projects"
    
    name = Column(String(255), nullable=False)
    webhook_url = Column(String(255), nullable=True)
    
    # 关系
    # members = relationship("ProjectMember", back_populates="project")
    # prompts = relationship("Prompt", back_populates="project")
    # datasets = relationship("Dataset", back_populates="project")
    # eval_pipelines = relationship("EvalPipeline", back_populates="project")
    # invitations = relationship("ProjectInvitation", back_populates="project")
    # api_keys = relationship("ApiKey", back_populates="project")
    # billing_info = relationship("BillingInfo", back_populates="project", uselist=False)


class ProjectMember(Base, TimestampMixin):
    """项目成员模型"""
    __tablename__ = "project_members"
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    role = Column(String(16), nullable=False, default="member")
    
    # 关系
    # user = relationship("Users", back_populates="project_memberships")
    # project = relationship("Project", back_populates="members")


class ProjectInvitation(Base, TimestampMixin):
    """项目邀请模型"""
    __tablename__ = "project_invitations"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(64), nullable=False, unique=True)
    role = Column(String(16), nullable=False, default="member")
    is_expired = Column(Boolean, nullable=False, default=False)
    
    # 关系
    # user = relationship("Users", back_populates="project_invitations")
    # project = relationship("Project", back_populates="invitations")