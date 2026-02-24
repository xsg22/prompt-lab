from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Float, Text, JSON
from sqlalchemy.orm import relationship

from app.db.base import Base, TimestampMixin


class BillingInfo(Base, TimestampMixin):
    """账单信息模型"""
    __tablename__ = "billing_info"
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    current_month_cost = Column(Float, nullable=False, default=0.0)
    previous_month_cost = Column(Float, nullable=False, default=0.0)
    total_cost = Column(Float, nullable=False, default=0.0)
    current_month_usage = Column(JSON, nullable=False, default=list)
    daily_usage = Column(JSON, nullable=False, default=dict)
    last_updated_at = Column(DateTime, nullable=False, default=datetime.now)
    
    # 关系
    # project = relationship("Project", back_populates="billing_info") 