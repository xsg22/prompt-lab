from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, datasets, evaluations, llm, prompts, projects, users, requests, invites, models, ai_features
)

# 创建V1版本API路由
api_router = APIRouter()

# 注册各个模块的路由
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(projects.router, prefix="/projects", tags=["项目管理"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集管理"])
api_router.include_router(prompts.router, prefix="/prompts", tags=["提示词管理"])
api_router.include_router(evaluations.router, prefix="/eval-pipelines", tags=["提示词评估"])
api_router.include_router(llm.router, prefix="/llmapi", tags=["LLM 调用"])
api_router.include_router(requests.router, prefix="/requests", tags=["请求记录"])
api_router.include_router(invites.router, prefix="/invites", tags=["邀请管理"])
api_router.include_router(models.router, prefix="/models", tags=["模型管理"])
api_router.include_router(ai_features.router, prefix="/projects", tags=["AI功能配置"])