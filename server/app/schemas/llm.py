from typing import Dict, List, Optional, Any

from pydantic import Field

from app.schemas.base import BaseSchema


class Message(BaseSchema):
    """消息模型"""
    role: str = Field(..., description="角色，如'system', 'user', 'assistant'")
    content: str = Field(..., description="消息内容")


class LLMConfig(BaseSchema):
    """LLM配置模型"""
    provider: str = Field(..., description="提供商，如'openai', 'anthropic'等")
    model: str = Field(..., description="模型名称，如'gpt-4o', 'claude-3-opus'等")
    temperature: Optional[float] = Field(None, description="温度参数，控制随机性")
    top_p: Optional[float] = Field(None, description="核采样参数")
    max_tokens: Optional[int] = Field(None, description="最大生成token数")
    presence_penalty: Optional[float] = Field(None, description="存在惩罚参数")
    frequency_penalty: Optional[float] = Field(None, description="频率惩罚参数")
    stop: Optional[List[str]] = Field(None, description="停止序列")


class LLMRequest(BaseSchema):
    """LLM请求模型"""
    messages: List[Message] = Field(..., description="消息列表")
    config: LLMConfig = Field(..., description="LLM配置")
    prompt_id: Optional[int] = Field(None, description="提示词ID")
    prompt_version_id: Optional[int] = Field(None, description="提示词版本ID")
    source: Optional[str] = Field("dashboard", description="请求来源")


class LLMStreamRequest(BaseSchema):
    """LLM流式请求模型"""
    messages: List[Message] = Field(..., description="消息列表")
    config: LLMConfig = Field(..., description="LLM配置")
    prompt_id: Optional[int] = Field(None, description="提示词ID")
    prompt_version_id: Optional[int] = Field(None, description="提示词版本ID")
    project_id: int = Field(..., description="项目ID")
    source: Optional[str] = Field("dashboard", description="请求来源")


class TokenUsage(BaseSchema):
    """Token使用量模型"""
    prompt: int = Field(..., description="提示词token数")
    completion: int = Field(..., description="补全token数")
    total: int = Field(..., description="总token数")


class LLMResponse(BaseSchema):
    """LLM响应模型"""
    message: str = Field(..., description="生成的文本")
    tokens: TokenUsage = Field(..., description="token使用量")
    execution_time: int = Field(..., description="执行时间(ms)")
    cost: str = Field(..., description="费用")
    model: str = Field(..., description="使用的模型")
    request_id: Optional[str] = Field(None, description="请求ID")
    params: Optional[Dict[str, Any]] = Field(None, description="请求参数")


class LLMStreamChunk(BaseSchema):
    """LLM流式响应片段模型"""
    type: str = Field(..., description="数据类型：'chunk', 'done', 'error'")
    content: Optional[str] = Field(None, description="内容片段")
    error: Optional[str] = Field(None, description="错误信息")
    usage: Optional[TokenUsage] = Field(None, description="token使用量（完成时）")
    cost: Optional[str] = Field(None, description="费用（完成时）")
    execution_time: Optional[int] = Field(None, description="执行时间ms（完成时）")
    model: Optional[str] = Field(None, description="使用的模型（完成时）")


class LLMCallResponse(BaseSchema):
    """LLM调用响应模型（兼容现有接口）"""
    params: Dict[str, Any] = Field(..., description="请求参数")
    message: str = Field(..., description="生成的文本")
    tokens: TokenUsage = Field(..., description="token使用量")
    cost: str = Field(..., description="费用")
    execution_time: int = Field(..., description="执行时间(ms)") 