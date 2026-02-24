import json
from typing import Any, Dict, List

from fastapi import Depends, HTTPException, status
from sqlalchemy import case, select, delete, func, or_, desc, asc
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.dataset import Dataset, DatasetItem
from app.models.prompt import Prompt, PromptVersion, TestCase
from app.schemas.dataset import (
    DatasetCreate, DatasetItemCreate, DatasetItemUpdate, DatasetUpdate,
    DatasetItem as DatasetItemSchema, DataAnalysisRequest, DataAnalysisResponse
)
from app.schemas.pagination import PaginatedResponse
from app.services.base import CRUDBase
from app.models.user import Users

logger = get_logger(__name__)


class DatasetService:
    """数据集服务"""
    
    def __init__(self, db: AsyncSession = Depends(get_db)):
        """初始化"""
        self.db = db
        self.dataset_crud = CRUDBase(Dataset)
        self.item_crud = CRUDBase(DatasetItem)
    
    # 数据集相关方法
    
    async def create_dataset(self, data: DatasetCreate, user_id: int) -> Dataset:
        """创建数据集"""
        try:
            # 创建数据集对象
            db_dataset = Dataset(
                name=data.name,
                description=data.description,
                project_id=data.project_id,
                variables=data.variables,
                variable_descriptions=data.variable_descriptions,
                user_id=user_id,
            )
            
            # 添加到数据库
            self.db.add(db_dataset)
            await self.db.commit()
            await self.db.refresh(db_dataset)
            
            return db_dataset
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建数据集失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建数据集失败: {str(e)}",
            )
    
    async def get_dataset(self, dataset_id: int) -> Dataset:
        """获取数据集"""
        dataset = await self.dataset_crud.get(self.db, dataset_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="数据集未找到",
            )
        return dataset
    
    async def get_project_datasets(self, project_id: int) -> List[Dict[str, Any]]:
        """获取项目下的所有数据集"""
        result = await self.db.execute(
            select(Dataset, Users.nickname.label("creator_name"))
                   .outerjoin(Users, Dataset.user_id == Users.id)
                   .where(Dataset.project_id == project_id)
                   .order_by(Dataset.updated_at.desc())
        )
        return [dict(dataset.to_dict(), **{"creator_name": creator_name}) for dataset, creator_name in result.all()]
    
    async def update_dataset(self, dataset_id: int, data: DatasetUpdate) -> Dataset:
        """更新数据集"""
        # 获取现有数据集
        dataset = await self.get_dataset(dataset_id)
        
        try:
            # 更新数据集
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(dataset, key):
                    setattr(dataset, key, value)
            
            # 保存更改
            self.db.add(dataset)
            await self.db.commit()
            await self.db.refresh(dataset)
            
            return dataset
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新数据集失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新数据集失败: {str(e)}",
            )
    
    async def delete_dataset(self, dataset_id: int) -> None:
        """删除数据集"""
        # 获取现有数据集
        dataset = await self.get_dataset(dataset_id)
        
        try:
            # 删除数据集
            await self.db.delete(dataset)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除数据集失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除数据集失败: {str(e)}",
            )
    
    # 数据集项相关方法
    
    async def create_dataset_item(self, dataset_id: int, data: DatasetItemCreate) -> DatasetItem:
        """创建数据集项"""
        # 检查数据集是否存在
        await self.get_dataset(dataset_id)
        
        try:
            # 创建数据集项
            db_item = DatasetItem(
                dataset_id=dataset_id,
                name=data.name,
                variables_values=data.variables_values,
                expected_output=data.expected_output,
                is_enabled=data.is_enabled,
            )
            
            # 添加到数据库
            self.db.add(db_item)
            await self.db.commit()
            await self.db.refresh(db_item)
            
            return db_item
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建数据集项失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建数据集项失败: {str(e)}",
            )
    
    async def get_dataset_item(self, dataset_id: int, item_id: int) -> DatasetItem:
        """获取数据集项"""
        result = await self.db.execute(
            select(DatasetItem).where(
                DatasetItem.dataset_id == dataset_id,
                DatasetItem.id == item_id,
            )
        )
        item = result.scalar_one_or_none()
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="数据集项未找到",
            )
        
        return item
    
    async def get_dataset_items(
        self, 
        dataset_id: int, 
        enabled_only: bool = False,
        search: str = "",
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 20
    ) -> PaginatedResponse[DatasetItemSchema]:
        """获取数据集的所有项（支持搜索、排序、分页）"""
        base_query = select(DatasetItem).where(DatasetItem.dataset_id == dataset_id)
        
        # 过滤启用状态
        if enabled_only:
            base_query = base_query.where(DatasetItem.is_enabled == True)
        
        # 搜索功能
        if search:
            search_term = f"%{search}%"
            base_query = base_query.where(
                or_(
                    DatasetItem.name.ilike(search_term),
                    DatasetItem.expected_output.ilike(search_term),
                    func.json_extract(DatasetItem.variables_values, '$').ilike(search_term)
                )
            )
        
        # 获取总数 - 使用相同的过滤条件
        count_query = select(func.count(DatasetItem.id)).where(DatasetItem.dataset_id == dataset_id)
        
        # 应用相同的过滤条件
        if enabled_only:
            count_query = count_query.where(DatasetItem.is_enabled == True)
        
        if search:
            search_term = f"%{search}%"
            count_query = count_query.where(
                or_(
                    DatasetItem.name.ilike(search_term),
                    DatasetItem.expected_output.ilike(search_term),
                    func.json_extract(DatasetItem.variables_values, '$').ilike(search_term)
                )
            )
        
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()
        
        # 排序功能
        if hasattr(DatasetItem, sort_by):
            order_column = getattr(DatasetItem, sort_by)
            if sort_order.lower() == "desc":
                base_query = base_query.order_by(desc(order_column))
            else:
                base_query = base_query.order_by(asc(order_column))
        else:
            # 默认按创建时间倒序
            base_query = base_query.order_by(desc(DatasetItem.created_at))
        
        # 分页
        offset = (page - 1) * page_size
        query = base_query.offset(offset).limit(page_size)
        
        result = await self.db.execute(query)
        db_items = result.scalars().all()
        
        # 转换为 Pydantic 模型
        items = [DatasetItemSchema.model_validate(item) for item in db_items]
        
        return PaginatedResponse.create(
            data=items,
            total=total,
            page=page,
            page_size=page_size
        )
    
    async def update_dataset_item(
        self, dataset_id: int, item_id: int, data: DatasetItemUpdate
    ) -> DatasetItem:
        """更新数据集项"""
        # 获取现有数据集项
        item = await self.get_dataset_item(dataset_id, item_id)
        
        try:
            # 更新数据集项
            for key, value in data.model_dump(exclude_unset=True).items():
                if hasattr(item, key):
                    setattr(item, key, value)
            
            # 保存更改
            self.db.add(item)
            await self.db.commit()
            await self.db.refresh(item)
            
            return item
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"更新数据集项失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"更新数据集项失败: {str(e)}",
            )
    
    async def delete_dataset_item(self, dataset_id: int, item_id: int) -> None:
        """删除数据集项"""
        # 获取现有数据集项
        item = await self.get_dataset_item(dataset_id, item_id)
        
        try:
            # 删除数据集项
            await self.db.delete(item)
            await self.db.commit()
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"删除数据集项失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"删除数据集项失败: {str(e)}",
            )
    
    async def batch_create_items(
        self, dataset_id: int, items: List[DatasetItemCreate]
    ) -> List[DatasetItem]:
        """批量创建数据集项"""
        # 检查数据集是否存在
        await self.get_dataset(dataset_id)
        
        created_items = []
        try:
            # 创建所有数据集项
            for item_data in items:
                db_item = DatasetItem(
                    dataset_id=dataset_id,
                    name=item_data.name,
                    variables_values=item_data.variables_values,
                    expected_output=item_data.expected_output,
                    is_enabled=item_data.is_enabled,
                )
                self.db.add(db_item)
                created_items.append(db_item)
            
            # 提交事务
            await self.db.commit()
            
            # 刷新所有创建的项
            for item in created_items:
                await self.db.refresh(item)
            
            return created_items
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"批量创建数据集项失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"批量创建数据集项失败: {str(e)}",
            )

    async def batch_delete_dataset_items(self, dataset_id: int, item_ids: List[int]) -> int:
        """批量删除数据集条目"""
        try:
            # 执行批量删除
            result = await self.db.execute(
                delete(DatasetItem).where(
                    DatasetItem.dataset_id == dataset_id,
                    DatasetItem.id.in_(item_ids)
                )
            )
            
            await self.db.commit()
            
            # 返回删除的条目数量
            return result.rowcount
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"批量删除数据集条目失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"批量删除数据集条目失败: {str(e)}",
            )
            
    async def get_dataset_items_enabled_count(self, dataset_id: int) -> Dict[str, int]:
        """获取数据集启用和总条目数量"""
        logger.info(f"获取数据集启用和总条目数量: {dataset_id}")
        query = select(func.count(DatasetItem.id).label("total"), func.ifnull(func.sum(
            case(
                (DatasetItem.is_enabled == True, 1),  # 移除了列表括号
                else_=0
            )
        ), 0).label("enabled")).where(DatasetItem.dataset_id == dataset_id)
        result = await self.db.execute(query)
        return result.fetchone()._asdict()

    async def create_analysis_prompt(
        self, 
        dataset_id: int, 
        analysis_request: DataAnalysisRequest,
        user_id: int
    ) -> DataAnalysisResponse:
        """基于数据集创建数据分析提示词"""
        from app.services.base import CRUDBase
        import json
        import random
        
        # 获取数据集信息
        dataset = await self.get_dataset(dataset_id)
        
        # 生成提示词内容
        prompt_content = self._generate_analysis_prompt(dataset, analysis_request)
        
        try:
            # 创建新的提示词
            prompt_name = f"{dataset.name} - 数据分析"
            prompt_description = f"基于数据集 '{dataset.name}' 自动生成的数据分析提示词"
            
            new_prompt = Prompt(
                name=prompt_name,
                description=prompt_description,
                user_id=user_id,
                project_id=dataset.project_id,
                status='active',
                is_template=False
            )
            
            self.db.add(new_prompt)
            await self.db.commit()
            await self.db.refresh(new_prompt)
            
            # 从AI功能配置读取默认模型（使用prompt_assistant_chat作为基础能力）
            default_provider = "openai"
            default_model = "gpt-4.1"
            try:
                from app.models.ai_feature_config import AIFeatureConfig
                from sqlalchemy import and_
                cfg_result = await self.db.execute(
                    select(AIFeatureConfig).where(
                        and_(
                            AIFeatureConfig.project_id == dataset.project_id,
                            AIFeatureConfig.feature_key == "prompt_assistant_chat",
                        )
                    )
                )
                cfg = cfg_result.scalar_one_or_none()
                if cfg:
                    default_provider = cfg.provider
                    default_model = cfg.model_id
            except Exception:
                pass

            # 创建提示词版本
            prompt_version = PromptVersion(
                prompt_id=new_prompt.id,
                version_number=1,
                messages=prompt_content['messages'],
                variables=dataset.variables or [],
                model_name=default_model,
                model_params={"provider": default_provider, "model": default_model}
            )
            
            self.db.add(prompt_version)
            await self.db.commit()
            await self.db.refresh(prompt_version)
            
            # 获取数据集中的5条记录作为测试用例
            sample_items_query = select(DatasetItem).where(
                DatasetItem.dataset_id == dataset_id,
                DatasetItem.is_enabled == True
            ).limit(5)
            
            sample_result = await self.db.execute(sample_items_query)
            sample_items = sample_result.scalars().all()
            
            # 创建测试用例
            test_cases_count = 0
            for item in sample_items:
                if item.variables_values:
                    test_case = TestCase(
                        prompt_version_id=prompt_version.id,
                        name=item.name or f"测试用例 {test_cases_count + 1}",
                        variables_values=item.variables_values
                    )
                    self.db.add(test_case)
                    test_cases_count += 1
            
            await self.db.commit()
            
            return DataAnalysisResponse(
                prompt_id=new_prompt.id,
                prompt_name=prompt_name,
                test_cases_count=test_cases_count,
                message="数据分析提示词创建成功"
            )
            
        except SQLAlchemyError as e:
            await self.db.rollback()
            logger.error(f"创建数据分析提示词失败: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"创建数据分析提示词失败: {str(e)}",
            )
    
    def _generate_analysis_prompt(self, dataset: Dataset, analysis_request: DataAnalysisRequest) -> dict:
        """生成数据分析提示词内容"""
        # 构建变量描述文本
        variables_desc = ""
        if dataset.variables:
            variables_desc = "\n".join([f"- {var}" for var in dataset.variables])
            
            # 如果有字段描述，使用字段描述
            if dataset.variable_descriptions:
                variables_desc = "\n".join([
                    f"- {var}: {dataset.variable_descriptions.get(var, '无描述')}" 
                    for var in dataset.variables
                ])
        
        # 构建输出字段描述
        output_fields_desc = "\n".join([
            f"- {field['field_name']}: {field['description']}" 
            for field in analysis_request.output_fields
        ])
        
        # 构建JSON输出格式示例
        output_example = {field['field_name']: f"<{field['description']}>" for field in analysis_request.output_fields}
        
        # 生成system message
        system_message = f"""# 数据分析专家

你是一位专业的数据分析师，擅长从结构化数据中提取有价值的信息和洞察。

## 任务说明
你需要分析以下数据集中的记录，并根据用户的分析需求提取相应信息：

### 数据集信息
- **数据集名称**: {dataset.name}
- **数据集描述**: {dataset.description or '无描述'}

### 数据字段说明
{variables_desc}

### 分析目标
{analysis_request.analysis_description}

### 输出要求
请分析数据记录并输出以下字段信息：
{output_fields_desc}

## 输出格式
- 必须以JSON格式输出，不包含任何解释文字
- 严格按照以下格式输出：
{json.dumps(output_example, ensure_ascii=False, indent=2)}

## 约束条件
- 仅基于给定的数据进行分析，不要推测或添加不存在的信息
- 如果某个字段无法从数据中提取，返回null或"无"
- 输出必须是有效的JSON格式，符合RFC8259规范
- 不要输出```json```等markdown标记符号
"""

        # 生成user message模板，使用变量替换
        variables_placeholder = ""
        if dataset.variables:
            variables_placeholder = "\n".join([f"{var}: {{{{{var}}}}}" for var in dataset.variables])
        
        user_message = f"""请分析以下数据记录：

{variables_placeholder}

请根据系统提示中的要求，分析上述数据并输出JSON格式的结果。"""

        return {
            "messages": [
                {
                    "role": "system",
                    "content": system_message
                },
                {
                    "role": "user", 
                    "content": user_message
                }
            ]
        }