from typing import Any, List, Dict

from fastapi import APIRouter, Body, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, check_project_member, get_current_user
from app.models.project import Project
from app.schemas.project import (
    Project, ProjectCreate, ProjectUpdate, 
    ProjectMemberCreate, ProjectMemberUpdate
)
from app.schemas.billing import BillingInfo
from app.schemas.model import CustomModel, CustomModelCreate, CustomModelUpdate
from app.services.project import ProjectService
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=Project)
async def create_project(
    data: ProjectCreate,
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """创建新项目"""
    return await project_service.create_project(data, user_id)


@router.get("/", response_model=List[Project])
async def list_projects(
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取用户的所有项目
    """
    return await project_service.get_user_projects(user_id)


@router.get("/{project_id}", response_model=Project)
async def get_project(
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取特定项目
    """
    return await project_service.get_project(project_id, user_id)


@router.patch("/{project_id}", response_model=Project)
async def update_project(
    data: ProjectUpdate,
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    更新项目
    """
    return await project_service.update_project(project_id, data, user_id)


@router.delete("/{project_id}")
async def delete_project(
    project_name: str = Body(..., embed=True, description="确认删除的项目名称"),
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    删除项目
    """
    await project_service.delete_project(project_id, project_name, user_id)
    return {"detail": "项目已删除"}


# 项目账单相关路由

@router.get("/{project_id}/billing", response_model=BillingInfo)
async def get_billing_info(
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取项目账单信息
    """
    return await project_service.get_billing_info(project_id, user_id)


# 项目成员相关路由

@router.get("/{project_id}/members", response_model=List[Dict[str, Any]])
async def list_members(
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取项目成员列表
    """
    return await project_service.get_project_members(project_id, user_id)


@router.post("/{project_id}/members", response_model=Dict[str, Any])
async def add_member(
    data: ProjectMemberCreate,
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    添加项目成员
    """
    member = await project_service.add_project_member(project_id, data, user_id)
    return {"detail": "成员已添加", "member_id": member.user_id}


@router.put("/{project_id}/members/{member_id}/role", response_model=Dict[str, Any])
async def update_member_role(
    data: ProjectMemberUpdate,
    project_id: int = Path(..., description="项目ID"),
    member_id: int = Path(..., description="成员用户ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    更新成员角色
    """
    member = await project_service.update_member_role(project_id, member_id, data, user_id)
    return {"detail": "成员角色已更新", "role": member.role}


@router.delete("/{project_id}/members/{member_id}")
async def remove_member(
    project_id: int = Path(..., description="项目ID"),
    member_id: int = Path(..., description="成员用户ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    移除项目成员
    """
    await project_service.remove_member(project_id, member_id, user_id)
    return {"detail": "成员已移除"}


# 邀请相关路由

@router.post("/{project_id}/members/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    email: str = Body(..., embed=True, description="邮箱地址"),
    role: str = Body(..., embed=True, description="角色"),
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    向指定邮箱发送项目邀请
    """
    # await project_service.send_invitation(project_id, email, role, user_id)
    return {"detail": "邀请已发送"}


@router.post("/{project_id}/members/invite-link", response_model=Dict[str, str])
async def generate_invite_link(
    role: str = Query(default='member', description="角色"),
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    生成项目邀请链接
    """
    await check_project_member(project_id, user_id, db)
    invite_link = await project_service.generate_invite_link(project_id, role, user_id)
    return {"inviteUrl": invite_link}


@router.get("/invites/{token}/validate", response_model=Dict[str, Any])
async def validate_invite(
    token: str = Path(..., description="邀请令牌"),
    project_service: ProjectService = Depends(),
) -> Any:
    """
    验证邀请链接
    """
    invite_info = await project_service.validate_invitation(token)
    return invite_info


@router.post("/accept-invitation/{token}", response_model=Dict[str, Any])
async def accept_invitation(
    token: str = Path(..., description="邀请令牌"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    接受项目邀请
    """
    project = await project_service.accept_invitation(token, user_id)
    return {
        "detail": "邀请已接受",
        "project_id": project.id,
        "project_name": project.name,
    }


# API密钥相关路由

# @router.get("/{project_id}/apikeys", response_model=List[ApiKey])
# async def get_api_keys(
#     project_id: int = Path(..., description="项目ID"),
#     project_service: ProjectService = Depends(),
#     user_id: int = Depends(get_current_user_id),
# ) -> Any:
#     """
#     获取项目API密钥列表
#     """
#     return await project_service.get_api_keys(project_id, user_id)


# @router.post("/{project_id}/apikeys", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
# async def create_api_key(
#     data: ApiKeyCreate,
#     project_id: int = Path(..., description="项目ID"),
#     project_service: ProjectService = Depends(),
#     user_id: int = Depends(get_current_user_id),
# ) -> Any:
#     """
#     创建项目API密钥
#     """
#     return await project_service.create_api_key(project_id, data, user_id)


# @router.delete("/{project_id}/apikeys/{key_id}")
# async def delete_api_key(
#     project_id: int = Path(..., description="项目ID"),
#     key_id: int = Path(..., description="API密钥ID"),
#     project_service: ProjectService = Depends(),
#     user_id: int = Depends(get_current_user_id),
# ) -> Any:
#     """
#     删除项目API密钥
#     """
#     await project_service.delete_api_key(project_id, key_id, user_id)
#     return {"detail": "API密钥已删除"}


# 自定义模型相关路由

@router.get("/{project_id}/models", response_model=List[CustomModel])
async def get_custom_models(
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取项目自定义模型列表
    """
    return await project_service.get_custom_models(project_id, user_id)


@router.post("/{project_id}/models", response_model=CustomModel, status_code=status.HTTP_201_CREATED)
async def create_custom_model(
    data: CustomModelCreate,
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    创建项目自定义模型
    """
    return await project_service.create_custom_model(project_id, data, user_id)


@router.put("/{project_id}/models/{model_id}", response_model=CustomModel)
async def update_custom_model(
    data: CustomModelUpdate,
    project_id: int = Path(..., description="项目ID"),
    model_id: int = Path(..., description="模型ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    更新项目自定义模型
    """
    return await project_service.update_custom_model(project_id, model_id, data, user_id)


@router.delete("/{project_id}/models/{model_id}")
async def delete_custom_model(
    project_id: int = Path(..., description="项目ID"),
    model_id: int = Path(..., description="模型ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    删除项目自定义模型
    """
    await project_service.delete_custom_model(project_id, model_id, user_id)
    return {"detail": "自定义模型已删除"}


# LLM API 配置相关路由

@router.get("/{project_id}/llm-config", response_model=Dict[str, Any])
async def get_llm_config(
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取项目 LLM API 配置
    """
    return await project_service.get_llm_api_config(project_id, user_id)


@router.patch("/{project_id}/llm-config", response_model=Dict[str, Any])
async def update_llm_config(
    config: Dict[str, Any] = Body(..., description="LLM API 配置"),
    project_id: int = Path(..., description="项目ID"),
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    更新项目 LLM API 配置
    """
    return await project_service.update_llm_api_config(project_id, config, user_id) 