from typing import Any, Dict, List, Optional

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema
from app.schemas.prompt import Message


# 支持的功能 key 常量
class AIFeatureKey:
    TRANSLATE = "translate"
    TEST_CASE_GENERATOR = "test_case_generator"
    PROMPT_OPTIMIZER = "prompt_optimizer"
    PROMPT_ASSISTANT_CHAT = "prompt_assistant_chat"
    PROMPT_ASSISTANT_MINI = "prompt_assistant_mini"
    EVALUATION_LLM = "evaluation_llm"

    ALL = [
        TRANSLATE,
        TEST_CASE_GENERATOR,
        PROMPT_OPTIMIZER,
        PROMPT_ASSISTANT_CHAT,
        PROMPT_ASSISTANT_MINI,
        EVALUATION_LLM,
    ]

    # 各功能 key 的中文名称
    LABELS = {
        TRANSLATE: "提示词翻译",
        TEST_CASE_GENERATOR: "测试用例生成",
        PROMPT_OPTIMIZER: "提示词优化",
        PROMPT_ASSISTANT_CHAT: "AI助手对话（标准）",
        PROMPT_ASSISTANT_MINI: "AI助手辅助任务（快速）",
        EVALUATION_LLM: "评估 LLM 裁判",
    }


# 每个功能的默认提供商和模型
DEFAULT_CONFIGS = {
    AIFeatureKey.TRANSLATE: ("openai", "gpt-4.1"),
    AIFeatureKey.TEST_CASE_GENERATOR: ("openai", "gpt-4.1"),
    AIFeatureKey.PROMPT_OPTIMIZER: ("openai", "gpt-4.1"),
    AIFeatureKey.PROMPT_ASSISTANT_CHAT: ("openai", "gpt-4.1"),
    AIFeatureKey.PROMPT_ASSISTANT_MINI: ("openai", "gpt-4.1-mini"),
    AIFeatureKey.EVALUATION_LLM: ("openai", "gpt-4.1"),
}


class AIFeatureConfigBase(BaseSchema):
    """AI功能模型配置基础模型"""
    feature_key: str = Field(..., description="功能标识")
    provider: str = Field(..., description="模型提供商，如 openai")
    model_id: str = Field(..., description="模型ID，如 gpt-4.1")


class AIFeatureConfigCreate(AIFeatureConfigBase):
    """创建AI功能模型配置"""
    pass


class AIFeatureConfigUpdate(BaseSchema):
    """更新AI功能模型配置"""
    provider: str = Field(..., description="模型提供商")
    model_id: str = Field(..., description="模型ID")


class AIFeatureConfigResponse(AIFeatureConfigBase, TimestampSchema):
    """AI功能模型配置响应"""
    id: int
    project_id: int
    label: Optional[str] = Field(None, description="功能显示名称")


class AIFeatureBatchUpdateRequest(BaseSchema):
    """批量更新AI功能模型配置请求"""
    configs: List[AIFeatureConfigCreate] = Field(..., description="配置列表")


class AIFeatureCallRequest(BaseSchema):
    """AI功能调用请求"""
    feature_key: str = Field(..., description="功能标识")
    messages: List[Message] = Field(..., description="消息列表")
    temperature: Optional[float] = Field(None, description="温度参数")
    max_tokens: Optional[int] = Field(None, description="最大token数")
    prompt_id: Optional[int] = Field(None, description="提示词ID")
    prompt_version_id: Optional[int] = Field(None, description="提示词版本ID")
    extra_params: Optional[Dict[str, Any]] = Field(None, description="额外参数")
