from datetime import datetime
from typing import Dict, Optional, Any

from pydantic import Field

from app.schemas.base import BaseSchema


class RequestBase(BaseSchema):
    """请求记录基础模型"""
    prompt_version_id: Optional[int] = Field(None, description="提示词版本ID")
    source: str = Field(..., description="来源，如'playground', 'api'等")
    input: Dict[str, Any] = Field(default_factory=dict, description="输入参数")
    variables_values: Dict[str, Any] = Field(default_factory=dict, description="变量值")


class RequestCreate(RequestBase):
    """创建请求记录请求模型"""
    output: Optional[Dict[str, Any]] = Field(None, description="输出结果")
    prompt_tokens: Optional[int] = Field(None, description="提示词token数")
    completion_tokens: Optional[int] = Field(None, description="补全token数")
    total_tokens: Optional[int] = Field(None, description="总token数")
    execution_time: Optional[int] = Field(None, description="执行时间(ms)")
    cost: Optional[str] = Field(None, description="费用")
    success: bool = Field(True, description="是否成功")
    error_message: Optional[str] = Field(None, description="错误信息")


class RequestResponse(RequestBase):
    """请求记录响应模型"""
    id: int = Field(..., description="请求ID")
    output: Dict[str, Any] = Field(..., description="输出结果")
    prompt_tokens: int = Field(..., description="提示词token数")
    completion_tokens: int = Field(..., description="补全token数")
    total_tokens: int = Field(..., description="总token数")
    execution_time: int = Field(..., description="执行时间(ms)")
    cost: str = Field(..., description="费用")
    success: bool = Field(..., description="是否成功")
    error_message: Optional[str] = Field(None, description="错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    # 额外信息
    prompt_name: Optional[str] = Field(None, description="提示词名称")
    version_number: Optional[int] = Field(None, description="提示词版本号")
    model_name: Optional[str] = Field(None, description="模型名称")

    class Config:
        from_attributes = True 