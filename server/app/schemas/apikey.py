from datetime import datetime
from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


class ApiKeyBase(BaseSchema):
    """API密钥基础模型"""
    name: str = Field(..., description="API密钥名称")


class ApiKeyCreate(ApiKeyBase):
    """创建API密钥请求模型"""
    pass


class ApiKey(ApiKeyBase):
    """API密钥响应模型"""
    id: int = Field(..., description="API密钥ID")
    project_id: int = Field(..., description="所属项目ID")
    prefix: str = Field(..., description="API密钥前缀")
    created_at: datetime = Field(..., description="创建时间")
    last_used_at: Optional[datetime] = Field(None, description="最后使用时间")

    class Config:
        from_attributes = True


# class ApiKeyResponse(ApiKey):
#     """API密钥创建响应模型（包含完整密钥）"""
#     key: str = Field(..., description="完整API密钥（仅在创建时返回一次）") 