from datetime import datetime
from typing import Optional

from pydantic import validator

from app.schemas.base import BaseSchema, TimestampSchema


# 用户基础模型
class UserBase(BaseSchema):
    """用户基础模型"""
    
    username: str
    nickname: Optional[str] = None


# 创建用户模型
class UserCreate(UserBase):
    """创建用户模型"""
    
    password: str
    
    @validator('password')
    def password_min_length(cls, v):
        """密码长度校验"""
        if len(v) < 6:
            raise ValueError('密码长度不能少于6个字符')
        return v


# 更新用户模型
class UserUpdate(BaseSchema):
    """更新用户模型"""
    
    nickname: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


# 用户完整模型
class User(UserBase, TimestampSchema):
    """用户完整模型"""
    
    id: int
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool


# 用户信息模型
class UserInfo(User):
    """用户信息模型，用于API响应"""
    pass


# 修改密码模型
class PasswordChange(BaseSchema):
    """修改密码模型"""
    
    current_password: str
    new_password: str
    
    @validator('new_password')
    def password_min_length(cls, v):
        """密码长度校验"""
        if len(v) < 6:
            raise ValueError('新密码长度不能少于6个字符')
        return v


# 认证相关模型
class Token(BaseSchema):
    """令牌模型"""
    
    access_token: str
    token_type: str = "bearer"
    expires_at: int


class TokenData(BaseSchema):
    """令牌数据模型"""
    
    user_id: int
    exp: Optional[datetime] = None


class LoginRequest(BaseSchema):
    """登录请求模型"""
    
    username: str
    password: str


class LoginResponse(BaseSchema):
    """登录响应模型"""
    
    access_token: str
    token_type: str = "bearer"
    expires_at: int
    user: User