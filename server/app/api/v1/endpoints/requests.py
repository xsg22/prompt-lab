from typing import Any, Dict, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import check_project_member, check_prompt_version_access, check_request_access, get_current_user_id
from app.schemas.request import RequestCreate, RequestResponse
from app.services.request import RequestService
from app.db.session import get_db

router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def list_requests(
    page: int = Query(1, description="页码"),
    page_size: int = Query(10, description="每页条数"),
    prompt_name: Optional[str] = Query(None, description="提示词名称过滤"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    request_service: RequestService = Depends(),
    user_id: int = Depends(get_current_user_id),
) -> Any:
    """
    查询请求记录
    """
    requests, total = await request_service.get_requests(
        page=page,
        page_size=page_size,
        prompt_name=prompt_name,
        start_time=start_time,
        end_time=end_time,
        user_id=user_id
    )
    
    return {
        "items": requests,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: int = Path(..., description="请求ID"),
    request_service: RequestService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    获取特定请求详情
    """
    await check_request_access(request_id, user_id, db)
    request = await request_service.get_request(request_id, user_id)
    if not request:
        raise HTTPException(status_code=404, detail="请求不存在")
    return request


@router.post("/report", response_model=Dict[str, str])
async def report_request(
    request: RequestCreate,
    request_service: RequestService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    上报请求记录
    """
    await check_prompt_version_access(request.prompt_version_id, user_id, db)
    await request_service.create_request(request)
    return {"detail": "请求已记录"} 