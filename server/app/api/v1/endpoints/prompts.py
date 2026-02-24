import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import (
    get_current_user_id, get_db, check_project_member, check_prompt_access, 
    check_tag_access, check_prompt_version_access, get_current_user
)
from app.schemas.prompt import (
    PromptResponse, PromptCreate, PromptList, PromptUpdate, 
    PromptVersion, PromptVersionCreate, PromptVersionUpdate, 
    TestCase, TestCaseCreate, TestCaseUpdate,
    Request, TagResponse as Tag, TagCreate, TagUpdate, BatchOperationRequest,
    PromptDuplicateRequest
)
from app.schemas.pagination import PaginatedResponse
from app.services.prompt import PromptService
from app.core.logging import get_logger
from sqlalchemy.ext.asyncio import AsyncSession

logger = get_logger(__name__)

router = APIRouter()


@router.post("/", response_model=PromptResponse)
async def create_prompt(
    data: PromptCreate,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建新提示词
    """
    await check_project_member(data.project_id, user_id, db)
    prompt = await prompt_service.create_prompt(data, user_id)
    return prompt


@router.get("/", response_model=PaginatedResponse[PromptList])
async def list_prompts(
    project_id: int = Query(..., description="项目ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tags: Optional[str] = Query(None, description="标签ID列表，逗号分隔"),
    status: Optional[str] = Query(None, description="状态筛选：active,archived,draft"),
    creator: Optional[str] = Query(None, description="创建者筛选：mine,others,all"),
    favorites_only: Optional[bool] = Query(False, description="仅显示收藏"),
    is_template: Optional[bool] = Query(None, description="是否为模板"),
    sort_by: Optional[str] = Query("updated_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向：asc,desc"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取项目下的提示词列表（支持筛选、搜索、分页）
    """
    await check_project_member(project_id, user_id, db)
    # 解析标签ID列表
    tag_ids = []
    if tags:
        try:
            tag_ids = [int(tag_id.strip()) for tag_id in tags.split(",") if tag_id.strip()]
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="标签ID格式错误"
            )
    
    filters = {
        "search": search,
        "tag_ids": tag_ids,
        "status": status,
        "creator": creator,
        "favorites_only": favorites_only,
        "is_template": is_template,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }
    
    result = await prompt_service.get_project_prompts_filtered(
        project_id=project_id,
        user_id=user_id,
        page=page,
        page_size=page_size,
        search=search,
        tags=tag_ids,
        status=status,
        creator=creator,
        favorites_only=favorites_only,
        is_template=is_template,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return result


# 标签管理接口 - 移到动态路径之前
@router.post("/tags", response_model=Tag)
async def create_tag(
    data: TagCreate,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """创建标签"""
    await check_project_member(data.project_id, user_id, db)
    return await prompt_service.create_tag(data)


@router.get("/tags", response_model=List[Tag])
async def list_tags(
    project_id: int = Query(..., description="项目ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """获取项目标签列表"""
    await check_project_member(project_id, user_id, db)
    return await prompt_service.get_project_tags(project_id)


@router.patch("/tags/{tag_id}", response_model=Tag)
async def update_tag(
    tag_id: int,
    data: TagUpdate,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """更新标签"""
    await check_tag_access(tag_id, user_id, db)
    return await prompt_service.update_tag(tag_id, data)


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """删除标签"""
    await check_tag_access(tag_id, user_id, db)
    await prompt_service.delete_tag(tag_id)
    return {"detail": "标签已删除"}


# 批量操作接口 - 移到动态路径之前
@router.post("/batch", response_model=Dict[str, Any])
async def batch_operation(
    data: BatchOperationRequest,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """批量操作提示词"""
    result = await prompt_service.batch_operation(
        prompt_ids=data.prompt_ids,
        action=data.action,
        tag_id=data.tag_id,
        user_id=user_id
    )
    return result


# 统计信息接口 - 移到动态路径之前
@router.get("/stats", response_model=Dict[str, Any])
async def get_prompt_stats(
    project_id: int = Query(..., description="项目ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """获取提示词统计信息"""
    await check_project_member(project_id, user_id, db)
    return await prompt_service.get_prompt_stats(project_id, user_id)


# 请求记录相关路由 - 移到动态路径之前
@router.get("/versions/{version_id}/requests", response_model=List[Request])
async def list_requests(
    version_id: int = Path(..., description="版本ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取版本的所有请求记录
    """
    await check_prompt_version_access(version_id, user_id, db)
    return await prompt_service.get_version_requests(version_id)


@router.get("/{prompt_id}/history", response_model=PaginatedResponse[Request])
async def get_prompt_history(
    prompt_id: int = Path(..., description="提示词ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页大小"),
    source: Optional[str] = Query(None, description="请求来源筛选"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取提示词的历史请求记录（分页）
    """
    await check_prompt_access(prompt_id, user_id, db)
    return await prompt_service.get_prompt_history(prompt_id, page, page_size, source)


# 动态路径路由 - 放在最后
@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定提示词
    """
    await check_prompt_access(prompt_id, user_id, db)
    return await prompt_service.get_prompt_with_tags(prompt_id)


@router.patch("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(
    data: PromptUpdate,
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新提示词
    """
    await check_prompt_access(prompt_id, user_id, db)
    return await prompt_service.update_prompt(prompt_id, data, user_id)


@router.delete("/{prompt_id}")
async def delete_prompt(
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除提示词
    """
    await check_prompt_access(prompt_id, user_id, db)
    await prompt_service.delete_prompt(prompt_id)
    return {"detail": "提示词已删除"}


# 收藏功能接口
@router.post("/{prompt_id}/favorite")
async def toggle_favorite(
    prompt_id: int,
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """切换收藏状态"""
    await check_prompt_access(prompt_id, user_id, db)
    result = await prompt_service.toggle_favorite(prompt_id, user_id)
    return result


# 复制功能接口
@router.post("/{prompt_id}/duplicate", response_model=PromptResponse)
async def duplicate_prompt(
    data: PromptDuplicateRequest,
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """复制提示词"""
    await check_prompt_access(prompt_id, user_id, db)
    result = await prompt_service.duplicate_prompt(
        prompt_id=prompt_id, 
        user_id=user_id,
        custom_name=data.name,
        custom_description=data.description,
        custom_tag_ids=data.tag_ids
    )
    return result


# 提示词版本相关路由

@router.post("/{prompt_id}/versions", response_model=PromptVersion)
async def create_prompt_version(
    data: PromptVersionCreate,
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建提示词版本
    """
    await check_prompt_access(prompt_id, user_id, db)
    # 确保提示词ID与路径参数一致
    if data.prompt_id != prompt_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="提示词ID不匹配",
        )
    
    return await prompt_service.create_prompt_version(data)


@router.get("/{prompt_id}/versions", response_model=List[PromptVersion])
async def list_prompt_versions(
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取提示词的所有版本
    """
    await check_prompt_access(prompt_id, user_id, db)
    return await prompt_service.get_prompt_versions(prompt_id)


@router.get("/{prompt_id}/versions/{version_id}", response_model=PromptVersion)
async def get_prompt_version(
    prompt_id: int = Path(..., description="提示词ID"),
    version_id: int = Path(..., description="版本ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定提示词版本
    """
    await check_prompt_access(prompt_id, user_id, db)
    version = await prompt_service.get_prompt_version(version_id)
    
    # 确保版本属于提示词
    if version.prompt_id != prompt_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词版本未找到",
        )
    
    return version


@router.patch("/{prompt_id}/versions/{version_id}", response_model=PromptVersion)
async def update_prompt_version(
    data: PromptVersionUpdate,
    prompt_id: int = Path(..., description="提示词ID"),
    version_id: int = Path(..., description="版本ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新提示词版本
    """
    await check_prompt_access(prompt_id, user_id, db)
    version = await prompt_service.get_prompt_version(version_id)
    
    # 确保版本属于提示词
    if version.prompt_id != prompt_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="提示词版本未找到",
        )
    
    return await prompt_service.update_prompt_version(version_id, data)

@router.get("/{prompt_id}/active-version", response_model=PromptVersion)
async def get_active_version(
    prompt_id: int = Path(..., description="提示词ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """获取最新的 version"""
    await check_prompt_access(prompt_id, user_id, db)
    return await prompt_service.get_latest_version(prompt_id)

# 测试用例相关路由

@router.post("/{prompt_id}/versions/{version_id}/testcases", response_model=TestCase)
async def create_test_case(
    data: TestCaseCreate,
    version_id: int = Path(..., description="版本ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """创建测试用例"""
    await check_prompt_version_access(version_id, user_id, db)
    # 确保版本ID与路径参数一致
    if data.prompt_version_id != version_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="版本ID不匹配",
        )
    
    return await prompt_service.create_test_case(data)


@router.get("/{prompt_id}/versions/{version_id}/testcases", response_model=List[TestCase])
async def list_test_cases(
    version_id: int = Path(..., description="版本ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取版本的所有测试用例
    """
    await check_prompt_version_access(version_id, user_id, db)
    logging.info(f'version_id: {version_id}')
    return await prompt_service.get_version_test_cases(version_id)


@router.get("/{prompt_id}/versions/{version_id}/testcases/{testcase_id}", response_model=TestCase)
async def get_test_case(
    version_id: int = Path(..., description="版本ID"),
    testcase_id: int = Path(..., description="测试用例ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定测试用例
    """
    await check_prompt_version_access(prompt_id, user_id, db)
    test_case = await prompt_service.get_test_case(testcase_id)
    
    # 确保测试用例属于版本
    if test_case.prompt_version_id != version_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="测试用例未找到",
        )
    
    return test_case


@router.patch("/{prompt_id}/versions/{version_id}/testcases/{testcase_id}", response_model=TestCase)
async def update_test_case(
    data: TestCaseUpdate,
    version_id: int = Path(..., description="版本ID"),
    testcase_id: int = Path(..., description="测试用例ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新测试用例
    """
    await check_prompt_version_access(prompt_id, user_id, db)
    test_case = await prompt_service.get_test_case(testcase_id)
    
    # 确保测试用例属于版本
    if test_case.prompt_version_id != version_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="测试用例未找到",
        )
    
    return await prompt_service.update_test_case(testcase_id, data)


@router.delete("/{prompt_id}/versions/{version_id}/testcases/{testcase_id}")
async def delete_test_case(
    version_id: int = Path(..., description="版本ID"),
    testcase_id: int = Path(..., description="测试用例ID"),
    prompt_service: PromptService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除测试用例
    """
    await check_prompt_version_access(prompt_id, user_id, db)
    test_case = await prompt_service.get_test_case(testcase_id)
    
    # 确保测试用例属于版本
    if test_case.prompt_version_id != version_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="测试用例未找到",
        )
    
    await prompt_service.delete_test_case(testcase_id)
    return {"detail": "测试用例已删除"} 