"""
AI功能模型配置及调用接口

提供以下功能：
1. 查询/批量更新项目的AI功能模型配置（translate / test_case_generator 等）
2. 通用AI功能调用接口，后端根据feature_key读取配置的模型执行LLM调用
"""
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user_id, get_db, check_project_member
from app.models.ai_feature_config import AIFeatureConfig
from app.schemas.ai_feature import (
    AIFeatureBatchUpdateRequest,
    AIFeatureCallRequest,
    AIFeatureConfigResponse,
    AIFeatureKey,
    DEFAULT_CONFIGS,
)
from app.schemas.prompt import LLMRequest, ModelConfig
from app.schemas.llm import LLMStreamRequest, LLMConfig
from app.services.llm import LLMService

router = APIRouter()


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

async def _get_or_create_feature_config(
    db: AsyncSession,
    project_id: int,
    feature_key: str,
) -> AIFeatureConfig:
    """获取功能配置，若不存在则使用默认值返回（不落库）"""
    result = await db.execute(
        select(AIFeatureConfig).where(
            and_(
                AIFeatureConfig.project_id == project_id,
                AIFeatureConfig.feature_key == feature_key,
            )
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        provider, model_id = DEFAULT_CONFIGS.get(feature_key, ("openai", "gpt-4.1"))
        config = AIFeatureConfig(
            project_id=project_id,
            feature_key=feature_key,
            provider=provider,
            model_id=model_id,
        )
    return config


def _to_response(cfg: AIFeatureConfig) -> AIFeatureConfigResponse:
    from app.schemas.ai_feature import AIFeatureKey
    return AIFeatureConfigResponse(
        id=cfg.id or 0,
        project_id=cfg.project_id,
        feature_key=cfg.feature_key,
        provider=cfg.provider,
        model_id=cfg.model_id,
        label=AIFeatureKey.LABELS.get(cfg.feature_key),
        created_at=cfg.created_at,
        updated_at=cfg.updated_at,
    )


# ---------------------------------------------------------------------------
# 配置 CRUD
# ---------------------------------------------------------------------------

@router.get("/{project_id}/ai-feature-configs", response_model=List[AIFeatureConfigResponse])
async def get_ai_feature_configs(
    project_id: int,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """获取项目的所有AI功能模型配置。若某功能尚未配置，返回默认值。"""
    await check_project_member(project_id, user_id, db)

    result = await db.execute(
        select(AIFeatureConfig).where(AIFeatureConfig.project_id == project_id)
    )
    existing = {row.feature_key: row for row in result.scalars().all()}

    configs: List[AIFeatureConfigResponse] = []
    for key in AIFeatureKey.ALL:
        if key in existing:
            configs.append(_to_response(existing[key]))
        else:
            provider, model_id = DEFAULT_CONFIGS.get(key, ("openai", "gpt-4.1"))
            configs.append(
                AIFeatureConfigResponse(
                    id=0,
                    project_id=project_id,
                    feature_key=key,
                    provider=provider,
                    model_id=model_id,
                    label=AIFeatureKey.LABELS.get(key),
                )
            )
    return configs


@router.put("/{project_id}/ai-feature-configs", response_model=List[AIFeatureConfigResponse])
async def update_ai_feature_configs(
    project_id: int,
    body: AIFeatureBatchUpdateRequest,
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """批量更新项目的AI功能模型配置（upsert）"""
    await check_project_member(project_id, user_id, db)

    result = await db.execute(
        select(AIFeatureConfig).where(AIFeatureConfig.project_id == project_id)
    )
    existing = {row.feature_key: row for row in result.scalars().all()}

    updated: List[AIFeatureConfig] = []
    for item in body.configs:
        if item.feature_key not in AIFeatureKey.ALL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"不支持的功能标识: {item.feature_key}",
            )
        if item.feature_key in existing:
            cfg = existing[item.feature_key]
            cfg.provider = item.provider
            cfg.model_id = item.model_id
        else:
            cfg = AIFeatureConfig(
                project_id=project_id,
                feature_key=item.feature_key,
                provider=item.provider,
                model_id=item.model_id,
            )
            db.add(cfg)
        updated.append(cfg)

    await db.commit()
    for cfg in updated:
        await db.refresh(cfg)

    return [_to_response(cfg) for cfg in updated]


# ---------------------------------------------------------------------------
# AI功能调用（非流式）
# ---------------------------------------------------------------------------

@router.post("/{project_id}/ai-features/call")
async def call_ai_feature(
    project_id: int,
    body: AIFeatureCallRequest,
    llm_service: LLMService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    通用AI功能调用接口（非流式）。

    后端根据 feature_key 从数据库读取配置的 provider + model，
    不需要前端传入模型信息。
    """
    await check_project_member(project_id, user_id, db)

    if body.feature_key not in AIFeatureKey.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的功能标识: {body.feature_key}",
        )

    cfg = await _get_or_create_feature_config(db, project_id, body.feature_key)

    llm_request = LLMRequest(
        messages=body.messages,
        config=ModelConfig(
            provider=cfg.provider,
            model=cfg.model_id,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        ),
        prompt_id=body.prompt_id,
        prompt_version_id=body.prompt_version_id,
        source=body.feature_key,
        project_id=project_id,
    )

    return await llm_service.call_llm(
        user_id=user_id,
        project_id=project_id,
        request=llm_request,
        request_source=body.feature_key
    )


# ---------------------------------------------------------------------------
# AI功能调用（流式）
# ---------------------------------------------------------------------------

@router.post("/{project_id}/ai-features/call-stream")
async def call_ai_feature_stream(
    project_id: int,
    body: AIFeatureCallRequest,
    llm_service: LLMService = Depends(),
    user_id: int = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    通用AI功能调用接口（流式SSE）。

    后端根据 feature_key 从数据库读取配置的 provider + model，
    不需要前端传入模型信息。
    """
    await check_project_member(project_id, user_id, db)

    if body.feature_key not in AIFeatureKey.ALL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的功能标识: {body.feature_key}",
        )

    cfg = await _get_or_create_feature_config(db, project_id, body.feature_key)

    llm_request = LLMStreamRequest(
        messages=body.messages,
        config=LLMConfig(
            provider=cfg.provider,
            model=cfg.model_id,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        ),
        prompt_id=body.prompt_id,
        prompt_version_id=body.prompt_version_id,
        source=body.feature_key,
        project_id=project_id,
    )

    async def generate():
        async for chunk in llm_service.call_llm_stream(
            user_id=user_id,
            project_id=project_id,
            request=llm_request,
            request_source=body.feature_key
        ):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
