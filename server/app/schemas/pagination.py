from typing import Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

# 通用数据类型
T = TypeVar('T')


class PaginationParams(BaseModel):
    """分页请求参数"""
    
    page: int = Field(default=1, ge=1, description="页码，从1开始")
    page_size: int = Field(default=20, ge=1, le=100, description="每页条数，最大100")
    

class SortParams(BaseModel):
    """排序参数"""
    
    sort_by: Optional[str] = Field(default="created_at", description="排序字段")
    sort_order: Optional[str] = Field(default="desc", pattern="^(asc|desc)$", description="排序方向")


class SearchParams(BaseModel):
    """搜索参数"""
    
    search: Optional[str] = Field(default="", description="搜索关键词")


class PaginationMeta(BaseModel):
    """分页元数据"""
    
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页条数")
    total: int = Field(..., description="总条数")
    total_pages: int = Field(..., description="总页数")
    has_next: bool = Field(..., description="是否有下一页")
    has_prev: bool = Field(..., description="是否有上一页")


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应结构"""
    
    data: List[T] = Field(..., description="数据列表")
    meta: PaginationMeta = Field(..., description="分页元数据")
    
    @classmethod
    def create(
        cls,
        data: List[T],
        total: int,
        page: int,
        page_size: int
    ) -> "PaginatedResponse[T]":
        """创建分页响应"""
        total_pages = (total + page_size - 1) // page_size  # 向上取整
        
        return cls(
            data=data,
            meta=PaginationMeta(
                page=page,
                page_size=page_size,
                total=total,
                total_pages=total_pages,
                has_next=page < total_pages,
                has_prev=page > 1,
            )
        ) 