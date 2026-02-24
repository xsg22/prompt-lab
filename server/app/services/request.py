from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Depends, HTTPException, status
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.logging import get_logger
from app.db.session import get_db, get_db_session
from app.models.prompt import Prompt, PromptVersion, Request
from app.schemas.request import RequestCreate, RequestResponse
from app.services.base import CRUDBase

logger = get_logger(__name__)

class RequestService:
    """请求记录服务"""
    
    def __init__(self, db: AsyncSession = Depends(get_db)):
        """初始化"""
        self.db = db
        self.request_crud = CRUDBase(Request)
    
    async def get_requests(
        self,
        page: int = 1,
        page_size: int = 10,
        prompt_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        user_id: Optional[int] = None
    ) -> Tuple[List[RequestResponse], int]:
        """获取请求记录列表"""
        # 构建查询条件
        filters = []
        
        if user_id:
            # 获取用户有权访问的项目ID列表
            from app.models.project import ProjectMember
            member_query = select(ProjectMember.project_id).where(ProjectMember.user_id == user_id)
            project_ids = (await self.db.execute(member_query)).scalars().all()
            
            # 获取用户有权访问的提示词ID列表
            prompt_query = select(Prompt.id).where(Prompt.project_id.in_(project_ids))
            prompt_ids = (await self.db.execute(prompt_query)).scalars().all()
            
            # 获取相关的提示词版本ID列表
            if prompt_ids:
                version_query = select(PromptVersion.id).where(PromptVersion.prompt_id.in_(prompt_ids))
                version_ids = (await self.db.execute(version_query)).scalars().all()
                
                if version_ids:
                    filters.append(Request.prompt_version_id.in_(version_ids))
        
        if prompt_name:
            prompt_ids = (await self.db.execute(
                select(Prompt.id).where(Prompt.name.ilike(f"%{prompt_name}%"))
            )).scalars().all()
            
            if prompt_ids:
                version_ids = (await self.db.execute(
                    select(PromptVersion.id).where(PromptVersion.prompt_id.in_(prompt_ids))
                )).scalars().all()
                
                if version_ids:
                    filters.append(Request.prompt_version_id.in_(version_ids))
                else:
                    # 没有找到相关提示词版本，返回空结果
                    return [], 0
            else:
                # 没有找到相关提示词，返回空结果
                return [], 0
        
        if start_time:
            filters.append(Request.created_at >= start_time)
        
        if end_time:
            filters.append(Request.created_at <= end_time)
        
        # 构建查询
        query = select(Request).options(
            joinedload(Request.prompt_version).joinedload(PromptVersion.prompt)
        )
        
        if filters:
            query = query.where(and_(*filters))
        
        # 计算总数
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar_one()
        
        # 分页和排序
        query = query.order_by(desc(Request.created_at))
        query = query.offset((page - 1) * page_size).limit(page_size)
        
        # 执行查询
        result = await self.db.execute(query)
        requests = result.unique().scalars().all()
        
        # 转换为响应模型
        response_items = []
        for req in requests:
            # 构建基本请求信息
            request_data = {
                "id": req.id,
                "prompt_version_id": req.prompt_version_id,
                "source": req.source,
                "input": req.input,
                "variables_values": req.variables_values,
                "output": req.output,
                "prompt_tokens": req.prompt_tokens,
                "completion_tokens": req.completion_tokens,
                "total_tokens": req.total_tokens,
                "execution_time": req.execution_time,
                "cost": req.cost,
                "success": req.success,
                "error_message": req.error_message,
                "created_at": req.created_at,
                "updated_at": req.updated_at,
            }
            
            # 添加提示词相关信息
            if req.prompt_version and req.prompt_version.prompt:
                request_data.update({
                    "prompt_name": req.prompt_version.prompt.name,
                    "version_number": req.prompt_version.version_number,
                    "model_name": req.prompt_version.model_name,
                })
            
            response_items.append(RequestResponse(**request_data))
        
        return response_items, total
    
    async def get_request(self, request_id: int, user_id: Optional[int] = None) -> Optional[RequestResponse]:
        """获取请求记录详情"""
        query = select(Request).where(Request.id == request_id).options(
            joinedload(Request.prompt_version).joinedload(PromptVersion.prompt)
        )
        
        result = await self.db.execute(query)
        req = result.unique().scalar_one_or_none()
        
        if not req:
            return None
        
        # 如果指定了用户ID，检查权限
        if user_id:
            # 获取请求对应的项目ID
            if req.prompt_version and req.prompt_version.prompt:
                project_id = req.prompt_version.prompt.project_id
                
                # 检查用户是否有权访问该项目
                from app.models.project import ProjectMember
                member_query = select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id
                )
                
                member = (await self.db.execute(member_query)).scalar_one_or_none()
                if not member:
                    return None
        
        # 构建基本请求信息
        request_data = {
            "id": req.id,
            "prompt_version_id": req.prompt_version_id,
            "source": req.source,
            "input": req.input,
            "variables_values": req.variables_values,
            "output": req.output,
            "prompt_tokens": req.prompt_tokens,
            "completion_tokens": req.completion_tokens,
            "total_tokens": req.total_tokens,
            "execution_time": req.execution_time,
            "cost": req.cost,
            "success": req.success,
            "error_message": req.error_message,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
        }
        
        # 添加提示词相关信息
        if req.prompt_version and req.prompt_version.prompt:
            request_data.update({
                "prompt_name": req.prompt_version.prompt.name,
                "version_number": req.prompt_version.version_number,
                "model_name": req.prompt_version.model_name,
            })
        
        return RequestResponse(**request_data)
    
    async def create_request(self, data: RequestCreate) -> Request:
        """创建请求记录"""
        request_data = data.model_dump()
        db_request = Request(**request_data)
        async with get_db_session() as db:
            db.add(db_request)
            await db.commit()
        return db_request 