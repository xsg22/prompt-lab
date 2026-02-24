# 数据集上传服务异步任务修复方案

## 问题描述

在数据集上传服务中，原来的实现存在数据库会话管理的问题：

```python
# 原有问题代码
async with AsyncSessionLocal() as db:
    upload_service = DatasetUploadService(db)
    asyncio.create_task(upload_service._execute_upload_task(upload_task.id, processed_data))
```

**错误信息：**
```
sqlalchemy.exc.IllegalStateChangeError: Method 'close()' can't be called here; method '_connection_for_bind()' is already in progress and this would cause an unexpected state change to <SessionTransactionState.CLOSED: 5>
```

**根本原因：**
1. 在 `async with` 语句块中创建了异步任务
2. 异步任务的生命周期超过了数据库会话的生命周期
3. 当 `async with` 块退出时，SQLAlchemy 试图关闭会话，但异步任务仍在运行并使用该会话

## 解决方案

### 1. 创建通用的背景任务服务

创建了 `BackgroundTaskService` 类来统一管理异步后台任务：

```python
# app/services/background_task_service.py
class BackgroundTaskService:
    @staticmethod
    def create_task_with_session(
        task_func: Callable[..., Coroutine[Any, Any, Any]],
        *args,
        task_name: Optional[str] = None,
        **kwargs
    ) -> asyncio.Task:
        """创建带有独立数据库会话的异步任务"""
```

**核心特性：**
- 为每个异步任务创建独立的数据库会话
- 自动错误处理和日志记录
- 任务生命周期管理
- 支持任务命名和监控

### 2. 修改数据集上传服务

**修改前：**
```python
# 错误的方式
async with AsyncSessionLocal() as db:
    upload_service = DatasetUploadService(db)
    asyncio.create_task(upload_service._execute_upload_task(upload_task.id, processed_data))
```

**修改后：**
```python
# 正确的方式
create_task_with_session(
    self._execute_upload_task,
    upload_task.id,
    processed_data,
    task_name=f"dataset_upload_{upload_task.id}"
)
```

### 3. 异步任务方法签名修改

**修改前：**
```python
async def _execute_upload_task(self, task_id: int, data: List[Dict[str, Any]]):
    # 使用 self.db（可能存在并发问题）
```

**修改后：**
```python
async def _execute_upload_task(self, db: AsyncSession, task_id: int, data: List[Dict[str, Any]]):
    # 使用独立的数据库会话
    upload_service = DatasetUploadService(db)
```

## 技术优势

### 1. 会话隔离
- 每个异步任务都有独立的数据库会话
- 避免了会话状态冲突和并发问题
- 提高了系统的稳定性

### 2. 错误处理
- 统一的异常处理机制
- 详细的错误日志记录
- 优雅的失败处理

### 3. 可维护性
- 代码结构清晰，职责分明
- 可复用的背景任务服务
- 易于测试和调试

### 4. 可扩展性
- 可以轻松添加新的后台任务类型
- 支持任务监控和管理
- 为未来的任务队列系统奠定基础

## 使用示例

### 基本用法
```python
from app.services.background_task_service import create_task_with_session

# 创建需要数据库会话的后台任务
create_task_with_session(
    my_async_function,
    arg1, arg2,
    task_name="my_task",
    keyword_arg=value
)
```

### 在服务中使用
```python
class MyService:
    async def start_background_process(self, data):
        # 使用背景任务服务启动异步处理
        create_task_with_session(
            self._process_data,
            data,
            task_name=f"process_{data.id}"
        )
    
    async def _process_data(self, db: AsyncSession, data):
        # 这里可以安全地使用数据库会话
        service = MyService(db)
        # 执行具体业务逻辑
```

## 其他改进建议

### 1. 使用任务队列
对于生产环境，建议考虑使用专业的任务队列系统：
- Celery + Redis/RabbitMQ
- APScheduler
- FastAPI 背景任务

### 2. 任务监控
- 添加任务状态跟踪
- 实现任务重试机制
- 添加任务执行时间监控

### 3. 资源管理
- 控制并发任务数量
- 实现任务优先级
- 添加资源使用监控

## 总结

通过引入专门的背景任务服务，我们成功解决了数据库会话并发冲突的问题，同时提高了代码的可维护性和可扩展性。这个方案不仅修复了当前的问题，还为未来的功能扩展提供了良好的基础。 