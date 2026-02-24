from pydantic import ConfigDict
from typing import Optional
from pydantic.alias_generators import to_camel 
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String

from app.db.base import Base, TimestampMixin

from app.schemas.base import BaseSchema



# API 模型
class UserBase(BaseSchema):
    username: str

class UserCreate(UserBase):
    model_config = ConfigDict(
        populate_by_name=True,  # 允许通过别名或字段名访问
        alias_generator=to_camel  # 将字段名转为 camelCase
    )
    
    password: str
    nickname: Optional[str] = None

class UserLogin(UserBase):
    password: str

class UserUpdate(BaseSchema):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None

class PasswordUpdate(BaseSchema):
    old_password: str
    new_password: str

class Users(Base, TimestampMixin):
    """用户模型"""
    __tablename__ = "users"
    
    username = Column(String(255), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    password = Column(String(255), nullable=False)
    nickname = Column(String(255), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    is_active = Column(Boolean(), default=True)
    current_project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

class Token(BaseSchema):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseSchema):
    user_id: Optional[int] = None