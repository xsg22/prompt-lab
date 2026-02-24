import time
from typing import Any, Callable, Dict, Optional, Union

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import StreamingResponse
from starlette.types import ASGIApp

from app.core.logging import get_logger

logger = get_logger(__name__)


class ResponseFormatterMiddleware(BaseHTTPMiddleware):
    """响应格式化中间件"""
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """格式化响应数据"""
        # 记录请求开始时间
        start_time = time.time()
        
        # 处理请求
        response = await call_next(request)
        
        # 计算请求处理时间
        process_time = time.time() - start_time
        
        # 如果是错误响应或者非JSON响应则直接返回
        if (
            response.status_code >= 400
            or isinstance(response, StreamingResponse)
            or response.headers.get("Content-Type") != "application/json"
        ):
            # 添加处理时间到响应头
            response.headers["X-Process-Time"] = str(process_time)
            return response
        
        # 获取响应数据
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # 解析JSON数据
            import json
            data = json.loads(body)
            
            # 如果已经是标准格式，则直接返回
            if isinstance(data, dict) and "data" in data:
                formatted_response = Response(
                    content=body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
                formatted_response.headers["X-Process-Time"] = str(process_time)
                return formatted_response
            
            # 格式化响应数据
            formatted_data = {"data": data}
            
            # 创建新的响应
            formatted_response = JSONResponse(
                content=formatted_data,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
            formatted_response.headers["X-Process-Time"] = str(process_time)
            
            return formatted_response
        except Exception as e:
            logger.exception(f"格式化响应数据失败: {str(e)}")
            
            # 如果解析失败，则返回原始响应
            new_response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
            new_response.headers["X-Process-Time"] = str(process_time)
            return new_response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""
    
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """记录请求日志"""
        # 记录请求开始时间
        start_time = time.time()
        
        # 处理请求
        try:
            # 收集请求信息
            request_path = request.url.path
            request_method = request.method
            
            # 记录请求日志
            logger.debug(
                f"请求开始: {request_method} {request_path}",
                extra={
                    "method": request_method,
                    "path": request_path,
                    "query_params": str(request.query_params),
                },
            )
            
            # 调用下一个中间件
            response = await call_next(request)
            
            # 计算处理时间
            process_time = time.time() - start_time
            
            # 记录响应日志
            logger.debug(
                f"请求结束: {request_method} {request_path} - {response.status_code}",
                extra={
                    "method": request_method,
                    "path": request_path,
                    "status_code": response.status_code,
                    "process_time": process_time,
                },
            )
            
            return response
        except Exception as e:
            # 计算处理时间
            process_time = time.time() - start_time
            
            # 记录错误日志
            logger.error(
                f"请求处理错误: {request.method} {request.url.path} - {str(e)}",
                exc_info=True,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "process_time": process_time,
                },
            )
            
            # 重新抛出异常，让错误处理器处理
            raise


def setup_middlewares(app: FastAPI) -> None:
    """设置中间件"""
    # 添加请求日志中间件
    app.add_middleware(RequestLoggingMiddleware)
    
    # 添加响应格式化中间件
    app.add_middleware(ResponseFormatterMiddleware) 