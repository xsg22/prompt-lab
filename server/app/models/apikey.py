from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base as BaseModel


from app.db.base import Base, TimestampMixin


class ApiKey(Base, TimestampMixin):
    """API密钥模型"""
    __tablename__ = "api_keys"
    
    name = Column(String(255), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    key_hash = Column(String(255), nullable=False)
    prefix = Column(String(8), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    
    # 关系
    # project = relationship("Project", back_populates="api_keys")

# class ApiKeyCreate(BaseModel):
#     name: str

# class ApiKeyResponse(BaseModel):
#     id: int
#     name: str
#     key: str
#     createdAt: str 