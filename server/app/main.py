import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.error_handlers import setup_error_handlers
from app.core.middlewares import setup_middlewares

logger = logging.getLogger(__name__)



# 定义生命周期函数
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动事件"""
    try:
        logger.info("正在启动评估任务调度器...")
        from app.services.eval_task_scheduler import start_global_scheduler
        await start_global_scheduler()
        logger.info("评估任务调度器启动成功")
    except Exception as e:
        logger.error(f"启动评估任务调度器失败: {str(e)}", exc_info=True)

    # 初始化代码，例如数据库连接、缓存连接等
    yield
    
    """应用关闭事件"""
    try:
        logger.info("正在停止评估任务调度器...")
        from app.services.eval_task_scheduler import stop_global_scheduler
        await stop_global_scheduler()
        logger.info("评估任务调度器停止成功")
    except Exception as e:
        logger.error(f"停止评估任务调度器失败: {str(e)}", exc_info=True)

# 创建应用实例
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    # lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 设置错误处理器
setup_error_handlers(app)

# 设置中间件
setup_middlewares(app)

# 注册路由
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.middleware("http")
async def spa_middleware(request: Request, call_next):
    """处理所有非/api和/assets开头的请求，返回index.html"""
    # 让API请求、静态文件和健康检查端点直接通过
    if (request.url.path.startswith("/api") or 
        request.url.path.startswith("/assets") or 
        request.url.path.startswith("/favicon") or 
        request.url.path.startswith("/health") or
        request.url.path.startswith("/docs") or
        request.url.path.startswith("/redoc")):
        return await call_next(request)
    
    # 对于其他请求，返回SPA的index.html
    try:
        return FileResponse("app/public/index.html")
    except Exception:
        return await call_next(request)

# 配置静态文件
app.mount("/", StaticFiles(directory="app/public", html=True), name="static")

@app.get("/")
async def root():
    """重定向到index.html"""
    return RedirectResponse(url="/index.html")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok"}