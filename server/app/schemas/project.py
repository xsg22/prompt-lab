from typing import Optional
from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema

class ProjectName(BaseSchema):
    """项目名称模型"""
    id: int
    name: str = Field(..., max_length=10, description="项目名称，最多10个字符")


# 项目基础模型
class ProjectBase(BaseSchema):
    """项目基础模型"""
    
    name: str = Field(..., max_length=10, description="项目名称，最多10个字符")
    webhook_url: Optional[str] = None


# 创建项目模型
class ProjectCreate(ProjectBase):
    """创建项目模型"""
    pass


# 更新项目模型
class ProjectUpdate(BaseSchema):
    """更新项目模型"""
    
    name: Optional[str] = Field(None, max_length=10, description="项目名称，最多10个字符")
    webhook_url: Optional[str] = None


# 项目完整模型
class Project(ProjectBase, TimestampSchema):
    """项目完整模型"""
    
    id: int


# 项目成员基础模型
class ProjectMemberBase(BaseSchema):
    """项目成员基础模型"""
    
    user_id: int
    project_id: int
    role: str = "member"


# 创建项目成员模型
class ProjectMemberCreate(ProjectMemberBase):
    """创建项目成员模型"""
    pass


# 更新项目成员模型
class ProjectMemberUpdate(BaseSchema):
    """更新项目成员模型"""
    
    role: Optional[str] = None


# 项目成员完整模型
class ProjectMember(ProjectMemberBase, TimestampSchema):
    """项目成员完整模型"""
    
    id: int


# 项目邀请基础模型
class ProjectInvitationBase(BaseSchema):
    """项目邀请基础模型"""
    
    project_id: int
    user_id: int
    role: str = "member"


# 创建项目邀请模型
class ProjectInvitationCreate(ProjectInvitationBase):
    """创建项目邀请模型"""
    pass


# 项目邀请完整模型
class ProjectInvitation(ProjectInvitationBase, TimestampSchema):
    """项目邀请完整模型"""
    
    id: int
    token: str
    is_expired: bool 