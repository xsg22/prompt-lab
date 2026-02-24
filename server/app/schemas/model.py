from datetime import datetime
from typing import Dict, Optional, Any, List
from enum import Enum

from pydantic import Field, ConfigDict

from app.schemas.base import BaseSchema


# 连接状态枚举
class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    FAILED = "failed"
    UNKNOWN = "unknown"


# 提供商字段定义
class ProviderField(BaseSchema):
    """提供商配置字段定义"""
    
    key: str = Field(..., description="字段键名")
    name: str = Field(..., description="字段显示名称")
    type: str = Field(..., description="字段类型：string, password, url, number, boolean, select")
    required: bool = Field(..., description="是否必填")
    description: Optional[str] = Field(None, description="字段描述")
    placeholder: Optional[str] = Field(None, description="占位符文本")
    default: Optional[Any] = Field(None, description="默认值")
    options: Optional[List[Dict[str, Any]]] = Field(None, description="选择项（select类型使用）")


# 默认模型定义
class DefaultModel(BaseSchema):
    """默认模型定义"""
    
    model_id: str = Field(..., description="模型ID")
    name: str = Field(..., description="模型名称")
    description: Optional[str] = Field(None, description="模型描述")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    input_cost_per_token: Optional[float] = Field(None, description="输入token单价")
    output_cost_per_token: Optional[float] = Field(None, description="输出token单价")
    supports_streaming: bool = Field(True, description="是否支持流式输出")
    supports_tools: bool = Field(False, description="是否支持工具调用")
    supports_vision: bool = Field(False, description="是否支持视觉功能")
    is_default: bool = Field(False, description="是否为默认模型")


# 提供商定义
class ProviderDefinition(BaseSchema):
    """提供商定义"""
    
    id: str = Field(..., description="提供商类型")
    name: str = Field(..., description="提供商名称")
    description: str = Field(..., description="提供商描述")
    icon: str = Field(..., description="图标名称")
    website: str = Field(..., description="官网地址")
    fields: List[ProviderField] = Field(..., description="配置字段定义")
    default_models: List[DefaultModel] = Field(..., description="默认模型列表")
    support_custom_models: bool = Field(True, description="是否支持自定义模型")


# 自定义模型相关Schema（定义在前，避免前向引用）
class CustomModelBase(BaseSchema):
    """自定义模型基础模型"""
    
    name: str = Field(..., description="模型显示名称")
    model_id: str = Field(..., description="模型ID")
    description: Optional[str] = Field(None, description="模型描述")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    input_cost_per_token: Optional[float] = Field(None, description="输入token单价")
    output_cost_per_token: Optional[float] = Field(None, description="输出token单价")
    supports_streaming: bool = Field(True, description="是否支持流式输出")
    supports_tools: bool = Field(False, description="是否支持工具调用")
    supports_vision: bool = Field(False, description="是否支持视觉功能")
    config: Dict[str, Any] = Field(default={}, description="模型特定配置")


class CustomModelCreate(CustomModelBase):
    """创建自定义模型请求模型"""
    provider_instance_id: int = Field(..., description="关联的提供商实例ID")


class CustomModelUpdate(BaseSchema):
    """更新自定义模型请求模型"""
    
    name: Optional[str] = Field(None, description="模型显示名称")
    description: Optional[str] = Field(None, description="模型描述")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    input_cost_per_token: Optional[float] = Field(None, description="输入token单价")
    output_cost_per_token: Optional[float] = Field(None, description="输出token单价")
    supports_streaming: Optional[bool] = Field(None, description="是否支持流式输出")
    supports_tools: Optional[bool] = Field(None, description="是否支持工具调用")
    supports_vision: Optional[bool] = Field(None, description="是否支持视觉功能")
    config: Optional[Dict[str, Any]] = Field(None, description="模型特定配置")
    is_enabled: Optional[bool] = Field(None, description="是否启用")


