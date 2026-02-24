from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import Users
from app.schemas.user import UserCreate
from app.services.base import CRUDBase
from app.services.project import ProjectService
from app.schemas.project import ProjectCreate
from app.services.user import UserService

logger = get_logger(__name__)


class AuthService:
    """认证服务类"""
    
    def __init__(self, db: AsyncSession = Depends(get_db), 
                 project_service: ProjectService = Depends(ProjectService),
                 user_service: UserService = Depends(UserService)):
        """初始化"""
        self.db = db
        self.crud = CRUDBase(Users)
        self.project_service = project_service
        self.user_service = user_service

    async def get_user_by_username(self, username: str) -> Optional[Users]:
        """通过用户名获取用户"""
        result = await self.db.execute(
            select(Users).where(Users.username == username)
        )
        return result.scalar_one_or_none()
    
    async def authenticate(self, username: str, password: str) -> Optional[Users]:
        """认证用户"""
        user = await self.get_user_by_username(username=username)
        if not user:
            logger.info(f"用户不存在: {username}")
            return None
        if not verify_password(password, user.password):
            logger.info(f"密码错误: {username}")
            return None
        return user
    
    async def create_user(self, user_data: UserCreate) -> Users:
        """创建新用户"""
        db_user = await self.get_user_by_username(username=user_data.username)
        if db_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该账号已被注册",
            )
        
        if not user_data.nickname:
            user_data.nickname = user_data.username

        hashed_password = get_password_hash(user_data.password)
        user_in_db = Users(
            username=user_data.username,
            password=hashed_password,
            nickname=user_data.nickname,
            is_active=True,
        )
        self.db.add(user_in_db)
        await self.db.commit()
        await self.db.refresh(user_in_db)

        project = await self.project_service.create_project(data=ProjectCreate(name='个人空间'), user_id=user_in_db.id)
        await self.user_service.switch_project(user_id=user_in_db.id, project_id=project.id)
        
        return user_in_db
    
    async def update_password(
        self, user: Users, current_password: str, new_password: str
    ) -> Users:
        """更新用户密码"""
        if not verify_password(current_password, user.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误",
            )
        
        hashed_password = get_password_hash(new_password)
        user.password = hashed_password
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        return user