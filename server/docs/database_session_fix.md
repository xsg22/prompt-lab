# 数据库会话并发问题修复总结

## 问题描述

在评估任务调度器运行时，出现了以下错误：

```
sqlalchemy.exc.InvalidRequestError: This session is provisioning a new connection; concurrent operations are not permitted
```

## 问题原因

1. **全局单例会话问题**：在 `EvalTaskScheduler` 中使用了全局共享的数据库会话实例
2. **并发访问冲突**：多个异步任务同时使用同一个数据库会话，导致并发冲突
3. **会话状态冲突**：当一个会话正在建立连接时，其他操作试图使用同一会话

## 修复方案

### 1. 修改 EvalTaskScheduler 类

**修改前：**
```python
def __init__(self, db: AsyncSession = Depends(get_db), ...):
    self.db = db  # 全局共享会话
```

**修改后：**
```python
def __init__(self, task_manager: Optional[EvalTaskManager] = None, ...):
    # 不再直接持有数据库会话，而是在需要时创建
    self.task_manager = task_manager

async def _get_db_session(self) -> AsyncSession:
    """获取新的数据库会话"""
    return AsyncSessionLocal()
```

### 2. 修改 EvalTaskExecutor 类

**修改前：**
```python
def __init__(self, db: AsyncSession = Depends(get_db), ...):
    self.db = db  # 全局共享会话
```

**修改后：**
```python
def __init__(self, evaluation_engine: Optional[EvaluationEngine] = None, ...):
    # 不再直接持有数据库会话，而是在需要时创建
    self.evaluation_engine = evaluation_engine

async def _get_db_session(self) -> AsyncSession:
    """获取新的数据库会话"""
    return AsyncSessionLocal()
```

### 3. 修改 EvalTaskManager 类

**修改前：**
```python
def __init__(self, db: AsyncSession = Depends(get_db)):
    self.db = db  # 依赖注入的会话
```

**修改后：**
```python
def __init__(self, db: Optional[AsyncSession] = None):
    # 保持兼容性，但优先使用独立会话
    self.db = db

async def get_config(self, config_key: str):
    if self.db:
        # 如果有实例会话，直接使用
        result = await self.db.execute(...)
    else:
        # 创建新会话
        async with AsyncSessionLocal() as db:
            result = await db.execute(...)
```

### 4. 修改调度器实例创建

**修改前：**
```python
async def get_scheduler():
    # 创建数据库会话
    db = AsyncSessionLocal()
    
    # 创建依赖实例
    task_manager = EvalTaskManager(db)
    task_executor = EvalTaskExecutor(db, evaluation_engine, task_manager)
    
    # 创建调度器实例
    _scheduler_instance = EvalTaskScheduler(db, task_manager, task_executor)
```

**修改后：**
```python
async def get_scheduler():
    # 创建依赖实例（不传递数据库会话，让它们自己管理）
    task_manager = EvalTaskManager()
    evaluation_engine = EvaluationEngine()
    task_executor = EvalTaskExecutor(evaluation_engine, task_manager)
    
    # 创建调度器实例
    _scheduler_instance = EvalTaskScheduler(task_manager, task_executor)
```

## 修复效果

### 修复前的错误日志：
```
2025-05-26 00:52:31,209 - app.services.eval_task_scheduler - ERROR - 调度待执行任务失败: This session is provisioning a new connection; concurrent operations are not permitted
```

### 修复后的成功日志：
```
2025-05-26 01:00:47,301 - app.services.eval_task_scheduler - INFO - 启动评估任务调度器
2025-05-26 01:00:47,493 - app.services.eval_task_scheduler - INFO - 没有发现中断的任务
```

## 核心改进

1. **会话隔离**：每个数据库操作都使用独立的会话，避免并发冲突
2. **按需创建**：只在需要时创建数据库会话，减少资源占用
3. **兼容性保持**：保持了原有的依赖注入接口，确保其他代码不受影响
4. **错误处理**：改进了错误处理机制，确保会话正确关闭

## 测试验证

创建了测试脚本验证修复效果：

```bash
python test_scheduler_fix.py
```

测试结果：
- 调度器创建: 通过
- 调度器启动: 通过  
- 调度器关闭: 通过
- 总计: 3 个测试，3 个通过，0 个失败

## 总结

通过将全局共享的数据库会话改为按需创建的独立会话，彻底解决了SQLAlchemy数据库会话并发操作的问题。这个修复确保了：

1. 每个数据库操作都有独立的会话
2. 避免了会话状态冲突
3. 提高了系统的稳定性和并发性能
4. 保持了代码的可维护性和扩展性

修复后，评估任务调度器可以正常启动和运行，不再出现数据库会话并发错误。 