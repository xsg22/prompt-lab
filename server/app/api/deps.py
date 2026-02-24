from typing import AsyncGenerator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decode_access_token, oauth2_scheme
from app.db.session import get_db
from app.models.user import Users

logger = get_logger(__name__)


async def get_token_from_header_or_cookie(request: Request) -> str:
    """从请求头或Cookie中获取令牌"""
    # 先尝试从 header 获取
    authorization: str = request.headers.get("Authorization", "")
    if authorization and authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    
    # 再尝试从 cookie 获取
    token = request.cookies.get("access_token", "")
    if token:
        if token.startswith("Bearer "):
            return token.split(" ", 1)[1]
        return token
    
    # 都没有则抛出异常
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="未提供访问令牌",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_id(
    token: str = Depends(get_token_from_header_or_cookie),
) -> int:
    """获取当前用户ID"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的身份验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
        if not user_id:
            raise credentials_exception
        return user_id
    except (jwt.JWTError, ValueError) as e:
        logger.error(f"令牌验证失败: {str(e)}")
        raise credentials_exception


async def get_current_user(
    token: str = Depends(get_token_from_header_or_cookie),
    db: AsyncSession = Depends(get_db),
) -> Users:
    """获取当前用户"""
    user_id = await get_current_user_id(token)
    
    result = await db.execute(select(Users).where(Users.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    
    return user


async def check_project_member(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否为项目成员"""
    from app.models.project import ProjectMember
    
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您不是该项目的成员",
        )
    
    return True


async def check_dataset_access(
    dataset_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问数据集"""
    from app.models.dataset import Dataset
    
    # 获取数据集的项目ID
    result = await db.execute(
        select(Dataset.project_id).where(Dataset.id == dataset_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="数据集不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_prompt_access(
    prompt_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问提示词"""
    from app.models.prompt import Prompt
    
    # 获取提示词的项目ID
    result = await db.execute(
        select(Prompt.project_id).where(Prompt.id == prompt_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_evaluation_access(
    pipeline_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问评估流水线"""
    from app.models.evaluation import EvalPipeline
    
    # 获取评估流水线的项目ID
    result = await db.execute(
        select(EvalPipeline.project_id).where(EvalPipeline.id == pipeline_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评估流水线不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_eval_result_access(
    result_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问评估结果"""
    from app.models.evaluation import EvalResult, EvalPipeline
    
    # 通过评估结果获取流水线，再获取项目ID
    result = await db.execute(
        select(EvalPipeline.project_id).join(
            EvalResult, EvalResult.pipeline_id == EvalPipeline.id
        ).where(EvalResult.id == result_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评估结果不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_upload_task_access(
    task_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问上传任务"""
    from app.models.dataset_upload import DatasetUploadTask
    from app.models.dataset import Dataset
    
    # 通过上传任务获取数据集，再获取项目ID
    result = await db.execute(
        select(Dataset.project_id).join(
            DatasetUploadTask, DatasetUploadTask.dataset_id == Dataset.id
        ).where(DatasetUploadTask.id == task_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="上传任务不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_tag_access(
    tag_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问标签"""
    from app.models.prompt import Tag
    
    # 获取标签的项目ID
    result = await db.execute(
        select(Tag.project_id).where(Tag.id == tag_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="标签不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_prompt_version_access(
    version_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问提示词版本"""
    from app.models.prompt import PromptVersion, Prompt
    
    # 通过版本获取提示词，再获取项目ID
    result = await db.execute(
        select(Prompt.project_id).join(
            PromptVersion, PromptVersion.prompt_id == Prompt.id
        ).where(PromptVersion.id == version_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词版本不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_eval_column_access(
    column_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问评估列"""
    from app.models.evaluation import EvalColumn, EvalPipeline
    
    # 通过评估列获取流水线，再获取项目ID
    result = await db.execute(
        select(EvalPipeline.project_id).join(
            EvalColumn, EvalColumn.pipeline_id == EvalPipeline.id
        ).where(EvalColumn.id == column_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评估列不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


async def check_request_access(
    request_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """检查用户是否有权限访问请求记录"""
    from app.models.prompt import PromptRequest, PromptVersion, Prompt
    
    # 通过请求记录获取提示词版本，再获取提示词，最后获取项目ID
    result = await db.execute(
        select(Prompt.project_id).join(
            PromptVersion, PromptVersion.prompt_id == Prompt.id
        ).join(
            PromptRequest, PromptRequest.prompt_version_id == PromptVersion.id
        ).where(PromptRequest.id == request_id)
    )
    project_id = result.scalar_one_or_none()
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="请求记录不存在",
        )
    
    # 检查项目成员权限
    await check_project_member(project_id, user_id, db)
    return True


# 依赖工厂函数 - 用于创建特定参数的权限检查依赖
def create_project_member_dependency():
    """创建项目成员权限检查依赖"""
    async def check_project_member_dep(
        project_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_project_member(project_id, user_id, db)
    return check_project_member_dep


def create_dataset_access_dependency():
    """创建数据集访问权限检查依赖"""
    async def check_dataset_access_dep(
        dataset_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_dataset_access(dataset_id, user_id, db)
    return check_dataset_access_dep


def create_prompt_access_dependency():
    """创建提示词访问权限检查依赖"""
    async def check_prompt_access_dep(
        prompt_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_prompt_access(prompt_id, user_id, db)
    return check_prompt_access_dep


def create_evaluation_access_dependency():
    """创建评估流水线访问权限检查依赖"""
    async def check_evaluation_access_dep(
        pipeline_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_evaluation_access(pipeline_id, user_id, db)
    return check_evaluation_access_dep


def create_eval_result_access_dependency():
    """创建评估结果访问权限检查依赖"""
    async def check_eval_result_access_dep(
        result_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_eval_result_access(result_id, user_id, db)
    return check_eval_result_access_dep


def create_upload_task_access_dependency():
    """创建上传任务访问权限检查依赖"""
    async def check_upload_task_access_dep(
        task_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_upload_task_access(task_id, user_id, db)
    return check_upload_task_access_dep


def create_tag_access_dependency():
    """创建标签访问权限检查依赖"""
    async def check_tag_access_dep(
        tag_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_tag_access(tag_id, user_id, db)
    return check_tag_access_dep


def create_prompt_version_access_dependency():
    """创建提示词版本访问权限检查依赖"""
    async def check_prompt_version_access_dep(
        version_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_prompt_version_access(version_id, user_id, db)
    return check_prompt_version_access_dep


def create_eval_column_access_dependency():
    """创建评估列访问权限检查依赖"""
    async def check_eval_column_access_dep(
        column_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_eval_column_access(column_id, user_id, db)
    return check_eval_column_access_dep


def create_request_access_dependency():
    """创建请求记录访问权限检查依赖"""
    async def check_request_access_dep(
        request_id: int,
        user_id: int = Depends(get_current_user_id),
        db: AsyncSession = Depends(get_db),
    ) -> bool:
        return await check_request_access(request_id, user_id, db)
    return check_request_access_dep 