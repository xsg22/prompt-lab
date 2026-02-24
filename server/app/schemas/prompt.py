from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


# 标签模型
class TagBase(BaseSchema):
    """标签基础模型"""
    name: str
    color: Optional[str] = None
    project_id: int


class TagCreate(TagBase):
    """创建标签模型"""
    pass


class TagUpdate(BaseSchema):
    """更新标签模型"""
    name: Optional[str] = None
    color: Optional[str] = None


class Tag(TagBase, TimestampSchema):
    """标签完整模型"""
    id: int


# 别名，用于API响应
class TagResponse(Tag):
    """标签响应模型（别名）"""
    pass


# 消息模型
class Message(BaseSchema):
    """消息模型"""
    
    role: str
    content: str
    order: Optional[int] = None


# 提示词基础模型
class PromptBase(BaseSchema):
    """提示词基础模型"""
    
    name: str
    description: Optional[str] = None
    project_id: int
    status: Optional[str] = "active"  # active, archived, draft
    is_template: Optional[bool] = False


# 创建提示词模型
class PromptCreate(PromptBase):
    """创建提示词模型"""
    tag_ids: Optional[List[int]] = []  # 关联的标签ID列表


# 更新提示词模型
class PromptUpdate(BaseSchema):
    """更新提示词模型"""
    
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_template: Optional[bool] = None
    tag_ids: Optional[List[int]] = None


# 提示词完整模型
class Prompt(PromptBase, TimestampSchema):
    """提示词完整模型"""
    
    id: int
    user_id: Optional[int] = None
    tags: Optional[List[Tag]] = []
    is_favorited: Optional[bool] = False  # 当前用户是否收藏


class PromptList(Prompt, TimestampSchema):
    """提示词列表模型"""
    
    nickname: Optional[str] = None


# 别名，用于API响应
class PromptResponse(Prompt):
    """提示词响应模型（别名）"""
    pass


# 收藏操作模型
class FavoriteRequest(BaseSchema):
    """收藏操作请求"""
    prompt_id: int


# 批量操作模型
class BatchPromptRequest(BaseSchema):
    """批量操作请求"""
    prompt_ids: List[int]
    action: str  # favorite, unfavorite, archive, delete, add_tag, remove_tag
    tag_id: Optional[int] = None  # 当action为add_tag或remove_tag时使用


# 别名，用于API响应
class BatchOperationRequest(BatchPromptRequest):
    """批量操作请求（别名）"""
    pass


# 复制提示词请求模型
class PromptDuplicateRequest(BaseSchema):
    """复制提示词请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    tag_ids: Optional[List[int]] = None


# 提示词版本基础模型
class PromptVersionBase(BaseSchema):
    """提示词版本基础模型"""
    
    prompt_id: int
    messages: List[Message] = []
    variables: List[str] = []
    model_name: str = ""
    model_params: Dict[str, Any] = {}


# 创建提示词版本模型
class PromptVersionCreate(PromptVersionBase):
    """创建提示词版本模型"""
    pass


# 更新提示词版本模型
class PromptVersionUpdate(BaseSchema):
    """更新提示词版本模型"""
    
    messages: Optional[List[Message]] = None
    variables: Optional[List[str]] = None
    model_name: Optional[str] = None
    model_params: Optional[Dict[str, Any]] = None


# 提示词版本完整模型
class PromptVersion(PromptVersionBase, TimestampSchema):
    """提示词版本完整模型"""
    
    id: int
    version_number: int


# 测试用例基础模型
class TestCaseBase(BaseSchema):
    """测试用例基础模型"""
    
    prompt_version_id: int
    name: Optional[str] = None
    variables_values: Dict[str, Any] = {}
    metadatas: Optional[Dict[str, Any]] = None


# 创建测试用例模型
class TestCaseCreate(TestCaseBase):
    """创建测试用例模型"""
    pass


# 更新测试用例模型
class TestCaseUpdate(BaseSchema):
    """更新测试用例模型"""
    
    name: Optional[str] = None
    variables_values: Optional[Dict[str, Any]] = None
    metadatas: Optional[Dict[str, Any]] = None

# 测试用例完整模型
class TestCase(TestCaseBase, TimestampSchema):
    """测试用例完整模型"""
    
    id: int


# 请求记录基础模型
class RequestBase(BaseSchema):
    """请求记录基础模型"""
    
    prompt_version_id: Optional[int] = None
    source: str
    input: Dict[str, Any] = {}
    variables_values: Dict[str, Any] = {}


# 请求记录完整模型
class Request(RequestBase, TimestampSchema):
    """请求记录完整模型"""
    
    id: int
    output: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    execution_time: Optional[int] = None
    cost: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None


# LLM 配置模型
class ModelConfig(BaseSchema):
    """LLM 配置模型"""
    
    provider: str
    model: str
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = None
    frequency_penalty: Optional[float] = None


# LLM 请求模型
class LLMRequest(BaseSchema):
    """LLM 请求模型"""
    
    messages: List[Message]
    config: ModelConfig
    prompt_id: Optional[int] = None
    prompt_version_id: Optional[int] = None 
    project_id: int
    source: Optional[str] = "dashboard"