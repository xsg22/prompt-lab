from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_current_user_id, get_db, check_project_member, check_evaluation_access,
    check_eval_result_access, check_eval_column_access, get_current_user
)
from app.schemas.evaluation import (
    EvalPipeline, EvalPipelineCreate, EvalPipelineList, EvalPipelineUpdate,
    EvalColumn, EvalColumnCreate, EvalColumnUpdate,
    EvalResult, EvalResultCreate, EvalCell, EvalCellUpdate,
    SingleColumnEvalRequest
)
from app.services.evaluation import EvaluationService
from app.core.logging import get_logger
from app.services.dataset import DatasetService
from app.services.user import UserService

logger = get_logger(__name__)

router = APIRouter()


# 评估流水线相关路由

@router.post("/", response_model=EvalPipelineList)
async def create_pipeline(
    data: EvalPipelineCreate,
    evaluation_service: EvaluationService = Depends(),
    user_service: UserService = Depends(),
    dataset_service: DatasetService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建评估流水线
    """
    # 返回结果要补充数据集和创建人
    await check_project_member(data.project_id, user_id, db)
    
    pipeline = await evaluation_service.create_pipeline(data, user_id)
    
    dataset = await dataset_service.get_dataset(pipeline.dataset_id)
    user = await user_service.get_user_by_id(user_id)
    return EvalPipelineList(
        **pipeline.to_dict(),
        dataset_name=dataset.name,
        creator_name=user.nickname,
        run_type='staging'
    )

@router.put("/{pipeline_id}/change-dataset", response_model=EvalPipeline)
async def change_dataset(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    data: Dict[str, Any] = Body(..., description="更改数据集请求数据"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更改评估流水线的数据集
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    
    dataset_id = data.get("dataset_id")
    selected_item_ids = data.get("selected_item_ids")
    return await evaluation_service.change_dataset(pipeline_id, dataset_id, selected_item_ids)


@router.get("/", response_model=List[EvalPipelineList])
async def list_pipelines(
    project_id: int = Query(..., description="项目ID"),
    staging: bool = Query(False, description="是否包含staging类型的结果"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取项目下的所有评估流水线
    """
    await check_project_member(project_id, user_id, db)
    
    return await evaluation_service.get_project_pipelines(project_id, staging)


@router.get("/{pipeline_id}", response_model=EvalPipeline)
async def get_pipeline(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定评估流水线
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    return await evaluation_service.get_pipeline(pipeline_id)


@router.patch("/{pipeline_id}", response_model=EvalPipeline)
async def update_pipeline(
    data: EvalPipelineUpdate,
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新评估流水线
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    return await evaluation_service.update_pipeline(pipeline_id, data)


@router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除评估流水线
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    
    await evaluation_service.delete_pipeline(pipeline_id)
    return {"detail": "评估流水线已删除"}


# 评估列相关路由

@router.post("/{pipeline_id}/columns", response_model=EvalColumn)
async def create_column(
    data: EvalColumnCreate,
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建评估列
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    
    # 确保流水线ID与路径参数一致
    if data.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="流水线ID不匹配",
        )
    
    eval_column = await evaluation_service.create_column(data)

    pipeline = await evaluation_service.get_pipeline(data.pipeline_id)
    result = await evaluation_service.get_staging_result(pipeline.id)
    await evaluation_service.create_eval_cells_by_column(pipeline.id, pipeline.dataset_id, result.id, eval_column)
    return eval_column


@router.get("/{pipeline_id}/columns", response_model=List[EvalColumn])
async def list_columns(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取流水线的所有评估列
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    return await evaluation_service.get_pipeline_columns(pipeline_id)


@router.get("/columns/{column_id}", response_model=EvalColumn)
async def get_column(
    column_id: int = Path(..., description="评估列ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定评估列
    """
    await check_eval_column_access(column_id, user_id, db)
    return await evaluation_service.get_column(column_id)


@router.put("/{pipeline_id}/columns/{column_id}", response_model=EvalColumn)
async def update_column(
    data: EvalColumnUpdate,
    column_id: int = Path(..., description="评估列ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新评估列
    """
    await check_eval_column_access(column_id, user_id, db)
    return await evaluation_service.update_column(column_id, data)


@router.delete("/{pipeline_id}/columns/{column_id}")
async def delete_column(
    column_id: int = Path(..., description="评估列ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    删除评估列
    """
    await check_eval_column_access(column_id, user_id, db)
    await evaluation_service.delete_column(column_id)
    return {"detail": "评估列已删除"}


# 评估结果相关路由

@router.post("/{pipeline_id}/results", response_model=EvalResult)
async def create_result(
    data: EvalResultCreate,
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    创建评估结果
    支持两种执行模式：
    - column_based: 传统的按列执行模式（默认）
    - row_based: 新的按行执行模式
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    
    # 确保流水线ID与路径参数一致
    if data.pipeline_id != pipeline_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="流水线ID不匹配",
        )
    
    # 检查评估流水线是否存在
    pipeline = await evaluation_service.get_pipeline(data.pipeline_id)
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评估流水线不存在",
        )
    
    # 根据执行模式创建评估结果
    if data.execution_mode == "row_based":
        return await evaluation_service.create_result_with_row_execution(data, data.selected_item_ids)
    else:
        # TODO: 暂时不会用到
        return await evaluation_service.create_result(pipeline, data, data.selected_item_ids)


@router.get("/{pipeline_id}/results", response_model=List[EvalResult])
async def list_results(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    exclude_staging: bool = Query(False, description="是否排除staging类型的结果"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取流水线的所有评估结果
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    return await evaluation_service.get_pipeline_results(pipeline_id, exclude_staging)


@router.get("/project/{project_id}/results", response_model=List[EvalResult])
async def list_project_results(
    project_id: int = Path(..., description="项目ID"),
    exclude_staging: bool = Query(True, description="是否排除staging类型的结果"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取项目下所有流水线的评估结果
    """
    await check_project_member(project_id, user_id, db)
    return await evaluation_service.get_project_evaluation_results(project_id, exclude_staging)


@router.get("/results/{result_id}", response_model=EvalResult)
async def get_result(
    result_id: int = Path(..., description="评估结果ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定评估结果
    """
    await check_eval_result_access(result_id, user_id, db)
    return await evaluation_service.get_result(result_id)

@router.get("/{pipeline_id}/result/status")
async def get_pipeline_result_status(
    pipeline_id: int = Path(..., description="流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """获取评估结果"""
    await check_evaluation_access(pipeline_id, user_id, db)
    
    results = await evaluation_service.get_staging_result(pipeline_id)
    cells = await evaluation_service.get_result_cells(results.id)
    # 返回每个cell的status的数量
    return {
        "new": len([cell for cell in cells if cell.status == 'new']),
        "running": len([cell for cell in cells if cell.status == 'running']),
        "completed": len([cell for cell in cells if cell.status == 'completed']),
        "failed": len([cell for cell in cells if cell.status == 'failed']),
    }

# 评估单元格相关路由

@router.get("/{pipeline_id}/cells")
async def list_cells(
    pipeline_id: int = Path(..., description="评估流水线ID"),
    run_type: str = Query("staging", description="运行类型"),
    page: int = Query(1, ge=1, description="页码，从1开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数，最大100"),
    show_failed_only: bool = Query(False, description="是否只显示失败的记录（最后一列结果为false）"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取评估结果的单元格（分页）
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    if run_type == "staging":
        result = await evaluation_service.get_staging_result(pipeline_id)
    else:
        # 获取指定run_type的结果
        results = await evaluation_service.get_pipeline_results(pipeline_id, exclude_staging=False)
        result = next((r for r in results if r.run_type == run_type), None)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定的评估结果未找到",
            )
    
    return await evaluation_service.get_result_cells_with_column_name_paginated(result.id, page, page_size, show_failed_only)


@router.patch("/{pipeline_id}/cell/{cell_id}", response_model=EvalCell)
async def update_cell(
    data: EvalCellUpdate,
    cell_id: int = Path(..., description="评估单元格ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    更新评估单元格
    """
    cell = await evaluation_service.get_cell(cell_id)
    await check_evaluation_access(cell.pipeline_id, user_id, db)
    
    return await evaluation_service.update_cell(cell_id, data)


@router.post("/{pipeline_id}/evaluate-column")
async def process_column(
    data: SingleColumnEvalRequest,
    pipeline_id: int = Path(..., description="评估流水线ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    处理单列评估
    """
    await check_evaluation_access(pipeline_id, user_id, db)
    return await evaluation_service.start_evaluate_column(data, pipeline_id, user_id)


# 行执行模式相关路由

@router.post("/results/{result_id}/execute-rows", response_model=Dict[str, Any])
async def execute_result_rows(
    result_id: int = Path(..., description="评估结果ID"),
    dataset_item_ids: Optional[List[int]] = Query(None, description="选中的数据集项ID列表"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """使用行执行模式执行评估结果 - 通过统一调度器"""
    
    await check_eval_result_access(result_id, user_id, db)
    
    result = await evaluation_service.get_result(result_id)
    if result.execution_mode != "row_based":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该评估结果不支持行执行模式"
        )
    
    # 通过统一调度器执行行任务
    from app.services.eval_row_task_manager import EvalRowTaskManager
    from app.schemas.eval_result_row_task import RowTaskBatchExecutionRequest
    
    row_task_manager = EvalRowTaskManager()
    
    # 创建执行请求
    request = RowTaskBatchExecutionRequest(
        result_id=result_id,
        dataset_item_ids=dataset_item_ids
    )
    
    # 执行（通过调度器）
    return await row_task_manager.execute_row_tasks_batch(request)

@router.post("/results/{result_id}/execute-rows-direct", response_model=Dict[str, Any])
async def execute_result_rows_direct(
    result_id: int = Path(..., description="评估结果ID"),
    dataset_item_ids: Optional[List[int]] = Query(None, description="选中的数据集项ID列表"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """直接执行行任务（不通过调度器）- 用于测试或小规模执行"""
    
    await check_eval_result_access(result_id, user_id, db)
    
    result = await evaluation_service.get_result(result_id)
    
    # 检查是否支持行执行模式
    if result.execution_mode != "row_based":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该评估结果不支持行执行模式"
        )
    
    # 直接执行行任务
    from app.services.eval_row_task_manager import EvalRowTaskManager
    
    row_task_manager = EvalRowTaskManager()
    
    # 直接执行
    return await row_task_manager.execute_row_tasks_directly(result_id, dataset_item_ids)

@router.get("/results/{result_id}/row-progress")
async def get_row_task_progress(
    result_id: int = Path(..., description="评估结果ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    获取行任务执行进度
    """
    await check_eval_result_access(result_id, user_id, db)
    return await evaluation_service.get_row_task_progress(result_id)

@router.get("/results/{result_id}/row-tasks")
async def get_row_tasks(
    result_id: int = Path(..., description="评估结果ID"),
    evaluation_service: EvaluationService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取评估结果的行任务列表
    """
    await check_eval_result_access(result_id, user_id, db)
    return await evaluation_service.get_row_tasks_for_result(result_id)

@router.get("/scheduler/status", response_model=Dict[str, Any])
async def get_scheduler_status(
    user_id: int = Depends(get_current_user_id),
):
    """获取统一调度器状态信息"""
    from app.services.eval_task_scheduler import get_scheduler
    
    scheduler = await get_scheduler()
    return await scheduler.get_scheduler_status()

@router.post("/scheduler/start")
async def start_scheduler(
    user_id: int = Depends(get_current_user_id),
):
    """启动统一调度器"""
    from app.services.eval_task_scheduler import start_global_scheduler
    
    await start_global_scheduler()
    return {"message": "调度器已启动"}

@router.post("/scheduler/stop")
async def stop_scheduler(
    user_id: int = Depends(get_current_user_id),
):
    """停止统一调度器"""
    from app.services.eval_task_scheduler import stop_global_scheduler
    
    await stop_global_scheduler()
    return {"message": "调度器已停止"}