from typing import Any, List

from fastapi import APIRouter, Body, Depends, Path

from app.api.deps import get_current_user, get_current_user_id
from app.models.user import Users
from app.schemas.user import User, UserInfo, UserUpdate
from app.schemas.project import ProjectName
from app.services.auth import AuthService
from app.services.project import ProjectService
from app.services.user import UserService

router = APIRouter()


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(
    current_user: Users = Depends(get_current_user),
) -> Any:
    """
    获取当前用户信息
    """
    return current_user


@router.patch("/me", response_model=UserInfo)
async def update_current_user(
    data: UserUpdate,
    user_service: UserService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    更新当前用户信息
    """
    return await user_service.update_user(user_id, data)


@router.post("/change-password")
async def change_password(
    old_password: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True),
    auth_service: AuthService = Depends(),
    user: User = Depends(get_current_user)
) -> Any:
    """
    修改当前用户密码
    """
    await auth_service.update_password(user, old_password, new_password)
    return {"detail": "密码已修改成功"}


@router.post("/request-verification")
async def request_email_verification(
    auth_service: AuthService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    请求邮箱验证
    """
    await auth_service.send_verification_email(user_id)
    return {"detail": "验证邮件已发送"}


@router.post("/verify-email/{token}")
async def verify_email(
    token: str,
    auth_service: AuthService = Depends(),
) -> Any:
    """
    验证邮箱
    """
    await auth_service.verify_email(token)
    return {"detail": "邮箱验证成功"}


@router.post("/request-password-reset")
async def request_password_reset(
    email: str = Body(..., embed=True),
    auth_service: AuthService = Depends(),
) -> Any:
    """
    请求密码重置
    """
    await auth_service.send_password_reset_email(email)
    return {"detail": "如果邮箱存在，密码重置邮件已发送"}


@router.post("/reset-password/{token}")
async def reset_password(
    token: str,
    new_password: str = Body(..., embed=True),
    auth_service: AuthService = Depends(),
) -> Any:
    """
    重置密码
    """
    await auth_service.reset_password(token, new_password)
    return {"detail": "密码已重置成功"}


@router.delete("/me")
async def delete_user(
    auth_service: AuthService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    注销当前用户账号
    """
    await auth_service.delete_user(user_id)
    return {"detail": "账号已注销"}


@router.get("/projects", response_model=List[ProjectName])
async def get_projects(
    project_service: ProjectService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取用户参与的所有项目
    """
    return await project_service.get_user_projects(user_id)


@router.post("/switch-project/{project_id}")
async def switch_project(
    project_id: int = Path(..., description="项目ID"),
    user_service: UserService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    切换当前活动项目
    """
    await user_service.switch_project(user_id, project_id)
    return {"detail": "项目已切换"} 