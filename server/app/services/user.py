from fastapi import Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.project import ProjectService
from app.models.user import UserUpdate, Users
from app.db.session import get_db
import logging

logger = logging.getLogger(__name__)


class UserService:
    """用户服务"""

    def __init__(self, db: AsyncSession = Depends(get_db), project_service: ProjectService = Depends(ProjectService)):
        self.db = db
        self.project_service = project_service

    async def switch_project(self, user_id: int, project_id: int) -> None:
        await self.db.execute(
            update(Users).where(Users.id == user_id).values(current_project_id=project_id)
        )
        await self.db.commit()

    async def update_user(self, user_id: int, data: UserUpdate) -> Users:
        """更新用户信息"""
        await self.db.execute(
            update(Users).where(Users.id == user_id).values(data.model_dump(exclude_unset=True, exclude_none=True))
        )
        await self.db.commit()
        return await self.get_user_by_id(user_id)
    
    async def get_user_by_id(self, user_id: int) -> Users:
        """获取用户信息"""
        result = await self.db.execute(
            select(Users).where(Users.id == user_id)
        )
        return result.scalar_one_or_none()