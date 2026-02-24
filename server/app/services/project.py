import secrets
import string
from typing import Any, Dict, List, Optional, Union
import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.project import Project, ProjectInvitation, ProjectMember
from app.models.user import Users
from app.schemas.project import (
    ProjectCreate, ProjectMemberCreate, ProjectUpdate, ProjectMemberUpdate
)
from app.services.base import CRUDBase

logger = get_logger(__name__)


class ProjectService:
    """项目服务"""
    
    def __init__(self, db: AsyncSession = Depends(get_db)):
        """初始化"""
        self.db = db
        self.project_crud = CRUDBase(Project)
        self.member_crud = CRUDBase(ProjectMember)
        self.invitation_crud = CRUDBase(ProjectInvitation)
    
    # 项目相关方法
    
    async def get_user_projects(self, user_id: int) -> List[Project]:
        """获取用户所属的所有项目"""
        result = await self.db.execute(
            select(Project).join(
                ProjectMember, ProjectMember.project_id == Project.id
            ).where(
                ProjectMember.user_id == user_id
            )
        )
        return result.scalars().all()
    
    async def create_project(self, data: ProjectCreate, user_id: int) -> Project:
        """创建项目"""
        # 创建项目
        db_project = Project(**data.model_dump())
        self.db.add(db_project)
        await self.db.flush()  # 提交以获取ID，但不提交事务
        
        # 添加创建者为项目管理员
        db_member = ProjectMember(
            user_id=user_id,
            project_id=db_project.id,
            role="admin"
        )
        self.db.add(db_member)
        
        # 提交事务
        await self.db.commit()
        await self.db.refresh(db_project)
        
        return db_project
    
    async def get_project(self, project_id: int, user_id: int) -> Project:
        """获取项目详情"""
        # 检查访问权限
        await self._check_project_access(project_id, user_id)
        
        # 获取项目
        return await self.project_crud.get(self.db, project_id)
    
    async def update_project(self, project_id: int, data: ProjectUpdate, user_id: int) -> Project:
        """更新项目"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 获取项目
        project = await self.get_project(project_id, user_id)
        
        # 更新项目
        return await self.project_crud.update(
            self.db,
            db_obj=project,
            obj_in=data
        )
    
    async def delete_project(self, project_id: int, project_name: str, user_id: int) -> None:
        """删除项目"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 获取项目
        project = await self.project_crud.get(self.db, project_id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="项目不存在"
            )
        
        # 验证项目名称
        if project.name != project_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="项目名称不匹配，无法删除"
            )
        
        # 删除项目
        await self.project_crud.remove(self.db, id=project_id)
    
    # 项目成员相关方法
    
    async def get_project_members(self, project_id: int, user_id: int) -> List[Dict[str, Any]]:
        """获取项目成员列表"""
        # 检查访问权限
        await self._check_project_access(project_id, user_id)
        
        # 获取项目成员
        result = await self.db.execute(
            select(ProjectMember, Users).join(
                Users, Users.id == ProjectMember.user_id
            ).where(
                ProjectMember.project_id == project_id
            )
        )
        
        members = []
        for member, user in result:
            members.append({
                "id": member.id,
                "user_id": user.id,
                "email": user.email,
                "nickname": user.nickname,
                "role": member.role,
            })
        
        return members
    
    async def add_project_member(self, project_id: int, data: ProjectMemberCreate, user_id: int) -> ProjectMember:
        """添加项目成员"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 查找用户
        result = await self.db.execute(
            select(Users).where(Users.email == data.email)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 检查用户是否已经是项目成员
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id
            )
        )
        
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该用户已经是项目成员"
            )
        
        # 创建项目成员
        db_member = ProjectMember(
            user_id=user.id,
            project_id=project_id,
            role=data.role
        )
        self.db.add(db_member)
        await self.db.commit()
        await self.db.refresh(db_member)
        
        return db_member
    
    async def update_member_role(self, project_id: int, member_id: int, data: ProjectMemberUpdate, user_id: int) -> ProjectMember:
        """更新成员角色"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 不能更改自己的角色
        if member_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能更改自己的角色"
            )
        
        # 检查角色是否有效
        valid_roles = ["admin", "member", "readonly"]
        if data.role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的角色，有效值为: {', '.join(valid_roles)}"
            )
        
        # 获取成员
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.id == member_id
            )
        )
        member = result.scalar_one_or_none()
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="成员不存在"
            )
        
        # 更新角色
        member.role = data.role
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(member)
        
        return member
    
    async def remove_member(self, project_id: int, member_id: int, user_id: int) -> None:
        """移除成员"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 不能移除自己
        if member_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能移除自己"
            )
        
        # 移除成员
        result = await self.db.execute(
            delete(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.id == member_id
            )
        )
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="成员不存在"
            )
        
        await self.db.commit()
    
    # 邀请相关方法
    
    async def generate_invite_link(self, project_id: int, role: str, user_id: int) -> str:
        """生成邀请链接"""
        # 检查管理员权限
        # await self._check_admin_permission(project_id, user_id)
        
        # 检查角色是否有效
        valid_roles = ["admin", "member", "readonly"]
        if role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的角色，有效值为: {', '.join(valid_roles)}"
            )
        
        # 生成唯一邀请码
        token = str(uuid.uuid4())
        
        # 创建邀请记录
        invitation = ProjectInvitation(
            project_id=project_id,
            user_id=user_id,  # 邀请人
            token=token,
            role=role,
            is_expired=False
        )
        self.db.add(invitation)
        await self.db.commit()
        
        # 返回邀请链接
        return f"/invite/{token}"
    
    async def accept_invitation(self, token: str, user_id: int) -> Project:
        """接受邀请"""
        # 查找邀请
        result = await self.db.execute(
            select(ProjectInvitation).where(
                ProjectInvitation.token == token,
                ProjectInvitation.is_expired == False
            )
        )
        invitation = result.scalar_one_or_none()
        
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="邀请不存在或已过期"
            )
        
        # 检查用户是否已经是项目成员
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == invitation.project_id,
                ProjectMember.user_id == user_id
            )
        )
        
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="您已经是该项目的成员"
            )
        
        # 添加用户为项目成员
        member = ProjectMember(
            user_id=user_id,
            project_id=invitation.project_id,
            role=invitation.role
        )
        self.db.add(member)
        
        # 更新邀请状态为已过期
        invitation.is_expired = True
        
        await self.db.commit()
        
        # 返回项目信息
        return await self.project_crud.get(self.db, invitation.project_id)
    
    # LLM API 配置相关方法
    
    async def get_llm_api_config(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """获取LLM API配置"""
        # 检查访问权限
        await self._check_project_access(project_id, user_id)
        
        # 获取项目
        project = await self.project_crud.get(self.db, project_id)
        
        # 返回配置
        return {
            'webhook_url': project.webhook_url,
        }
    
    async def update_llm_api_config(self, project_id: int, config: Dict[str, Any], user_id: int) -> Dict[str, Any]:
        """更新LLM API配置"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 获取项目
        project = await self.project_crud.get(self.db, project_id)
        
        # 更新配置
        for key, value in config.items():
            if hasattr(project, key):
                setattr(project, key, value)
        
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        
        # 返回更新后的配置
        return await self.get_llm_api_config(project_id, user_id)
    
    # API 密钥相关方法
    
    def _generate_api_key(self) -> str:
        """生成API密钥"""
        alphabet = string.ascii_letters + string.digits
        return 'pl_' + ''.join(secrets.choice(alphabet) for _ in range(32))
    
    # 自定义模型相关方法
    
    async def get_custom_models(self, project_id: int, user_id: int) -> List:
        """获取自定义模型"""
        # 检查访问权限
        await self._check_project_access(project_id, user_id)
        
        # 导入模型
        from server.app.models.project_model import ProjectModel
        
        # 查询自定义模型
        result = await self.db.execute(
            select(ProjectModel).where(ProjectModel.project_id == project_id)
        )
        return result.scalars().all()
    
    async def create_custom_model(self, project_id: int, data, user_id: int):
        """创建自定义模型"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 导入模型和schema
        from server.app.models.project_model import ProjectModel
        
        # 创建自定义模型
        db_model = ProjectModel(
            name=data.name,
            model_id=data.model_id,
            provider_instance_id=data.provider_instance_id,
            project_id=project_id,
            description=data.description,
            context_window=data.context_window,
            input_cost_per_token=data.input_cost_per_token,
            output_cost_per_token=data.output_cost_per_token,
            supports_streaming=data.supports_streaming,
            supports_tools=data.supports_tools,
            supports_vision=data.supports_vision,
            config=data.config
        )
        
        self.db.add(db_model)
        await self.db.commit()
        await self.db.refresh(db_model)
        
        return db_model
    
    async def update_custom_model(self, project_id: int, model_id: int, data, user_id: int):
        """更新自定义模型"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 导入模型
        from server.app.models.project_model import ProjectModel
        
        # 获取模型
        result = await self.db.execute(
            select(ProjectModel).where(
                ProjectModel.id == model_id,
                ProjectModel.project_id == project_id
            )
        )
        model = result.scalar_one_or_none()
        
        if not model:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="自定义模型不存在"
            )
        
        # 更新字段
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(model, field, value)
        
        self.db.add(model)
        await self.db.commit()
        await self.db.refresh(model)
        
        return model
    
    async def delete_custom_model(self, project_id: int, model_id: int, user_id: int) -> None:
        """删除自定义模型"""
        # 检查管理员权限
        await self._check_admin_permission(project_id, user_id)
        
        # 导入模型
        from server.app.models.project_model import ProjectModel
        
        # 删除模型
        result = await self.db.execute(
            delete(ProjectModel).where(
                ProjectModel.id == model_id,
                ProjectModel.project_id == project_id
            )
        )
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="自定义模型不存在"
            )
        
        await self.db.commit()
    
    # 权限检查辅助方法
    
    async def _check_project_access(self, project_id: int, user_id: int) -> None:
        """检查用户是否有权限访问项目"""
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id
            )
        )
        
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="您没有权限访问此项目"
            )
    
    async def _check_admin_permission(self, project_id: int, user_id: int) -> None:
        """检查用户是否具有项目管理员权限"""
        result = await self.db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                ProjectMember.role == "admin"
            )
        )
        
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="您需要管理员权限才能执行此操作"
            ) 