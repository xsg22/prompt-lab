from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


# 评估流水线基础模型
class EvalPipelineBase(BaseSchema):
    """评估流水线基础模型"""
    
    name: str
    description: Optional[str] = None
    project_id: int
    dataset_id: int


# 创建评估流水线模型
class EvalPipelineCreate(EvalPipelineBase):
    """创建评估流水线模型"""
    selected_item_ids: Optional[List[int]] = None  # 可选的选中数据项ID列表


# 更新评估流水线模型
class EvalPipelineUpdate(BaseSchema):
    """更新评估流水线模型"""
    
    name: Optional[str] = None
    description: Optional[str] = None
    dataset_id: Optional[int] = None


# 评估流水线完整模型
class EvalPipeline(EvalPipelineBase, TimestampSchema):
    """评估流水线完整模型"""
    
    id: int
    user_id: int
    
# 评估流水线完整模型
class EvalPipelineList(EvalPipeline, TimestampSchema):
    """评估流水线完整模型"""
    
    dataset_name: Optional[str] = None
    creator_name: Optional[str] = None
    run_type: str


# 评估列基础模型
class EvalColumnBase(BaseSchema):
    """评估列基础模型"""
    
    pipeline_id: int
    name: str
    column_type: str
    position: int
    config: Dict[str, Any] = {}


# 创建评估列模型
class EvalColumnCreate(EvalColumnBase):
    """创建评估列模型"""
    pass


# 更新评估列模型
class EvalColumnUpdate(BaseSchema):
    """更新评估列模型"""
    
    name: Optional[str] = None
    column_type: Optional[str] = None
    position: Optional[int] = None
    config: Optional[Dict[str, Any]] = None


# 评估列完整模型
class EvalColumn(EvalColumnBase, TimestampSchema):
    """评估列完整模型"""
    
    id: int


# 评估结果基础模型
class EvalResultBase(BaseSchema):
    """评估结果基础模型"""
    
    pipeline_id: int
    run_type: str # 运行类型，staging表示测试运行，production表示生产运行


# 创建评估结果模型
class EvalResultCreate(EvalResultBase):
    """创建评估结果模型"""
    execution_mode: str
    selected_item_ids: Optional[List[int]] = None


# 评估结果完整模型
class EvalResult(EvalResultBase, TimestampSchema):
    """评估结果完整模型"""
    
    id: int
    status: str = "new" # 状态, 如new, running, completed
    total_count: Optional[int] = 0
    passed_count: Optional[int] = 0
    failed_count: Optional[int] = 0
    unpassed_count: Optional[int] = 0
    success_rate: Optional[float] = 0.0
    prompt_versions: Optional[Dict[str, Any]] = None # 评估执行时使用的提示词版本信息


# 评估结果统计模型
class EvalResultWithStats(EvalResult):
    """带统计信息的评估结果模型"""
    
    total_cells: Optional[int] = 0
    completed_cells: Optional[int] = 0
    failed_cells: Optional[int] = 0
    running_cells: Optional[int] = 0
    new_cells: Optional[int] = 0


# 评估单元格基础模型
class EvalCellBase(BaseSchema):
    """评估单元格基础模型"""
    
    pipeline_id: int
    dataset_item_id: int
    eval_column_id: int
    result_id: int
    status: str = "new"
    value: Optional[Dict[str, Any]] = None
    display_value: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


# 创建评估单元格模型
class EvalCellCreate(EvalCellBase):
    """创建评估单元格模型"""
    pass


# 更新评估单元格模型
class EvalCellUpdate(BaseSchema):
    """更新评估单元格模型"""
    
    status: Optional[str] = None
    value: Optional[Dict[str, Any]] = None
    display_value: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


# 评估单元格完整模型
class EvalCell(EvalCellBase, TimestampSchema):
    """评估单元格完整模型"""
    
    id: int


# 单列评估请求模型
class SingleColumnEvalRequest(BaseSchema):
    """单列评估请求模型"""
    
    column_id: int
    dataset_item_id: Optional[int] = None # 如果为空，则表示评估当前列所有的数据项，否则表示评估指定数据项
    previous_values: Dict[int, Any] = {}  # 前面列的值
    value: Optional[Dict[str, Any]] = None  # 当前列的值 