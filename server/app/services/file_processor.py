import base64
import csv
import io
import logging
from typing import List, Dict, Any, Set, Tuple
import chardet

from app.schemas.dataset_upload import DatasetRowError, DatasetUploadPreviewResponse


class FileProcessorService:
    """文件处理服务"""
    
    # 状态字段的可能名称
    STATUS_FIELDS = {'is_enabled', '状态', 'enabled', 'status'}
    
    # 名称字段的可能名称  
    NAME_FIELDS = {'name', '名称', 'expected', 'target'}
    
    def __init__(self):
        self.max_preview_rows = 10
        self.max_error_rows = 100
    
    def decode_file_content(self, file_content: str) -> str:
        """解码Base64文件内容并检测编码格式"""
        try:
            # 解码Base64
            decoded_bytes = base64.b64decode(file_content)
            
            # 检测编码格式
            detected = chardet.detect(decoded_bytes)
            encoding = detected.get('encoding', 'utf-8')
            
            # 尝试多种编码格式
            encodings_to_try = [encoding, 'utf-8', 'gbk', 'gb2312', 'latin1']
            
            for enc in encodings_to_try:
                try:
                    return decoded_bytes.decode(enc)
                except (UnicodeDecodeError, TypeError):
                    continue
                    
            # 如果所有编码都失败，使用错误处理
            return decoded_bytes.decode('utf-8', errors='replace')
            
        except Exception as e:
            raise ValueError(f"文件解码失败: {str(e)}")
    
    def parse_csv_content(self, content: str) -> Tuple[List[str], List[Dict[str, str]]]:
        """解析CSV内容，返回表头和数据行"""
        try:            
            # 解析CSV
            reader = csv.DictReader(io.StringIO(content), delimiter=',', quotechar='"')
            headers = reader.fieldnames or []
            rows = list(reader)
            
            return headers, rows
            
        except Exception as e:
            raise ValueError(f"CSV解析失败: {str(e)}")
    
    def validate_headers(self, headers: List[str], variables: List[str]) -> Tuple[List[str], List[str]]:
        """验证表头字段"""
        headers_set = set(headers)
        
        # 检查必需字段
        missing_columns = []
        
        # 检查状态字段
        if not 'is_enabled' in headers_set:
            missing_columns.append("状态字段 (is_enabled/状态)")
        
        # 检查变量字段
        missing_vars = [var for var in variables if var not in headers_set]
        missing_columns.extend(missing_vars)
        
        # 检查额外字段
        required_fields = set(variables) | {'is_enabled'}
        extra_columns = [col for col in headers if col not in required_fields]
        
        return missing_columns, extra_columns
    
    def validate_row_data(self, row: Dict[str, str], row_number: int, variables: List[str]) -> List[DatasetRowError]:
        """验证单行数据"""
        errors = []
        
        # 检查状态字段
        if 'is_enabled' in row and row['is_enabled'] is not None:
            status_value = str(row['is_enabled']).strip().lower()
            if status_value not in {'0', '1', 'true', 'false', '启用', '禁用', 'enabled', 'disabled'}:
                errors.append(DatasetRowError(
                    row_number=row_number,
                    error_type="invalid_status",
                    error_message=f"状态字段值无效: {row['is_enabled']}，应为 0/1 或 true/false",
                    row_data=row
                ))
        
        # 检查变量字段
        for var in variables:
            if var not in row:
                errors.append(DatasetRowError(
                    row_number=row_number,
                    error_type="missing_variable",
                    error_message=f"变量字段 '{var}' 不能为空",
                    row_data=row
                ))
        
        return errors
    
    def normalize_row_data(self, row: Dict[str, str], variables: List[str]) -> Dict[str, Any]:
        """标准化行数据格式"""
        normalized = {}
        
        # 处理状态字段
        status_value = None
        for field in self.STATUS_FIELDS:
            if field in row and row[field] is not None:
                value = str(row[field]).strip().lower()
                if value in {'1', 'true', '启用', 'enabled'}:
                    status_value = True
                elif value in {'0', 'false', '禁用', 'disabled'}:
                    status_value = False
                break
        normalized['is_enabled'] = status_value
        
        # 处理名称字段
        name = row.get('name', row.get('名称', ''))
        for field in self.NAME_FIELDS:
            if field in row and row[field]:
                name = row[field].strip()
                break
        normalized['name'] = name.strip() if name else None
        
        # 处理变量字段
        variables_values = {}
        for var in variables:
            if var in row:
                variables_values[var] = row[var].strip() if row[var] else ""
        normalized['variables_values'] = variables_values
        
        return normalized
    
    def preview_dataset_upload(
        self, 
        file_content: str, 
        file_name: str, 
        variables: List[str]
    ) -> DatasetUploadPreviewResponse:
        """预览数据集上传文件"""
        try:
            # 解码文件内容
            content = self.decode_file_content(file_content)
            
            # 解析CSV
            headers, rows = self.parse_csv_content(content)
            
            # 验证表头
            missing_columns, extra_columns = self.validate_headers(headers, variables)
            
            # 验证数据行
            errors = []
            valid_rows = 0
            preview_data = []
            
            for i, row in enumerate(rows[:self.max_preview_rows]):
                row_number = i + 2  # CSV行号从2开始(第1行是表头)
                row_errors = self.validate_row_data(row, row_number, variables)
                
                if row_errors:
                    errors.extend(row_errors)
                else:
                    valid_rows += 1
                
                # 添加到预览数据
                preview_data.append(row)
            
            # 验证剩余行(不添加到预览数据中)
            for i, row in enumerate(rows[self.max_preview_rows:], start=self.max_preview_rows):
                row_number = i + 2
                row_errors = self.validate_row_data(row, row_number, variables)
                
                if not row_errors:
                    valid_rows += 1
                elif len(errors) < self.max_error_rows:
                    errors.extend(row_errors)
            
            total_rows = len(rows)
            invalid_rows = total_rows - valid_rows
            is_valid = len(missing_columns) == 0 and invalid_rows == 0
            
            return DatasetUploadPreviewResponse(
                is_valid=is_valid,
                total_rows=total_rows,
                valid_rows=valid_rows,
                invalid_rows=invalid_rows,
                headers=headers,
                preview_data=preview_data,
                errors=errors[:self.max_error_rows],
                missing_columns=missing_columns,
                extra_columns=extra_columns
            )
            
        except Exception as e:
            logging.error(f"预览数据集上传文件失败: {str(e)}", exc_info=True)
            return DatasetUploadPreviewResponse(
                is_valid=False,
                total_rows=0,
                valid_rows=0,
                invalid_rows=0,
                headers=[],
                preview_data=[],
                errors=[DatasetRowError(
                    row_number=0,
                    error_type="file_error",
                    error_message=str(e),
                    row_data={}
                )],
                missing_columns=[],
                extra_columns=[]
            )
    
    def process_upload_data(
        self, 
        file_content: str, 
        variables: List[str], 
        skip_invalid_rows: bool = True
    ) -> Tuple[List[Dict[str, Any]], List[DatasetRowError]]:
        """处理上传数据，返回标准化数据和错误列表"""
        # 解码和解析文件
        content = self.decode_file_content(file_content)
        headers, rows = self.parse_csv_content(content)
        
        # 验证表头
        missing_columns, _ = self.validate_headers(headers, variables)
        if missing_columns:
            raise ValueError(f"缺少必需字段: {', '.join(missing_columns)}")
        
        processed_data = []
        errors = []
        
        for i, row in enumerate(rows):
            row_number = i + 2  # CSV行号从2开始
            row_errors = self.validate_row_data(row, row_number, variables)
            
            if row_errors:
                errors.extend(row_errors)
                if not skip_invalid_rows:
                    continue
            else:
                # 标准化数据
                normalized_data = self.normalize_row_data(row, variables)
                processed_data.append(normalized_data)
        
        return processed_data, errors 