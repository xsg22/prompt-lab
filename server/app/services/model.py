import time
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from app.models.provider_instance import ModelProviderInstance
from app.models.project_model import ProjectModel
from app.schemas.model import (
    ProviderDefinition, ProviderInstanceCreate, ProviderInstanceUpdate, 
    CustomModelCreate, CustomModelUpdate, CustomModelResponse,
    AvailableModel, TestConnectionResponse,
    ConnectionStatus, ModelCallConfig
)
from app.config.provider_definitions import (
    get_all_provider_definitions, get_provider_definition
)
from app.core.logging import get_logger
from app.db.session import get_db

logger = get_logger(__name__)


class ModelService:
    """模型服务类"""

    def __init__(self, db: AsyncSession = Depends(get_db)):
        self.db = db

    # ================= 提供商定义相关方法 =================

    async def get_provider_definitions(self) -> Dict[str, ProviderDefinition]:
        """获取所有提供商定义"""
        return get_all_provider_definitions()

    async def get_provider_definition(self, provider_type: str) -> ProviderDefinition:
        """获取指定提供商定义"""
        definition = get_provider_definition(provider_type)
        if not definition:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"未找到提供商定义: {provider_type}"
            )
        return definition

    # ================= 提供商实例相关方法 =================

    async def get_model_provider_instances(self, project_id: int) -> List[ModelProviderInstance]:
        """获取项目的提供商实例列表"""
        query = select(ModelProviderInstance).where(
            ModelProviderInstance.project_id == project_id
        ).order_by(ModelProviderInstance.created_at.desc())
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_provider_instance(self, project_id: int, instance_id: int) -> ModelProviderInstance:
        """获取指定的提供商实例"""
        query = select(ModelProviderInstance).where(
            and_(
                ModelProviderInstance.id == instance_id,
                ModelProviderInstance.project_id == project_id
            )
        )
        
        result = await self.db.execute(query)
        instance = result.scalar_one_or_none()
        
        if not instance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="提供商实例不存在"
            )
        
        return instance

    async def create_model_provider_instance(
        self, 
        project_id: int, 
        data: ProviderInstanceCreate
    ) -> ModelProviderInstance:
        """创建提供商实例"""
        # 验证提供商类型
        provider_def = get_provider_definition(data.provider_type)
        if not provider_def:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的提供商类型: {data.provider_type}"
            )

        # 验证配置字段
        await self._validate_provider_config(data.provider_type, data.config)

        # 检查同一项目下是否已存在同名实例
        existing = await self._check_instance_name_exists(project_id, data.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="实例名称已存在"
            )

        # 创建实例
        instance = ModelProviderInstance(
            name=data.name,
            provider_type=data.provider_type,
            project_id=project_id,
            config=data.config,
            enabled_models=data.enabled_models,
            connection_status=ConnectionStatus.UNKNOWN.value
        )
        
        self.db.add(instance)
        await self.db.commit()
        await self.db.refresh(instance)
        
        logger.info(f"创建提供商实例: {instance.name} (ID: {instance.id})")
        return instance

    async def update_model_provider_instance(
        self, 
        project_id: int, 
        instance_id: int, 
        data: ProviderInstanceUpdate
    ) -> ModelProviderInstance:
        """更新提供商实例"""
        instance = await self.get_provider_instance(project_id, instance_id)
        
        # 更新字段
        if data.name is not None:
            # 检查新名称是否已存在
            if data.name != instance.name:
                existing = await self._check_instance_name_exists(project_id, data.name, instance_id)
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="实例名称已存在"
                    )
            instance.name = data.name

        if data.config is not None:
            # 验证新配置
            await self._validate_provider_config(instance.provider_type, data.config)
            instance.config = data.config
            instance.connection_status = ConnectionStatus.UNKNOWN.value  # 重置连接状态

        if data.is_enabled is not None:
            instance.is_enabled = data.is_enabled

        if data.enabled_models is not None:
            instance.enabled_models = data.enabled_models

        await self.db.commit()
        await self.db.refresh(instance)
        
        logger.info(f"更新提供商实例: {instance.name} (ID: {instance.id})")
        return instance

    async def delete_provider_instance(self, project_id: int, instance_id: int) -> None:
        """删除提供商实例"""
        instance = await self.get_provider_instance(project_id, instance_id)
        
        # 检查是否有关联的自定义模型
        custom_models = instance.custom_models or []
        
        if custom_models:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无法删除该提供商实例，还有 {len(custom_models)} 个自定义模型正在使用"
            )

        await self.db.delete(instance)
        await self.db.commit()
        
        logger.info(f"删除提供商实例: {instance.name} (ID: {instance.id})")

    async def test_provider_connection(
        self, 
        project_id: int, 
        instance_id: int
    ) -> TestConnectionResponse:
        """测试提供商实例连接"""
        instance = await self.get_provider_instance(project_id, instance_id)
        
        start_time = time.time()
        try:
            # 这里应该调用实际的测试连接逻辑
            # 为了简化，这里模拟测试过程
            success = await self._test_provider_connection_impl(
                instance.provider_type, 
                instance.config
            )
            
            latency = (time.time() - start_time) * 1000  # 转换为毫秒
            
            if success:
                # 更新连接状态
                instance.connection_status = ConnectionStatus.CONNECTED.value
                instance.error_message = None
                instance.last_tested_at = time.time()
                
                response = TestConnectionResponse(
                    success=True,
                    message="连接测试成功",
                    latency=latency
                )
            else:
                instance.connection_status = ConnectionStatus.FAILED.value
                instance.error_message = "连接测试失败"
                
                response = TestConnectionResponse(
                    success=False,
                    message="连接测试失败",
                    latency=latency,
                    error_details="无法连接到API端点"
                )
            
            await self.db.commit()
            return response
            
        except Exception as e:
            latency = (time.time() - start_time) * 1000
            
            # 更新连接状态
            instance.connection_status = ConnectionStatus.FAILED.value
            instance.error_message = str(e)
            await self.db.commit()
            
            return TestConnectionResponse(
                success=False,
                message="连接测试失败",
                latency=latency,
                error_details=str(e)
            )

    # ================= 自定义模型相关方法 =================

    async def get_custom_models(self, project_id: int) -> List[CustomModelResponse]:
        """获取项目的自定义模型列表"""
        # 获取项目的所有提供商实例
        instances = await self.get_model_provider_instances(project_id)
        
        custom_models = []
        for instance in instances:
            if instance.custom_models:
                for model_data in instance.custom_models:
                    # 构造完整的自定义模型响应
                    model = CustomModelResponse(
                        id=model_data["id"],
                        name=model_data["name"],
                        model_id=model_data["model_id"],
                        description=model_data.get("description"),
                        context_window=model_data.get("context_window"),
                        input_cost_per_token=model_data.get("input_cost_per_token"),
                        output_cost_per_token=model_data.get("output_cost_per_token"),
                        supports_streaming=model_data.get("supports_streaming", True),
                        supports_tools=model_data.get("supports_tools", False),
                        supports_vision=model_data.get("supports_vision", False),
                        config=model_data.get("config", {}),
                        is_enabled=model_data.get("is_enabled", True),
                        provider_instance_id=instance.id,
                        project_id=project_id,
                        created_at=datetime.fromisoformat(model_data["created_at"]) if model_data.get("created_at") else datetime.now(),
                        updated_at=datetime.fromisoformat(model_data["updated_at"]) if model_data.get("updated_at") else datetime.now()
                    )
                    custom_models.append(model)
        
        # 按创建时间倒序排列
        custom_models.sort(key=lambda x: x.created_at, reverse=True)
        return custom_models

    async def get_custom_model(self, project_id: int, model_id: int) -> CustomModelResponse:
        """获取指定的自定义模型"""
        # 获取项目的所有提供商实例
        instances = await self.get_model_provider_instances(project_id)
        
        for instance in instances:
            if instance.custom_models:
                for model_data in instance.custom_models:
                    if model_data["id"] == model_id:
                        # 找到了对应的模型，构造响应
                        return CustomModelResponse(
                            id=model_data["id"],
                            name=model_data["name"],
                            model_id=model_data["model_id"],
                            description=model_data.get("description"),
                            context_window=model_data.get("context_window"),
                            input_cost_per_token=model_data.get("input_cost_per_token"),
                            output_cost_per_token=model_data.get("output_cost_per_token"),
                            supports_streaming=model_data.get("supports_streaming", True),
                            supports_tools=model_data.get("supports_tools", False),
                            supports_vision=model_data.get("supports_vision", False),
                            config=model_data.get("config", {}),
                            is_enabled=model_data.get("is_enabled", True),
                            provider_instance_id=instance.id,
                            project_id=project_id,
                            created_at=datetime.fromisoformat(model_data["created_at"]) if model_data.get("created_at") else datetime.now(),
                            updated_at=datetime.fromisoformat(model_data["updated_at"]) if model_data.get("updated_at") else datetime.now()
                        )
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="自定义模型不存在"
        )

    async def create_custom_model(
        self, 
        project_id: int, 
        data: CustomModelCreate
    ) -> CustomModelResponse:
        """创建自定义模型"""
        # 验证提供商实例存在
        provider_instance = await self.get_provider_instance(project_id, data.provider_instance_id)
        
        # 检查模型名称是否已存在
        existing_models = await self.get_custom_models(project_id)
        if any(model.name == data.name for model in existing_models):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模型名称已存在"
            )

        # 生成新的模型ID
        custom_models = provider_instance.custom_models or []
        new_model_id = max([model.get("id", 0) for model in custom_models], default=0) + 1
        
        # 创建新的模型数据
        now = datetime.now()
        new_model_data = {
            "id": new_model_id,
            "name": data.name,
            "model_id": data.model_id,
            "description": data.description,
            "context_window": data.context_window,
            "max_tokens": data.max_tokens,
            "input_cost_per_token": data.input_cost_per_token,
            "output_cost_per_token": data.output_cost_per_token,
            "supports_streaming": data.supports_streaming,
            "supports_tools": data.supports_tools,
            "supports_vision": data.supports_vision,
            "config": data.config,
            "is_enabled": True,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        
        # 添加到provider_instance的custom_models列表
        custom_models.append(new_model_data)
        provider_instance.custom_models = custom_models
        
        # 告诉SQLAlchemy这个JSON字段已被修改，确保更改能保存到数据库
        attributes.flag_modified(provider_instance, "custom_models")
        
        await self.db.commit()
        await self.db.refresh(provider_instance)
        
        logger.info(f"创建自定义模型: {data.name} (ID: {new_model_id})")
        
        # 返回完整的模型响应
        return CustomModelResponse(
            id=new_model_id,
            name=data.name,
            model_id=data.model_id,
            description=data.description,
            context_window=data.context_window,
            max_tokens=data.max_tokens,
            input_cost_per_token=data.input_cost_per_token,
            output_cost_per_token=data.output_cost_per_token,
            supports_streaming=data.supports_streaming,
            supports_tools=data.supports_tools,
            supports_vision=data.supports_vision,
            config=data.config,
            is_enabled=True,
            provider_instance_id=provider_instance.id,
            project_id=project_id,
            created_at=now,
            updated_at=now
        )

    async def update_custom_model(
        self, 
        project_id: int, 
        model_id: int, 
        data: CustomModelUpdate
    ) -> CustomModelResponse:
        """更新自定义模型"""
        # 找到包含该模型的provider_instance
        instances = await self.get_model_provider_instances(project_id)
        provider_instance = None
        model_index = None
        
        for instance in instances:
            if instance.custom_models:
                for i, model_data in enumerate(instance.custom_models):
                    if model_data["id"] == model_id:
                        provider_instance = instance
                        model_index = i
                        break
                if provider_instance:
                    break
        
        if not provider_instance or model_index is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="自定义模型不存在"
            )
        
        # 检查模型名称是否已存在（排除当前模型）
        if data.name is not None:
            existing_models = await self.get_custom_models(project_id)
            for model in existing_models:
                if model.name == data.name and model.id != model_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="模型名称已存在"
                    )
        
        # 更新模型数据
        custom_models = provider_instance.custom_models
        model_data = custom_models[model_index]
        
        if data.name is not None:
            model_data["name"] = data.name
        if data.description is not None:
            model_data["description"] = data.description
        if data.context_window is not None:
            model_data["context_window"] = data.context_window
        if data.max_tokens is not None:
            model_data["max_tokens"] = data.max_tokens
        if data.input_cost_per_token is not None:
            model_data["input_cost_per_token"] = data.input_cost_per_token
        if data.output_cost_per_token is not None:
            model_data["output_cost_per_token"] = data.output_cost_per_token
        if data.supports_streaming is not None:
            model_data["supports_streaming"] = data.supports_streaming
        if data.supports_tools is not None:
            model_data["supports_tools"] = data.supports_tools
        if data.supports_vision is not None:
            model_data["supports_vision"] = data.supports_vision
        if data.config is not None:
            model_data["config"] = data.config
        if data.is_enabled is not None:
            model_data["is_enabled"] = data.is_enabled
        
        model_data["updated_at"] = datetime.now().isoformat()
        
        # 更新provider_instance
        custom_models[model_index] = model_data
        provider_instance.custom_models = custom_models
        
        # 告诉SQLAlchemy这个JSON字段已被修改，确保更改能保存到数据库
        attributes.flag_modified(provider_instance, "custom_models")
        
        await self.db.commit()
        await self.db.refresh(provider_instance)
        
        logger.info(f"更新自定义模型: {model_data['name']} (ID: {model_id})")
        
        # 返回更新后的模型
        return CustomModelResponse(
            id=model_data["id"],
            name=model_data["name"],
            model_id=model_data["model_id"],
            description=model_data.get("description"),
            context_window=model_data.get("context_window"),
            max_tokens=model_data.get("max_tokens"),
            input_cost_per_token=model_data.get("input_cost_per_token"),
            output_cost_per_token=model_data.get("output_cost_per_token"),
            supports_streaming=model_data.get("supports_streaming", True),
            supports_tools=model_data.get("supports_tools", False),
            supports_vision=model_data.get("supports_vision", False),
            config=model_data.get("config", {}),
            is_enabled=model_data.get("is_enabled", True),
            provider_instance_id=provider_instance.id,
            project_id=project_id,
            created_at=datetime.fromisoformat(model_data["created_at"]) if model_data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(model_data["updated_at"]) if model_data.get("updated_at") else datetime.now()
        )

    async def delete_custom_model(self, project_id: int, model_id: int) -> None:
        """删除自定义模型"""
        # 找到包含该模型的provider_instance
        instances = await self.get_model_provider_instances(project_id)
        provider_instance = None
        model_index = None
        model_name = None
        
        for instance in instances:
            if instance.custom_models:
                for i, model_data in enumerate(instance.custom_models):
                    if model_data["id"] == model_id:
                        provider_instance = instance
                        model_index = i
                        model_name = model_data["name"]
                        break
                if provider_instance:
                    break
        
        if not provider_instance or model_index is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="自定义模型不存在"
            )
        
        # 从custom_models列表中删除该模型
        custom_models = provider_instance.custom_models
        custom_models.pop(model_index)
        provider_instance.custom_models = custom_models
        
        # 告诉SQLAlchemy这个JSON字段已被修改，确保更改能保存到数据库
        attributes.flag_modified(provider_instance, "custom_models")
        
        await self.db.commit()
        await self.db.refresh(provider_instance)
        
        logger.info(f"删除自定义模型: {model_name} (ID: {model_id})")

    # ================= 可用模型聚合方法 =================

    async def get_available_models(self, project_id: int) -> List[AvailableModel]:
        """获取项目的所有可用模型（包括默认模型和自定义模型）"""
        available_models = []
        
        # 获取项目的提供商实例
        model_provider_instances = await self.get_model_provider_instances(project_id)
        
        # 为每个启用的提供商实例添加默认模型和自定义模型
        for instance in model_provider_instances:
            if not instance.is_enabled:
                continue
            
            provider_def = get_provider_definition(instance.provider_type)
            if not provider_def:
                continue
            
            # 添加默认模型
            default_models = provider_def.get("default_models", [])
            for model_def in default_models:
                if model_def["model_id"] not in instance.enabled_models:
                    continue
                
                available_model = AvailableModel(
                    id=f"default:{instance.id}:{model_def['model_id']}",
                    name=f"{model_def['name']}",
                    model_id=model_def["model_id"],
                    provider_name=instance.name,
                    provider_type=instance.provider_type,
                    description=model_def.get("description"),
                    context_window=model_def.get("context_window"),
                    input_cost_per_token=model_def.get("input_cost_per_token"),
                    output_cost_per_token=model_def.get("output_cost_per_token"),
                    supports_streaming=model_def.get("supports_streaming", True),
                    supports_tools=model_def.get("supports_tools", False),
                    supports_vision=model_def.get("supports_vision", False),
                    is_custom=False,
                    is_enabled=True
                )
                available_models.append(available_model)
            
            # 添加自定义模型
            if instance.custom_models:
                for model_data in instance.custom_models:
                    if not model_data.get("is_enabled", True):
                        continue
                    
                    available_model = AvailableModel(
                        id=f"custom:{model_data['id']}",
                        name=model_data["name"],
                        model_id=model_data["model_id"],
                        provider_name=instance.name,
                        provider_type=instance.provider_type,
                        description=model_data.get("description"),
                        context_window=model_data.get("context_window"),
                        input_cost_per_token=model_data.get("input_cost_per_token"),
                        output_cost_per_token=model_data.get("output_cost_per_token"),
                        supports_streaming=model_data.get("supports_streaming", True),
                        supports_tools=model_data.get("supports_tools", False),
                        supports_vision=model_data.get("supports_vision", False),
                        is_custom=True,
                        is_enabled=model_data.get("is_enabled", True)
                    )
                    available_models.append(available_model)
        
        return available_models

    async def get_model_call_config(self, project_id: int, model_unique_id: str) -> ModelCallConfig:
        """根据模型唯一ID获取调用配置"""
        # 解析模型ID
        if model_unique_id.startswith("default:"):
            # 默认模型：default:{instance_id}:{model_id}
            parts = model_unique_id.split(":", 2)
            if len(parts) != 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的模型ID格式"
                )
            
            instance_id = int(parts[1])
            model_id = parts[2]
            
            provider_instance = await self.get_provider_instance(project_id, instance_id)
            return ModelCallConfig(
                provider_type=provider_instance.provider_type,
                model_id=model_id,
                provider_config=provider_instance.config,
                model_config_data={}
            )
        
        elif model_unique_id.startswith("custom:"):
            # 自定义模型：custom:{model_id}
            parts = model_unique_id.split(":", 1)
            if len(parts) != 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="无效的模型ID格式"
                )
            
            custom_model_id = int(parts[1])
            custom_model = await self.get_custom_model(project_id, custom_model_id)
            provider_instance = await self.get_provider_instance(project_id, custom_model.provider_instance_id)
            
            return ModelCallConfig(
                provider_type=provider_instance.provider_type,
                model_id=custom_model.model_id,
                provider_config=provider_instance.config,
                model_config_data=custom_model.config
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无效的模型ID格式"
            )

    # ================= 私有辅助方法 =================

    async def _validate_provider_config(self, provider_type: str, config: Dict[str, Any]) -> None:
        """验证提供商配置"""
        provider_def = get_provider_definition(provider_type)
        if not provider_def:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的提供商类型: {provider_type}"
            )
        
        fields = provider_def.get("fields", [])
        
        # 检查必填字段
        for field in fields:
            if field.get("required", False) and field["key"] not in config:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"缺少必填字段: {field['name']}"
                )

    async def _check_instance_name_exists(
        self, 
        project_id: int, 
        name: str, 
        exclude_id: Optional[int] = None
    ) -> bool:
        """检查实例名称是否已存在"""
        query = select(ModelProviderInstance).where(
            and_(
                ModelProviderInstance.project_id == project_id,
                ModelProviderInstance.name == name
            )
        )
        
        if exclude_id:
            query = query.where(ModelProviderInstance.id != exclude_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None



    async def _test_provider_connection_impl(
        self, 
        provider_type: str, 
        config: Dict[str, Any]
    ) -> bool:
        """实际的连接测试实现"""
        # 这里应该根据不同的提供商类型实现实际的连接测试
        # 为了简化，这里模拟测试过程
        
        # 检查基本配置
        if provider_type == "openai":
            return "api_key" in config and config["api_key"].startswith("sk-")
        elif provider_type == "anthropic":
            return "api_key" in config and config["api_key"].startswith("sk-ant-")
        elif provider_type == "azure_openai":
            return all(key in config for key in ["api_key", "endpoint", "api_version"])
        else:
            return "api_key" in config and len(config["api_key"]) > 10 