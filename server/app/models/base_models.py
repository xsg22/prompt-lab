from typing import Dict, List, Optional, Any
from datetime import datetime

from app.schemas.base import BaseSchema 

# 定义全局配置类

class Prompt(BaseSchema):
    id: Optional[int] = None
    name: str
    user_id: Optional[int] = None
    description: Optional[str] = None
    project_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class DatasetCreate(BaseSchema):
    name: str
    description: Optional[str] = None
    user_id: Optional[int] = None
    project_id: Optional[int] = None
    variables: List[str] = []

class Message(BaseSchema):
    role: str
    content: str
    order: Optional[int] = None

class PromptVersion(BaseSchema):
     
    id: Optional[int] = None
    prompt_id: int
    version_number: Optional[int] = None
    messages: List[Message] = []
    variables: List[str] = []
    model_name: str = ""
    model_params: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TestCase(BaseSchema):
    
    id: Optional[int] = None
    prompt_version_id: int
    name: Optional[str] = None
    variables_values: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class Request(BaseSchema):
    id: Optional[int] = None
    prompt_version_id: Optional[int] = None
    source: Optional[str] = None
    input: Dict[str, Any] = {}
    variables_values: Optional[Dict[str, Any]] = {}
    output: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    execution_time: Optional[int] = None
    cost: Optional[str] = None
    success: Optional[bool] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ModelConfig(BaseSchema):
    provider: str
    model: str
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = None
    frequency_penalty: Optional[float] = None

class Dataset(BaseSchema):

    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    user_id: Optional[int] = None
    project_id: Optional[int] = None
    prompt_id: Optional[int] = None
    prompt_version_id: Optional[int] = None
    variables: List[str] = []
    evaluation_strategy: str = "exact"
    evaluation_config: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class DatasetItem(BaseSchema):
    
    id: Optional[int] = None
    dataset_id: Optional[int] = None
    name: Optional[str] = None
    expected_output: Optional[str] = None
    variables_values: Optional[Dict[str, Any]] = None
    is_enabled: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class DatasetItemCreate(BaseSchema):
    name: Optional[str] = None
    expected_output: Optional[str] = None
    variables_values: Dict[str, Any] = {}
    is_enabled: Optional[int] = None
    
class DatasetItemUpdate(BaseSchema):
    name: Optional[str] = None
    expected_output: Optional[str] = None
    variables_values: Optional[Dict[str, Any]] = None
    is_enabled: Optional[int] = None

class Evaluation(BaseSchema):
    model_config = BaseSchema.model_config.copy()
    model_config['protected_namespaces'] = ()
    id: Optional[int] = None
    name: str
    user_id: Optional[int] = None
    prompt_id: int
    prompt_version_id: int
    dataset_id: int
    model_name: str
    model_params: Dict[str, Any] = {}
    status: str = "pending"
    total_items: int = 0
    passed_items: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class EvaluationResult(BaseSchema):
    id: Optional[int] = None
    evaluation_id: int
    dataset_item_id: int
    input: Dict[str, Any]
    output: Optional[str] = None
    expected_output: str
    passed: int = 0
    evaluation_details: Optional[Dict[str, Any]] = None
    tokens_used: Optional[int] = None
    execution_time: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class LLMRequest(BaseSchema):
    messages: List[Message]
    config: ModelConfig
    prompt_version_id: Optional[int] = None

class EvalPipelineDTO(BaseSchema):

    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    dataset_id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EvalResultDTO(BaseSchema):
    """评估结果DTO"""
    id: Optional[int] = None
    pipeline_id: Optional[int] = None
    run_type: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class EvalCellDTO(BaseSchema):
    """评估单元DTO"""
    id: Optional[int] = None
    pipeline_id: Optional[int] = None
    dataset_item_id: Optional[int] = None
    eval_column_id: Optional[int] = None
    result_id: Optional[int] = None
    status: Optional[str] = None
    value: Optional[Dict[str, Any]] = None
    display_value: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class EvalCellUpdate(BaseSchema):
    """评估单元更新DTO"""
    status: str
    value: Optional[Dict[str, Any]] = None
    display_value: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None