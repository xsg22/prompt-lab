from datetime import datetime
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
import json
from sqlalchemy.ext import mutable
from sqlalchemy.types import TypeDecorator, TEXT

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """基础模型配置"""
    
    model_config = ConfigDict(
        from_attributes=True,  # 允许从ORM模型创建
        populate_by_name=True,  # 允许按字段名称填充
        protected_namespaces=()  # 禁止使用 __private_fields__ 命名空间
    )


# 通用类型变量
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class TimestampSchema(BaseSchema):
    """带有时间戳的模型"""
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ResponseBase(BaseSchema, Generic[ModelType]):
    """统一响应基类"""
    
    success: bool = True
    message: str = "操作成功"
    data: Optional[ModelType] = None


class PaginatedResponse(ResponseBase[List[ModelType]], Generic[ModelType]):
    """分页响应"""
    
    total: int
    page: int
    limit: int
    items: List[ModelType]


class ErrorResponse(BaseSchema):
    """错误响应"""
    
    success: bool = False
    message: str
    error_code: Optional[str] = None
    details: Optional[Any] = None 



class PydanticEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, BaseModel):
            return obj.model_dump()
        return super().default(obj)

class PydanticList(TypeDecorator):
    """自动处理 Pydantic 模型列表的自定义类型"""
    
    impl = TEXT
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        
        # 自动将 Pydantic 模型转换为字典
        if isinstance(value, list) and value and isinstance(value[0], BaseModel):
            value = [item.model_dump() for item in value]
            
        return json.dumps(value, cls=PydanticEncoder)
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return json.loads(value)

# 使列表可变
mutable.MutableList.associate_with(PydanticList)