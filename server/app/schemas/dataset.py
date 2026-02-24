from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import Field, validator

from app.schemas.base import BaseSchema, TimestampSchema


# 数据集基础模型
class DatasetBase(BaseSchema):
    """数据集基础模型"""
    
    name: str
    description: Optional[str] = None
    project_id: int
    variables: List[str] = []
    variable_descriptions: Optional[Dict[str, str]] = None


# 创建数据集模型
class DatasetCreate(DatasetBase):
    """创建数据集模型"""
    pass


# 更新数据集模型
class DatasetUpdate(BaseSchema):
    """更新数据集模型"""
    
    name: Optional[str] = None
    description: Optional[str] = None
    variables: Optional[List[str]] = None
    variable_descriptions: Optional[Dict[str, str]] = None


# 数据集完整模型
class Dataset(DatasetBase, TimestampSchema):
    """数据集完整模型"""
    
    id: int
    user_id: Optional[int] = None


# 数据集项基础模型
class DatasetItemBase(BaseSchema):
    """数据集项基础模型"""
    
    name: Optional[str] = None
    variables_values: Dict[str, Any] = {}
    expected_output: Optional[str] = None
    is_enabled: bool = True


# 创建数据集项模型
class DatasetItemCreate(DatasetItemBase):
    """创建数据集项模型"""
    pass


# 更新数据集项模型
class DatasetItemUpdate(BaseSchema):
    """更新数据集项模型"""
    
    name: Optional[str] = None
    variables_values: Optional[Dict[str, Any]] = None
    expected_output: Optional[str] = None
    is_enabled: Optional[bool] = None


# 数据集项完整模型
class DatasetItem(DatasetItemBase, TimestampSchema):
    """数据集项完整模型"""
    
    id: int
    dataset_id: int


# 批量导入数据集项请求
class BatchImportRequest(BaseSchema):
    """批量导入数据集项请求"""
    
    test_cases: List[Dict[str, Any]]


# 批量导入数据集项响应
class BatchImportResponse(BaseSchema):
    """批量导入数据集项响应"""
    
    detail: str
    count: int


# 数据分析请求
class DataAnalysisRequest(BaseSchema):
    """数据分析请求"""
    
    analysis_description: str
    output_fields: List[Dict[str, str]]  # [{"field_name": "字段名", "description": "字段描述"}]


# 数据分析响应
class DataAnalysisResponse(BaseSchema):
    """数据分析响应"""
    
    prompt_id: int
    prompt_name: str
    test_cases_count: int
    message: str