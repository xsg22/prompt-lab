from typing import Any, Dict, Optional, Union

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.logging import get_logger

logger = get_logger(__name__)


class APIError(Exception):
    """API错误基类"""
    
    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        code: str = "internal_error",
        message: str = "服务器内部错误",
        details: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        super().__init__(message)


class NotFoundError(APIError):
    """资源未找到错误"""
    
    def __init__(
        self,
        message: str = "资源未找到",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code="not_found",
            message=message,
            details=details,
        )


class BadRequestError(APIError):
    """错误的请求错误"""
    
    def __init__(
        self,
        message: str = "无效的请求参数",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="bad_request",
            message=message,
            details=details,
        )


class UnauthorizedError(APIError):
    """未授权错误"""
    
    def __init__(
        self,
        message: str = "未授权",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="unauthorized",
            message=message,
            details=details,
        )


class ForbiddenError(APIError):
    """禁止访问错误"""
    
    def __init__(
        self,
        message: str = "没有访问权限",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code="forbidden",
            message=message,
            details=details,
        )


class DatabaseError(APIError):
    """数据库错误"""
    
    def __init__(
        self,
        message: str = "数据库操作错误",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="database_error",
            message=message,
            details=details,
        )


def create_error_response(
    status_code: int, code: str, message: str, details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """创建错误响应"""
    response = {
        "error": {
            "code": code,
            "message": message,
        }
    }
    
    if details:
        response["error"]["details"] = details
    
    return response


def setup_error_handlers(app: FastAPI) -> None:
    """设置错误处理器"""
    
    @app.exception_handler(APIError)
    async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
        """处理自定义API错误"""
        logger.error(
            f"APIError: {exc.code}, {exc.message}",
            extra={
                "status_code": exc.status_code,
                "code": exc.code,
                "details": exc.details,
                "url": str(request.url),
                "method": request.method,
            },
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content=create_error_response(
                status_code=exc.status_code,
                code=exc.code,
                message=exc.message,
                details=exc.details,
            ),
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """处理请求验证错误"""
        details = []
        for error in exc.errors():
            details.append({
                "field": error["loc"][-1] if error["loc"] else None,
                "path": " > ".join(str(loc) for loc in error["loc"]) if error["loc"] else None,
                "message": error["msg"],
                "type": error["type"],
            })
        
        logger.error(
            "请求验证错误",
            extra={
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "code": "validation_error",
                "details": details,
                "url": str(request.url),
                "method": request.method,
            },
            exc_info=True,
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="validation_error",
                message="请求参数验证失败",
                details={"errors": details},
            ),
        )
    
    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """处理数据库错误"""
        logger.error(
            f"数据库错误: {str(exc)}",
            exc_info=True,
            extra={
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "code": "database_error",
                "url": str(request.url),
                "method": request.method,
            },
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="database_error",
                message="数据库操作失败",
            ),
        )
    
    @app.exception_handler(ValidationError)
    async def pydantic_validation_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        """处理Pydantic验证错误"""
        details = []
        for error in exc.errors():
            details.append({
                "field": error["loc"][-1] if error["loc"] else None,
                "path": " > ".join(str(loc) for loc in error["loc"]) if error["loc"] else None,
                "message": error["msg"],
                "type": error["type"],
            })
        
        logger.error(
            "Pydantic验证错误",
            extra={
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "code": "validation_error",
                "details": details,
                "url": str(request.url),
                "method": request.method,
            },
        )
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="validation_error",
                message="数据验证失败",
                details={"errors": details},
            ),
        )
    
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        """处理未处理的异常"""
        logger.exception(
            f"未处理的异常: {str(exc)} {str(request.url)} {str(request.method)}",
            extra={
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "code": "internal_error",
                "url": str(request.url),
                "method": request.method,
            },
        )
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="internal_error",
                message="服务器内部错误",
            ),
        ) 