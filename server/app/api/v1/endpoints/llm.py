from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, check_project_member
from app.schemas.prompt import LLMRequest
from app.schemas.llm import LLMStreamRequest
from app.services.llm import LLMService

router = APIRouter()


@router.post("/")
async def llm_proxy(
    request: LLMRequest,
    llm_service: LLMService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    发送请求到LLM获取补全结果
    
    此端点允许向LLM发送请求，并获取补全结果。
    可以选择指定提示词版本ID，以便将请求与特定提示词版本关联。
    """
    await check_project_member(request.project_id, user_id, db)
    request_source = request.source or "dashboard"
    
    return await llm_service.call_llm(user_id, request.project_id, request, request_source)


@router.post("/stream")
async def llm_stream(
    request: LLMStreamRequest,
    llm_service: LLMService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    流式发送请求到LLM获取补全结果
    
    此端点允许向LLM发送请求，并通过Server-Sent Events流式获取补全结果。
    支持实时展示生成内容，提高用户体验。
    """
    await check_project_member(request.project_id, user_id, db)
    
    async def generate():
        request_source = request.source or "dashboard"
        async for chunk in llm_service.call_llm_stream(user_id, request.project_id, request, request_source):
            yield chunk
    
    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
        }
    )