class CustomModel(CustomModelBase):
    """自定义模型响应模型（用于Provider Instance内部嵌套）"""
    
    id: int = Field(..., description="模型ID")
    is_enabled: bool = Field(True, description="是否启用")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class CustomModelResponse(CustomModel):
    """自定义模型完整响应模型（向后兼容）"""
    
    provider_instance_id: int = Field(..., description="关联的提供商实例ID")
    project_id: int = Field(..., description="所属项目ID")


# 提供商实例相关Schema
class ProviderInstanceBase(BaseSchema):
    """提供商实例基础模型"""
    
    name: str = Field(..., description="实例名称")
    provider_type: str = Field(..., description="提供商类型")
    config: Dict[str, Any] = Field(default={}, description="配置信息")
    enabled_models: List[str] = Field(..., description="启用的模型ID列表")


class ProviderInstanceCreate(ProviderInstanceBase):
    """创建提供商实例请求模型"""
    pass


class ProviderInstanceUpdate(BaseSchema):
    """更新提供商实例请求模型"""
    
    name: Optional[str] = Field(None, description="实例名称")
    config: Optional[Dict[str, Any]] = Field(None, description="配置信息")
    is_enabled: Optional[bool] = Field(None, description="是否启用")
    enabled_models: Optional[List[str]] = Field(None, description="启用的模型ID列表")


class ProviderInstance(ProviderInstanceBase):
    """提供商实例响应模型"""
    
    id: int = Field(..., description="实例ID")
    project_id: int = Field(..., description="所属项目ID")
    is_enabled: bool = Field(..., description="是否启用")
    enabled_models: List[str] = Field(..., description="启用的模型ID列表")
    connection_status: ConnectionStatus = Field(..., description="连接状态")
    error_message: Optional[str] = Field(None, description="错误信息")
    last_tested_at: Optional[datetime] = Field(None, description="最后测试时间")
    custom_models: Optional[List[CustomModel]] = Field(default=[], description="自定义模型列表")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


# 可用模型（聚合所有模型）
class AvailableModel(BaseSchema):
    """可用模型"""
    
    id: str = Field(..., description="模型唯一标识，格式：{type}:{id}")
    name: str = Field(..., description="模型显示名称")
    model_id: str = Field(..., description="实际调用的模型ID")
    provider_name: str = Field(..., description="提供商名称")
    provider_type: str = Field(..., description="提供商类型")
    description: Optional[str] = Field(None, description="模型描述")
    context_window: Optional[int] = Field(None, description="上下文窗口大小")
    input_cost_per_token: Optional[float] = Field(None, description="输入token单价")
    output_cost_per_token: Optional[float] = Field(None, description="输出token单价")
    supports_streaming: bool = Field(True, description="是否支持流式输出")
    supports_tools: bool = Field(False, description="是否支持工具调用")
    supports_vision: bool = Field(False, description="是否支持视觉功能")
    is_custom: bool = Field(..., description="是否为自定义模型")
    is_enabled: bool = Field(True, description="是否启用")


# 模型调用配置
class ModelCallConfig(BaseSchema):
    """模型调用配置"""
    
    provider_type: str = Field(..., description="提供商类型")
    model_id: str = Field(..., description="模型ID")
    provider_config: Dict[str, Any] = Field(..., description="提供商配置")
    model_config_data: Dict[str, Any] = Field(default={}, description="模型特定配置")


# 连接测试请求
class TestConnectionRequest(BaseSchema):
    """测试连接请求"""
    
    provider_type: str = Field(..., description="提供商类型")
    config: Dict[str, Any] = Field(..., description="配置信息")


# 连接测试响应
class TestConnectionResponse(BaseSchema):
    """测试连接响应"""
    
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="响应消息")
    latency: Optional[float] = Field(None, description="延迟（毫秒）")
    error_details: Optional[str] = Field(None, description="错误详情") 