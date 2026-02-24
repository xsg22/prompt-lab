# LLM服务异步保存Request记录

## 修改概述

本次修改将LLM服务中的Request记录保存从同步方式改为异步方式，以提高API响应性能并避免数据库操作阻塞主请求流程。

## 修改内容

### 1. 新增异步保存方法

在`LLMService`类中新增了`_save_request_record_async`方法：

```python
async def _save_request_record_async(
    self,
    db,
    project_id: int,
    user_id: int,
    prompt_version_id: Optional[int],
    request_source: str,
    input_data: Dict[str, Any],
    variables_values: Dict[str, Any],
    output: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    execution_time: int,
    cost: str,
    success: bool,
    error_message: str = ""
) -> None:
```

该方法负责异步保存Request记录到数据库，具有以下特点：
- 使用独立的数据库会话
- 包含完整的错误处理
- 失败时不影响主流程，只记录日志

### 2. 修改call_llm方法

将原来的同步保存逻辑：

```python
# 原来的同步保存
async with get_db_session() as db:
    db.add(request_record)
    await db.commit()
```

改为异步保存：

```python
# 新的异步保存
create_task_with_session(
    self._save_request_record_async,
    project_id=project_id,
    user_id=user_id,
    prompt_version_id=prompt_version_id,
    request_source=request_source,
    input_data={"messages": messages},
    variables_values={},
    output=output,
    prompt_tokens=prompt_tokens,
    completion_tokens=completion_tokens,
    total_tokens=total_tokens,
    execution_time=execution_time,
    cost=str(cost),
    success=True,
    error_message="",
    task_name="save_llm_request_record"
)
```

### 3. 错误处理优化

对于LLM调用失败的情况，也使用异步方式保存错误记录：

```python
# 异步保存失败请求记录
create_task_with_session(
    self._save_request_record_async,
    project_id=project_id,
    user_id=user_id,
    prompt_version_id=prompt_version_id,
    request_source=request_source,
    input_data={"messages": [m.model_dump() for m in request.messages]},
    variables_values={},
    output=None,
    prompt_tokens=0,
    completion_tokens=0,
    total_tokens=0,
    execution_time=int((time.time() - start_time) * 1000) if 'start_time' in locals() else 0,
    cost="0",
    success=False,
    error_message=str(e),
    task_name="save_llm_error_record"
)
```

## 技术实现

### 1. 使用BackgroundTaskService

利用现有的`BackgroundTaskService`提供的`create_task_with_session`方法：

```python
from app.services.background_task_service import create_task_with_session
```

该方法确保：
- 每个异步任务都有独立的数据库会话
- 自动处理会话的生命周期
- 提供完整的错误处理和日志记录

### 2. 任务命名

为不同的保存任务指定了有意义的名称：
- `save_llm_request_record`: 成功请求的记录保存
- `save_llm_error_record`: 失败请求的记录保存

### 3. 错误隔离

异步保存失败不会影响主请求流程：
- 保存失败只记录错误日志
- 不会抛出异常影响API响应
- 保证用户体验的连续性

## 性能优势

### 1. 响应时间优化
- 主请求不再等待数据库写入操作
- API响应时间显著减少
- 用户体验得到改善

### 2. 并发处理能力
- 数据库写入操作在后台异步执行
- 提高系统的并发处理能力
- 减少数据库连接占用时间

### 3. 系统稳定性
- 数据库写入失败不影响主流程
- 提高系统的容错能力
- 减少因数据库问题导致的API失败

## 注意事项

### 1. 数据一致性
- 异步保存可能导致数据延迟写入
- 在极端情况下可能出现数据丢失
- 对于需要立即查询保存数据的场景，需要考虑同步保存

### 2. 监控和日志
- 需要监控异步任务的执行情况
- 关注保存失败的错误日志
- 定期检查数据完整性

### 3. 资源管理
- 异步任务会占用额外的系统资源
- 需要合理控制并发任务数量
- 监控内存和CPU使用情况

## 测试建议

### 1. 功能测试
- 验证成功请求的记录保存
- 验证失败请求的错误记录保存
- 检查数据完整性

### 2. 性能测试
- 对比修改前后的API响应时间
- 测试高并发场景下的表现
- 验证异步任务的执行效率

### 3. 错误处理测试
- 模拟数据库连接失败
- 测试异步保存失败的情况
- 验证错误日志记录

## 总结

本次修改成功将LLM服务的Request记录保存改为异步方式，在保持数据完整性的同时显著提升了API响应性能。通过使用现有的BackgroundTaskService框架，确保了代码的一致性和可维护性。 