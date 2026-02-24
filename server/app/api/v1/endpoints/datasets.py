import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, check_project_member, check_dataset_access, check_upload_task_access, get_current_user
from app.schemas.dataset import (
    DatasetCreate, DatasetItemCreate,
    DatasetItemUpdate, DatasetUpdate, Dataset, DatasetItem,
    DataAnalysisRequest, DataAnalysisResponse
)
from app.schemas.pagination import PaginatedResponse
from app.schemas.dataset_upload import (
    DatasetUploadPreviewRequest, DatasetUploadPreviewResponse,
    DatasetUploadStartRequest, DatasetUploadStartResponse,
    DatasetUploadStatusResponse, DatasetUploadResultResponse,
    DatasetUploadRetryRequest, DatasetUploadTask
)
from app.services.dataset import DatasetService
from app.services.dataset_upload_service import DatasetUploadService

router = APIRouter()


@router.get("/", response_model=List[Dict[str, Any]])
async def list_datasets(
    project_id: int = Query(..., description="项目ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取项目下的所有数据集
    """
    await check_project_member(project_id, user_id, db)
    return await dataset_service.get_project_datasets(project_id)


@router.post("/", response_model=Dataset)
async def create_dataset(
    dataset: DatasetCreate,
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建数据集
    """
    await check_project_member(dataset.project_id, user_id, db)
    return await dataset_service.create_dataset(dataset, user_id)


@router.get("/{dataset_id}", response_model=Dataset)
async def get_dataset(
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取数据集详情
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return dataset


@router.patch("/{dataset_id}", response_model=Dataset)
async def update_dataset(
    dataset_update: DatasetUpdate,
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新数据集
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return await dataset_service.update_dataset(dataset_id, dataset_update)


@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除数据集
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    await dataset_service.delete_dataset(dataset_id)
    return {"detail": "数据集已删除"}


# 数据集项相关路由

@router.get("/{dataset_id}/items", response_model=PaginatedResponse[DatasetItem])
async def list_dataset_items(
    dataset_id: int = Path(..., description="数据集ID"),
    enabled_only: bool = Query(False, description="是否只返回启用的条目"),
    search: str = Query("", description="搜索关键词"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序方向(asc/desc)"),
    page: int = Query(1, description="页码"),
    page_size: int = Query(20, description="每页大小"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取数据集所有条目（支持搜索、排序、分页）
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return await dataset_service.get_dataset_items(
        dataset_id, 
        enabled_only=enabled_only,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size
    )

@router.get("/{dataset_id}/items/enabled_count", response_model=Dict[str, int])
async def get_dataset_items_enabled_count(
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取数据集启用和总条目数量
    """
    await check_dataset_access(dataset_id, user_id, db)
    return await dataset_service.get_dataset_items_enabled_count(dataset_id)

@router.post("/{dataset_id}/items", response_model=DatasetItem)
async def create_dataset_item(
    item: DatasetItemCreate,
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """创建数据集条目"""
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return await dataset_service.create_dataset_item(dataset_id, item)


@router.get("/{dataset_id}/items/{item_id}", response_model=DatasetItem)
async def get_dataset_item(
    dataset_id: int = Path(..., description="数据集ID"),
    item_id: int = Path(..., description="条目ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取数据集条目详情
    """
    await check_dataset_access(dataset_id, user_id, db)
    item = await dataset_service.get_dataset_item(dataset_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="数据集条目不存在")
    return item


@router.patch("/{dataset_id}/items/{item_id}", response_model=DatasetItem)
async def update_dataset_item(
    item_update: DatasetItemUpdate,
    dataset_id: int = Path(..., description="数据集ID"),
    item_id: int = Path(..., description="条目ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新数据集条目
    """
    await check_dataset_access(dataset_id, user_id, db)
    item = await dataset_service.get_dataset_item(dataset_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="数据集条目不存在")
    return await dataset_service.update_dataset_item(dataset_id, item_id, item_update)


@router.delete("/{dataset_id}/items/{item_id}")
async def delete_dataset_item(
    dataset_id: int = Path(..., description="数据集ID"),
    item_id: int = Path(..., description="条目ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除数据集条目
    """
    await check_dataset_access(dataset_id, user_id, db)
    item = await dataset_service.get_dataset_item(dataset_id, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="数据集条目不存在")
    await dataset_service.delete_dataset_item(dataset_id, item_id)
    return {"detail": "数据集条目已删除"}


@router.delete("/{dataset_id}/items")
async def batch_delete_dataset_items(
    item_ids: List[int] = Body(..., description="要删除的条目ID列表"),
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    批量删除数据集条目
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    
    if not item_ids:
        raise HTTPException(status_code=400, detail="未提供要删除的条目ID")
    
    deleted_count = await dataset_service.batch_delete_dataset_items(dataset_id, item_ids)
    return {
        "detail": f"成功删除 {deleted_count} 个条目",
        "deleted_count": deleted_count
    }


@router.post("/{dataset_id}/items/batch", response_model=Dict[str, Any])
async def batch_create_items(
    items: List[DatasetItemCreate],
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """批量创建数据集条目"""
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    created_items = await dataset_service.batch_create_items(dataset_id, items)
    return {
        "detail": f"成功创建 {len(created_items)} 条数据",
        "items": created_items
    }


@router.post("/{dataset_id}/import-testcases", response_model=Dict[str, Any])
async def import_testcases(
    test_cases: List[Dict[str, Any]] = Body(..., description="测试用例列表"),
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    从测试用例导入到数据集
    """
    await check_dataset_access(dataset_id, user_id, db)
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    
    if not test_cases:
        raise HTTPException(status_code=400, detail="未提供测试用例")
    
    # 将测试用例转换为数据集项
    dataset_items = []
    for tc in test_cases:
        # 复制测试用例，移除status字段
        variables = tc.copy()
        status = variables.pop("status", True)
        
        item = DatasetItemCreate(
            name=variables.get("name", ""),
            variables_values=variables,
            is_enabled=status,
            expected_output=""
        )
        dataset_items.append(item)
    
    created_items = await dataset_service.batch_create_items(dataset_id, dataset_items)
    
    return {
        "detail": f"已导入 {len(created_items)} 个测试用例",
        "count": len(created_items)
    } 


# 数据集上传相关路由
@router.post("/{dataset_id}/upload/preview", response_model=DatasetUploadPreviewResponse)
async def preview_dataset_upload(
    dataset_id: int = Path(..., description="数据集ID"),
    request: DatasetUploadPreviewRequest = ...,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    预览数据集上传文件
    """
    await check_dataset_access(dataset_id, user_id, db)
    try:
        upload_service = DatasetUploadService(db)
        return await upload_service.preview_upload(dataset_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预览失败: {str(e)}")


@router.post("/{dataset_id}/upload/start", response_model=DatasetUploadStartResponse)
async def start_dataset_upload(
    dataset_id: int = Path(..., description="数据集ID"),
    request: DatasetUploadStartRequest = ...,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    开始数据集上传
    """
    await check_dataset_access(dataset_id, user_id, db)
    try:
        upload_service = DatasetUploadService(db)
        return await upload_service.start_upload(dataset_id, user_id, request)
    except ValueError as e:
        logging.error(f"上传启动失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"上传启动失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"上传启动失败: {str(e)}")


@router.get("/upload/status/{task_id}", response_model=DatasetUploadStatusResponse)
async def get_upload_status(
    task_id: int = Path(..., description="上传任务ID"),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取上传任务状态
    """
    await check_upload_task_access(task_id, user_id, db)
    try:
        upload_service = DatasetUploadService(db)
        return await upload_service.get_upload_status(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logging.error(f"获取状态失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")


@router.get("/upload/result/{task_id}", response_model=DatasetUploadResultResponse)
async def get_upload_result(
    task_id: int = Path(..., description="上传任务ID"),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    获取上传任务结果
    """
    await check_upload_task_access(task_id, user_id, db)
    try:
        upload_service = DatasetUploadService(db)
        return await upload_service.get_upload_result(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logging.error(f"获取结果失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取结果失败: {str(e)}")


@router.post("/upload/retry", response_model=DatasetUploadStartResponse)
async def retry_dataset_upload(
    request: DatasetUploadRetryRequest = ...,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    重试数据集上传
    """
    # 这里需要通过请求中的dataset_id检查权限
    result = await db.execute(
            select(DatasetUploadTask)
            .where(DatasetUploadTask.id == request.task_id)
        )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="上传任务不存在")
    await check_dataset_access(task.dataset_id, user_id, db)
    
    try:
        upload_service = DatasetUploadService(db)
        return await upload_service.retry_upload(request, user_id)
    except ValueError as e:
        logging.error(f"重试失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        logging.error(f"重试失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        logging.error(f"重试失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"重试失败: {str(e)}")


# 数据分析相关路由
@router.post("/{dataset_id}/analysis", response_model=DataAnalysisResponse)
async def create_data_analysis_prompt(
    analysis_request: DataAnalysisRequest,
    dataset_id: int = Path(..., description="数据集ID"),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    基于数据集创建数据分析提示词
    """
    await check_dataset_access(dataset_id, user_id, db)
    # 验证数据集是否存在
    dataset = await dataset_service.get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    
    try:
        result = await dataset_service.create_analysis_prompt(
            dataset_id, 
            analysis_request,
            user_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"创建数据分析提示词失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"创建数据分析提示词失败: {str(e)}") 