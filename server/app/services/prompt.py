import datetime
import json
from typing import Any, Dict, List, Optional, Union

from fastapi import Depends, HTTPException, status as status_code
from sqlalchemy import select, update, delete, func, and_, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.prompt import Prompt, PromptVersion, TestCase, Request, Tag, PromptFavorite
from app.schemas.prompt import (
    LLMRequest, ModelConfig, PromptCreate, PromptUpdate, PromptVersionCreate, 
    PromptVersionUpdate, TestCaseCreate, TestCaseUpdate, TagCreate, TagUpdate,
    Request as RequestSchema
)
from app.schemas.pagination import PaginatedResponse
from app.services.base import CRUDBase
from app.services.llm import LLMService
from app.models.user import Users

logger = get_logger(__name__)


class PromptService:
    """提示词服务"""
    
    def __init__(self, db: AsyncSession = Depends(get_db), llm_client: LLMService = Depends()):
        """初始化"""
        self.db = db
        self.prompt_crud = CRUDBase(Prompt)
        self.version_crud = CRUDBase(PromptVersion)
        self.testcase_crud = CRUDBase(TestCase)
        self.request_crud = CRUDBase(Request)
        self.tag_crud = CRUDBase(Tag)
        self.favorite_crud = CRUDBase(PromptFavorite)
        self.llm_client = llm_client

    # 提示词相关方法
    
    async def create_prompt(self, data: PromptCreate, user_id: int) -> Prompt:
        """创建提示词"""
        try:
            # 创建提示词对象
            db_prompt = Prompt(
                name=data.name,
                description=data.description,
                project_id=data.project_id,
                user_id=user_id,
                status=getattr(data, 'status', 'active'),
                is_template=getattr(data, 'is_template', False)
            )
            
            # 添加到数据库
            self.db.add(db_prompt)
            await self.db.flush()
            
            # 如果有标签，添加标签关联
            if hasattr(data, 'tag_ids') and data.tag_ids:
                # 获取带标签预加载的提示词对象
                prompt_with_tags = await self.get_prompt_with_tags(db_prompt.id)
                
                # 添加新标签
                for tag_id in data.tag_ids:
                    tag = await self.tag_crud.get(self.db, tag_id)
                    if tag:
                        prompt_with_tags.tags.append(tag)
                await self.db.flush()
                
                return prompt_with_tags
            else:
                # 即使没有标签，也返回预加载标签的对象避免序列化问题
                return await self.get_prompt_with_tags(db_prompt.id)
        except SQLAlchemyError as e:
            logger.error(f"创建提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建提示词失败: {str(e)}",
            )
    
    async def get_prompt(self, prompt_id: int) -> Prompt:
        """获取提示词"""
        prompt = await self.prompt_crud.get(self.db, prompt_id)
        if not prompt:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="提示词未找到",
            )
        return prompt
    
    async def get_prompt_with_tags(self, prompt_id: int) -> Prompt:
        """获取提示词（预加载标签关系）"""
        result = await self.db.execute(
            select(Prompt)
            .options(joinedload(Prompt.tags))
            .where(Prompt.id == prompt_id)
        )
        prompt = result.unique().scalar_one_or_none()
        if not prompt:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="提示词未找到",
            )
        return prompt
    
    async def get_project_prompts(self, project_id: int) -> List[Dict[str, Any]]:
        """获取项目下的所有提示词"""
        result = await self.db.execute(
            select(Prompt, Users.nickname).join(Users, Prompt.user_id == Users.id).where(Prompt.project_id == project_id)
        )
        return [dict(prompt.to_dict(), **{"nickname": nickname}) for prompt, nickname in result.all()]
    
    async def get_project_prompts_filtered(
        self, 
        project_id: int, 
        search: Optional[str] = None,
        tags: Optional[List[int]] = None,
        status: Optional[str] = None,
        creator: Optional[str] = None,
        favorites_only: Optional[bool] = None,
        is_template: Optional[bool] = None,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
        user_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """获取项目下的筛选提示词"""
        try:
            # 构建基础查询
            query = select(
                Prompt,
                Users.nickname,
                func.coalesce(PromptFavorite.user_id.isnot(None), False).label('is_favorited')
            ).outerjoin(
                Users, Prompt.user_id == Users.id
            ).outerjoin(
                PromptFavorite, 
                and_(PromptFavorite.prompt_id == Prompt.id, PromptFavorite.user_id == user_id)
            ).options(
                selectinload(Prompt.tags)
            ).where(
                Prompt.project_id == project_id
            )
            
            # 添加筛选条件
            if search:
                search_pattern = f"%{search}%"
                query = query.where(
                    or_(
                        Prompt.name.ilike(search_pattern),
                        Prompt.description.ilike(search_pattern)
                    )
                )
            
            if tags:
                # 使用子查询来筛选包含指定标签的提示词
                tag_subquery = select(Prompt.id).join(
                    Prompt.tags
                ).where(Tag.id.in_(tags)).group_by(Prompt.id)
                query = query.where(Prompt.id.in_(tag_subquery))
            
            if status and status != 'all':
                query = query.where(Prompt.status == status)
            
            if creator and creator != 'all':
                if creator == 'mine' and user_id:
                    query = query.where(Prompt.user_id == user_id)
                elif creator == 'others' and user_id:
                    query = query.where(Prompt.user_id != user_id)
            
            if favorites_only and user_id:
                query = query.where(PromptFavorite.user_id == user_id)
            
            if is_template is not None:
                query = query.where(Prompt.is_template == is_template)
            
            # 排序
            if sort_order == "desc":
                if sort_by == "name":
                    query = query.order_by(Prompt.name.desc())
                elif sort_by == "created_at":
                    query = query.order_by(Prompt.created_at.desc())
                else:  # updated_at
                    query = query.order_by(Prompt.updated_at.desc())
            else:
                if sort_by == "name":
                    query = query.order_by(Prompt.name.asc())
                elif sort_by == "created_at":
                    query = query.order_by(Prompt.created_at.asc())
                else:  # updated_at
                    query = query.order_by(Prompt.updated_at.asc())
            
            # 执行查询
            result = await self.db.execute(query)
            rows = result.all()
            
            # 加载提示词的标签
            prompts_data = []
            for prompt, nickname, is_favorited in rows:
                # 加载标签
                tags = prompt.tags
                
                prompt_dict = prompt.to_dict()
                prompt_dict.update({
                    "nickname": nickname,
                    "is_favorited": bool(is_favorited),
                    "tags": [tag.to_dict() for tag in tags]
                })
                prompts_data.append(prompt_dict)
            
            # 计算分页
            total = len(prompts_data)
            start = (page - 1) * page_size
            end = start + page_size
            paginated_data = prompts_data[start:end]
            
            # 使用 PaginatedResponse 创建响应
            return PaginatedResponse.create(
                data=paginated_data,
                total=total,
                page=page,
                page_size=page_size
            )
            
        except SQLAlchemyError as e:
            logger.error(f"获取筛选提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取筛选提示词失败: {str(e)}",
            )
    
    async def update_prompt(self, prompt_id: int, data: PromptUpdate, user_id: int) -> Prompt:
        """更新提示词"""
        try:
            # 始终获取带标签的提示词，避免懒加载问题
            prompt = await self.get_prompt_with_tags(prompt_id)
            
            # 更新标签关联（如果有）
            if hasattr(data, 'tag_ids') and data.tag_ids is not None:
                # 清除现有标签关联
                prompt.tags.clear()
                
                # 添加新标签
                for tag_id in data.tag_ids:
                    tag = await self.tag_crud.get(self.db, tag_id)
                    if tag:
                        prompt.tags.append(tag)
            
            # 更新提示词基本信息
            update_data = data.model_dump(exclude_unset=True, exclude={'tag_ids'})
            for key, value in update_data.items():
                if hasattr(prompt, key):
                    setattr(prompt, key, value)
            
            # 保存更改
            self.db.add(prompt)
            await self.db.commit()
            await self.db.refresh(prompt)

            # 补充is_favorited字段
            result = await self.db.execute(
                select(PromptFavorite).where(PromptFavorite.prompt_id == prompt_id, PromptFavorite.user_id == user_id)
            )
            prompt.is_favorited = result.scalar_one_or_none() is not None
            
            return prompt
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新提示词失败: {str(e)}",
            )
    
    async def delete_prompt(self, prompt_id: int) -> None:
        """删除提示词"""
        # 获取现有提示词
        prompt = await self.get_prompt(prompt_id)
        
        try:
            # 删除提示词
            await self.db.delete(prompt)
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除提示词失败: {str(e)}",
            )
    
    async def duplicate_prompt(self, prompt_id: int, user_id: int, 
                               custom_name: Optional[str] = None,
                               custom_description: Optional[str] = None, 
                               custom_tag_ids: Optional[List[int]] = None) -> Prompt:
        """复制提示词"""
        try:
            # 获取原提示词及其标签
            original_prompt = await self.get_prompt_with_tags(prompt_id)
            
            # 使用自定义内容或默认内容
            new_prompt_name = custom_name if custom_name is not None else f"{original_prompt.name} (副本)"
            new_prompt_description = custom_description if custom_description is not None else original_prompt.description
            
            # 创建新的提示词
            new_prompt = Prompt(
                name=new_prompt_name,
                description=new_prompt_description,
                project_id=original_prompt.project_id,
                user_id=user_id,
                status=original_prompt.status,
                is_template=original_prompt.is_template
            )
            
            self.db.add(new_prompt)
            await self.db.flush()
            
            # 处理标签关联
            if custom_tag_ids is not None:
                # 使用自定义标签
                if custom_tag_ids:
                    new_prompt_with_tags = await self.get_prompt_with_tags(new_prompt.id)
                    for tag_id in custom_tag_ids:
                        tag = await self.tag_crud.get(self.db, tag_id)
                        if tag:
                            new_prompt_with_tags.tags.append(tag)
                    await self.db.flush()
            else:
                # 复制原标签
                if original_prompt.tags:
                    new_prompt_with_tags = await self.get_prompt_with_tags(new_prompt.id)
                    for tag in original_prompt.tags:
                        new_prompt_with_tags.tags.append(tag)
                    await self.db.flush()
            
            # 获取原提示词的最新版本
            latest_version = await self.get_prompt_latest_version(prompt_id)
            if latest_version:
                # 创建新版本
                new_version = PromptVersion(
                    prompt_id=new_prompt.id,
                    version_number=1,
                    messages=latest_version.messages,
                    variables=latest_version.variables,
                    model_name=latest_version.model_name,
                    model_params=latest_version.model_params
                )
                
                self.db.add(new_version)
                await self.db.flush()
                
                # 复制测试用例
                test_cases = await self.get_version_test_cases(latest_version.id)
                for test_case in test_cases:
                    new_test_case = TestCase(
                        prompt_version_id=new_version.id,
                        name=test_case.name,
                        variables_values=test_case.variables_values,
                        metadatas=test_case.metadatas
                    )
                    self.db.add(new_test_case)
                        
            # 返回带标签的新提示词
            return await self.get_prompt_with_tags(new_prompt.id)
            
        except SQLAlchemyError as e:
            logger.error(f"复制提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"复制提示词失败: {str(e)}",
            )
    
    # 提示词版本相关方法
    
    async def get_prompt_latest_version(self, prompt_id: int) -> Optional[PromptVersion]:
        """获取提示词的最新版本"""
        result = await self.db.execute(
            select(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .order_by(PromptVersion.version_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
    
    async def create_prompt_version(self, data: PromptVersionCreate) -> PromptVersion:
        """创建提示词版本"""
        # 获取提示词
        prompt = await self.get_prompt(data.prompt_id)
        prompt.updated_at = datetime.datetime.now()
        self.db.add(prompt)
        await self.db.flush()
        
        # 获取最新版本号
        latest_version = await self.get_prompt_latest_version(data.prompt_id)
        version_number = (latest_version.version_number + 1) if latest_version else 1
        
        try:
            # 创建提示词版本
            db_version = PromptVersion(
                prompt_id=data.prompt_id,
                messages=data.messages,
                variables=data.variables,
                model_name=data.model_name,
                model_params=data.model_params,
                version_number=version_number,
            )
            
            # 添加到数据库
            self.db.add(db_version)
            await self.db.flush()
            
            return db_version
        except SQLAlchemyError as e:
            logger.error(f"创建提示词版本失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建提示词版本失败: {str(e)}",
            )
    
    async def get_prompt_version(self, version_id: int) -> PromptVersion:
        """获取提示词版本"""
        version = await self.version_crud.get(self.db, version_id)
        if not version:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="提示词版本未找到",
            )
        return version
    
    async def get_prompt_versions(self, prompt_id: int) -> List[PromptVersion]:
        """获取提示词的所有版本"""
        result = await self.db.execute(
            select(PromptVersion)
            .where(PromptVersion.prompt_id == prompt_id)
            .order_by(PromptVersion.version_number.desc())
        )
        return result.scalars().all()
    
    async def update_prompt_version(
        self, version_id: int, data: PromptVersionUpdate
    ) -> PromptVersion:
        """更新提示词版本"""
        # 获取现有提示词版本
        version = await self.get_prompt_version(version_id)
        
        try:
            # 更新提示词版本
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(version, key):
                    setattr(version, key, value)
            
            # 保存更改
            self.db.add(version)
            await self.db.commit()
            await self.db.refresh(version)
            
            return version
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新提示词版本失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新提示词版本失败: {str(e)}",
            )
    
    async def get_latest_version(self, prompt_id: int) -> PromptVersion:
        """获取最新的版本"""
        result = await self.db.execute(
            select(PromptVersion).where(PromptVersion.prompt_id == prompt_id).order_by(PromptVersion.version_number.desc()).limit(1)
        )
        return result.scalar_one_or_none()
    
    # 测试用例相关方法
    
    async def create_test_case(self, data: TestCaseCreate) -> TestCase:
        """创建测试用例"""
        # 检查提示词版本是否存在
        await self.get_prompt_version(data.prompt_version_id)
        
        try:
            # 创建测试用例
            db_test_case = TestCase(
                prompt_version_id=data.prompt_version_id,
                name=data.name,
                variables_values=data.variables_values,
                metadatas=data.metadatas,
            )
            
            # 添加到数据库
            self.db.add(db_test_case)
            await self.db.commit()
            await self.db.refresh(db_test_case)
            
            return db_test_case
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建测试用例失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建测试用例失败: {str(e)}",
            )
    
    async def get_test_case(self, test_case_id: int) -> TestCase:
        """获取测试用例"""
        test_case = await self.testcase_crud.get(self.db, test_case_id)
        if not test_case:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="测试用例未找到",
            )
        return test_case
    
    async def get_version_test_cases(self, version_id: int) -> List[TestCase]:
        """获取版本的所有测试用例"""
        result = await self.db.execute(
            select(TestCase).where(TestCase.prompt_version_id == version_id)
        )
        return result.scalars().all()
    
    async def update_test_case(
        self, test_case_id: int, data: TestCaseUpdate
    ) -> TestCase:
        """更新测试用例"""
        # 获取现有测试用例
        test_case = await self.get_test_case(test_case_id)
        
        try:
            # 更新测试用例
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(test_case, key):
                    setattr(test_case, key, value)
            
            # 保存更改
            self.db.add(test_case)
            await self.db.commit()
            await self.db.refresh(test_case)
            
            return test_case
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新测试用例失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新测试用例失败: {str(e)}",
            )
    
    async def delete_test_case(self, test_case_id: int) -> None:
        """删除测试用例"""
        # 获取现有测试用例
        test_case = await self.get_test_case(test_case_id)
        
        try:
            # 删除测试用例
            await self.db.delete(test_case)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除测试用例失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除测试用例失败: {str(e)}",
            )
    
    # 请求记录相关方法
    
    async def get_version_requests(self, version_id: int) -> List[Request]:
        """获取版本的所有请求记录"""
        result = await self.db.execute(
            select(Request)
            .where(Request.prompt_version_id == version_id)
            .order_by(Request.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_prompt_history(self, prompt_id: int, page: int = 1, page_size: int = 10, source: Optional[str] = None) -> PaginatedResponse[RequestSchema]:
        """获取提示词的历史请求记录（分页）"""
        try:
            # 构建查询条件
            query = select(Request).where(Request.prompt_id == prompt_id)
            
            # 添加source筛选
            if source:
                query = query.where(Request.source == source)
            
            # 计算总数
            count_query = select(func.count(Request.id)).where(Request.prompt_id == prompt_id)
            if source:
                count_query = count_query.where(Request.source == source)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()
            
            # 分页查询
            offset = (page - 1) * page_size
            query = query.order_by(Request.created_at.desc()).offset(offset).limit(page_size)
            
            result = await self.db.execute(query)
            items = result.scalars().all()
            
            # 将ORM对象转换为schema对象
            schema_items = [RequestSchema.model_validate(item) for item in items]
            
            return PaginatedResponse.create(
                data=schema_items,
                total=total,
                page=page,
                page_size=page_size
            )
            
        except SQLAlchemyError as e:
            logger.error(f"获取提示词历史记录失败: {str(e)}")
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取历史记录失败: {str(e)}",
            ) 

    # 标签相关方法
    
    async def create_tag(self, data: TagCreate) -> Tag:
        """创建标签"""
        try:
            db_tag = Tag(
                name=data.name,
                color=data.color,
                project_id=data.project_id
            )
            
            self.db.add(db_tag)
            await self.db.commit()
            await self.db.refresh(db_tag)
            
            return db_tag
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建标签失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建标签失败: {str(e)}",
            )
    
    async def get_project_tags(self, project_id: int) -> List[Tag]:
        """获取项目的所有标签"""
        result = await self.db.execute(
            select(Tag).where(Tag.project_id == project_id).order_by(Tag.name)
        )
        return result.scalars().all()
    
    async def update_tag(self, tag_id: int, data: TagUpdate) -> Tag:
        """更新标签"""
        tag = await self.tag_crud.get(self.db, tag_id)
        if not tag:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="标签未找到",
            )
        
        try:
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(tag, key):
                    setattr(tag, key, value)
            
            self.db.add(tag)
            await self.db.commit()
            await self.db.refresh(tag)
            
            return tag
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新标签失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新标签失败: {str(e)}",
            )
    
    async def delete_tag(self, tag_id: int) -> None:
        """删除标签"""
        tag = await self.tag_crud.get(self.db, tag_id)
        if not tag:
            raise HTTPException(
                status_code=status_code.HTTP_404_NOT_FOUND,
                detail="标签未找到",
            )
        
        try:
            await self.db.delete(tag)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除标签失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除标签失败: {str(e)}",
            )

    # 收藏相关方法
    
    async def toggle_favorite(self, prompt_id: int, user_id: int) -> Dict[str, Any]:
        """切换收藏状态"""
        # 检查提示词是否存在
        prompt = await self.get_prompt(prompt_id)
        
        try:
            # 查找现有收藏记录
            result = await self.db.execute(
                select(PromptFavorite).where(
                    and_(
                        PromptFavorite.prompt_id == prompt_id,
                        PromptFavorite.user_id == user_id
                    )
                )
            )
            favorite = result.scalar_one_or_none()
            
            if favorite:
                # 如果已收藏，则取消收藏
                await self.db.delete(favorite)
                is_favorited = False
            else:
                # 如果未收藏，则添加收藏
                favorite = PromptFavorite(
                    prompt_id=prompt_id,
                    user_id=user_id
                )
                self.db.add(favorite)
                is_favorited = True
            
            await self.db.commit()
            
            return {"is_favorited": is_favorited}
            
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"切换收藏状态失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"切换收藏状态失败: {str(e)}",
            )

    # 批量操作方法
    
    async def batch_operation(
        self, 
        prompt_ids: List[int], 
        action: str, 
        tag_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """批量操作提示词"""
        try:
            if action == "delete":
                # 批量删除
                await self.db.execute(
                    delete(Prompt).where(Prompt.id.in_(prompt_ids))
                )
            elif action == "archive":
                # 批量归档
                await self.db.execute(
                    update(Prompt).where(Prompt.id.in_(prompt_ids)).values(status="archived")
                )
            elif action == "unarchive":
                # 批量取消归档
                await self.db.execute(
                    update(Prompt).where(Prompt.id.in_(prompt_ids)).values(status="active")
                )
            elif action == "favorite" and user_id:
                # 批量收藏
                for prompt_id in prompt_ids:
                    # 检查是否已收藏
                    result = await self.db.execute(
                        select(PromptFavorite).where(
                            and_(
                                PromptFavorite.prompt_id == prompt_id,
                                PromptFavorite.user_id == user_id
                            )
                        )
                    )
                    if not result.scalar_one_or_none():
                        favorite = PromptFavorite(
                            prompt_id=prompt_id,
                            user_id=user_id
                        )
                        self.db.add(favorite)
            elif action == "add_tag" and tag_id:
                # 批量添加标签
                tag = await self.tag_crud.get(self.db, tag_id)
                if not tag:
                    raise HTTPException(status_code=404, detail="标签未找到")
                
                for prompt_id in prompt_ids:
                    prompt = await self.get_prompt_with_tags(prompt_id)
                    if tag not in prompt.tags:
                        prompt.tags.append(tag)
            elif action == "remove_tag" and tag_id:
                # 批量移除标签
                tag = await self.tag_crud.get(self.db, tag_id)
                if not tag:
                    raise HTTPException(status_code=404, detail="标签未找到")
                
                for prompt_id in prompt_ids:
                    prompt = await self.get_prompt_with_tags(prompt_id)
                    if tag in prompt.tags:
                        prompt.tags.remove(tag)
            else:
                raise HTTPException(status_code=400, detail="不支持的操作")
            
            await self.db.commit()
            
            return {"success": True, "message": f"批量{action}操作完成"}
            
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"批量操作失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"批量操作失败: {str(e)}",
            )

    # 统计方法
    
    async def get_prompt_stats(self, project_id: int, user_id: Optional[int] = None) -> Dict[str, int]:
        """获取提示词统计信息"""
        try:
            # 总数统计
            total_result = await self.db.execute(
                select(func.count(Prompt.id)).where(Prompt.project_id == project_id)
            )
            total = total_result.scalar()
            
            # 我的提示词统计
            my_result = await self.db.execute(
                select(func.count(Prompt.id)).where(
                    and_(Prompt.project_id == project_id, Prompt.user_id == user_id)
                )
            ) if user_id else None
            my_count = my_result.scalar() if my_result else 0
            
            # 收藏统计
            favorites_result = await self.db.execute(
                select(func.count(PromptFavorite.id)).join(
                    Prompt, PromptFavorite.prompt_id == Prompt.id
                ).where(
                    and_(Prompt.project_id == project_id, PromptFavorite.user_id == user_id)
                )
            ) if user_id else None
            favorites_count = favorites_result.scalar() if favorites_result else 0
            
            # 模板统计
            templates_result = await self.db.execute(
                select(func.count(Prompt.id)).where(
                    and_(Prompt.project_id == project_id, Prompt.is_template == True)
                )
            )
            templates_count = templates_result.scalar()
            
            return {
                "total": total,
                "my_count": my_count,
                "favorites_count": favorites_count,
                "templates_count": templates_count
            }
            
        except SQLAlchemyError as e:
            logger.error(f"获取统计信息失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status_code.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"获取统计信息失败: {str(e)}",
            )