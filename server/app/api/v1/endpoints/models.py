from typing import Any, Dict, List

from fastapi import APIRouter, Body, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, check_project_member
from app.schemas.model import (
    ProviderDefinition, ProviderInstance, ProviderInstanceCreate, ProviderInstanceUpdate,
    CustomModel, CustomModelCreate, CustomModelUpdate, CustomModelResponse,
    AvailableModel, TestConnectionRequest, TestConnectionResponse,
    ModelCallConfig
)
from app.services.model import ModelService
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


# ================= 提供商定义相关路由 =================

@router.get("/provider-definitions", response_model=List[ProviderDefinition])
async def get_provider_definitions(
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取所有提供商定义
    """
    provider_definitions = await model_service.get_provider_definitions()
    return list(provider_definitions.values())


@router.get("/provider-definitions/{provider_type}", response_model=ProviderDefinition)
async def get_provider_definition(
    provider_type: str = Path(..., description="提供商类型"),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取指定提供商定义
    """
    return await model_service.get_provider_definition(provider_type)


# ================= 提供商实例相关路由 =================

@router.get("/projects/{project_id}/provider-instances", response_model=List[ProviderInstance])
async def get_provider_instances(
    project_id: int = Path(..., description="项目ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取项目的提供商实例列表
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_model_provider_instances(project_id)


@router.post("/projects/{project_id}/provider-instances", response_model=ProviderInstance, status_code=status.HTTP_201_CREATED)
async def create_provider_instance(
    data: ProviderInstanceCreate,
    project_id: int = Path(..., description="项目ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    创建提供商实例
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.create_model_provider_instance(project_id, data)


@router.get("/projects/{project_id}/provider-instances/{instance_id}", response_model=ProviderInstance)
async def get_provider_instance(
    project_id: int = Path(..., description="项目ID"),
    instance_id: int = Path(..., description="实例ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取指定的提供商实例
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_provider_instance(project_id, instance_id)


@router.put("/projects/{project_id}/provider-instances/{instance_id}", response_model=ProviderInstance)
async def update_provider_instance(
    data: ProviderInstanceUpdate,
    project_id: int = Path(..., description="项目ID"),
    instance_id: int = Path(..., description="实例ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    更新提供商实例
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.update_model_provider_instance(project_id, instance_id, data)


@router.delete("/projects/{project_id}/provider-instances/{instance_id}")
async def delete_provider_instance(
    project_id: int = Path(..., description="项目ID"),
    instance_id: int = Path(..., description="实例ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    删除提供商实例
    """
    await check_project_member(project_id, user_id, db)
    await model_service.delete_provider_instance(project_id, instance_id)
    return {"detail": "提供商实例已删除"}


@router.post("/projects/{project_id}/provider-instances/{instance_id}/test", response_model=TestConnectionResponse)
async def test_provider_connection(
    project_id: int = Path(..., description="项目ID"),
    instance_id: int = Path(..., description="实例ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
    ) -> Any:
    """
    测试提供商实例连接
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.test_provider_connection(project_id, instance_id)


# ================= 自定义模型相关路由 =================

@router.get("/projects/{project_id}/custom-models", response_model=List[CustomModelResponse])
async def get_custom_models(
    project_id: int = Path(..., description="项目ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取项目的自定义模型列表
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_custom_models(project_id)


@router.post("/projects/{project_id}/custom-models", response_model=CustomModelResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_model(
    data: CustomModelCreate,
    project_id: int = Path(..., description="项目ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    创建自定义模型
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.create_custom_model(project_id, data)


@router.get("/projects/{project_id}/custom-models/{model_id}", response_model=CustomModelResponse)
async def get_custom_model(
    project_id: int = Path(..., description="项目ID"),
    model_id: int = Path(..., description="模型ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取指定的自定义模型
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_custom_model(project_id, model_id)


@router.put("/projects/{project_id}/custom-models/{model_id}", response_model=CustomModelResponse)
async def update_custom_model(
    data: CustomModelUpdate,
    project_id: int = Path(..., description="项目ID"),
    model_id: int = Path(..., description="模型ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    更新自定义模型
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.update_custom_model(project_id, model_id, data)


@router.delete("/projects/{project_id}/custom-models/{model_id}")
async def delete_custom_model(
    project_id: int = Path(..., description="项目ID"),
    model_id: int = Path(..., description="模型ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    删除自定义模型
    """
    await check_project_member(project_id, user_id, db)
    await model_service.delete_custom_model(project_id, model_id)
    return {"detail": "自定义模型已删除"}


# ================= 可用模型聚合路由 =================

@router.get("/projects/{project_id}/available-models", response_model=List[AvailableModel])
async def get_available_models(
    project_id: int = Path(..., description="项目ID"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取项目的所有可用模型（包括默认模型和自定义模型）
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_available_models(project_id)


@router.get("/projects/{project_id}/models/{model_id}/config", response_model=ModelCallConfig)
async def get_model_call_config(
    project_id: int = Path(..., description="项目ID"),
    model_id: str = Path(..., description="模型唯一标识"),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    model_service: ModelService = Depends(),
) -> Any:
    """
    获取模型调用配置
    """
    await check_project_member(project_id, user_id, db)
    return await model_service.get_model_call_config(project_id, model_id)


# ================= 通用连接测试路由 =================

@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(
    data: TestConnectionRequest,
    user_id: int = Depends(get_current_user_id),
    model_service: ModelService = Depends(),
) -> Any:
    """
    测试提供商连接（不保存实例）
    """
    return await model_service._test_provider_connection_impl(
        data.provider_type, 
        data.config
    ) 