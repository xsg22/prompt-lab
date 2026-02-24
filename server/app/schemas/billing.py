from datetime import datetime
from typing import Dict, List

from pydantic import Field

from app.schemas.base import BaseSchema


class UsageItem(BaseSchema):
    """使用量项目"""
    name: str = Field(..., description="项目名称")
    count: int = Field(..., description="使用次数")
    tokens: int = Field(..., description="token数量")
    cost: float = Field(..., description="费用")


class BillingInfo(BaseSchema):
    """账单信息模型"""
    project_id: int = Field(..., description="项目ID")
    current_month_cost: float = Field(..., description="当月费用")
    previous_month_cost: float = Field(..., description="上月费用")
    total_cost: float = Field(..., description="总费用")
    current_month_usage: List[UsageItem] = Field(default_factory=list, description="当月使用量明细")
    daily_usage: Dict[str, float] = Field(default_factory=dict, description="近30天每日费用")
    last_updated_at: datetime = Field(..., description="最后更新时间")

    class Config:
        from_attributes = True 