from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.dataset_upload import UploadStatus


class DatasetUploadPreviewRequest(BaseModel):
    """数据集上传预览请求"""
    file_content: str = Field(..., description="Base64编码的CSV文件内容")
    file_name: str = Field(..., description="文件名")


class DatasetRowError(BaseModel):
    """数据行错误信息"""
    row_number: int = Field(..., description="行号")
    error_type: str = Field(..., description="错误类型")
    error_message: str = Field(..., description="错误消息")
    row_data: Dict[str, Any] = Field(..., description="行数据")


class DatasetUploadPreviewResponse(BaseModel):
    """数据集上传预览响应"""
    is_valid: bool = Field(..., description="文件是否有效")
    total_rows: int = Field(..., description="总行数")
    valid_rows: int = Field(..., description="有效行数")
    invalid_rows: int = Field(..., description="无效行数")
    headers: List[str] = Field(..., description="表头字段")
    preview_data: List[Dict[str, Any]] = Field(..., description="预览数据(前10行)")
    errors: List[DatasetRowError] = Field(default_factory=list, description="错误列表")
    missing_columns: List[str] = Field(default_factory=list, description="缺失的必需列")
    extra_columns: List[str] = Field(default_factory=list, description="额外的列")


class DatasetUploadStartRequest(BaseModel):
    """开始数据集上传请求"""
    file_content: str = Field(..., description="Base64编码的CSV文件内容")
    file_name: str = Field(..., description="文件名")
    skip_invalid_rows: bool = Field(default=True, description="是否跳过无效行")


class DatasetUploadTask(BaseModel):
    """数据集上传任务"""
    id: int = Field(..., description="任务ID")
    dataset_id: int = Field(..., description="数据集ID")
    user_id: int = Field(..., description="用户ID")
    status: UploadStatus = Field(..., description="状态")
    total_rows: int = Field(..., description="总行数")
    processed_rows: int = Field(..., description="已处理行数")
    success_rows: int = Field(..., description="成功行数")
    failed_rows: int = Field(..., description="失败行数")
    file_name: Optional[str] = Field(None, description="文件名")
    error_details: Optional[Dict[str, Any]] = Field(None, description="错误详情")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")

    class Config:
        from_attributes = True


class DatasetUploadStartResponse(BaseModel):
    """开始上传响应"""
    task_id: int = Field(..., description="任务ID")
    message: str = Field(..., description="响应消息")


class DatasetUploadStatusResponse(BaseModel):
    """上传状态响应"""
    task: DatasetUploadTask = Field(..., description="任务信息")
    progress_percentage: float = Field(..., description="进度百分比")
    estimated_time_remaining: Optional[int] = Field(None, description="预计剩余时间(秒)")


class DatasetUploadError(BaseModel):
    """上传错误记录"""
    id: int = Field(..., description="错误ID")
    upload_task_id: int = Field(..., description="上传任务ID")
    row_number: int = Field(..., description="行号")
    error_type: str = Field(..., description="错误类型")
    error_message: Optional[str] = Field(None, description="错误消息")
    row_data: Optional[Dict[str, Any]] = Field(None, description="行数据")
    created_at: datetime = Field(..., description="创建时间")

    class Config:
        from_attributes = True


class DatasetUploadRetryRequest(BaseModel):
    """重试上传请求"""
    task_id: int = Field(..., description="原任务ID")
    retry_failed_only: bool = Field(default=True, description="是否只重试失败的行")


class DatasetUploadResultResponse(BaseModel):
    """上传结果响应"""
    task: DatasetUploadTask = Field(..., description="任务信息")
    errors: List[DatasetUploadError] = Field(default_factory=list, description="错误列表")
    success_rate: float = Field(..., description="成功率")
    has_errors: bool = Field(..., description="是否有错误") 