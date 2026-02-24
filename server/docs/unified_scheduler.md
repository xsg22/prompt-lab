# 统一任务调度器设计文档

## 概述

统一任务调度器 (`EvalTaskScheduler`) 是一个扩展后的调度系统，支持同时调度传统的列任务 (`EvalTask`) 和新的行任务 (`EvalResultRowTask`)，提供统一的任务管理、并发控制、重试机制和超时处理。

## 核心架构

### 1. 统一任务接口

#### SchedulableTask (抽象基类)
所有可调度任务的统一接口，定义了以下属性和方法：
- `id`: 任务ID
- `task_type`: 任务类型标识
- `status`: 任务状态
- `priority`: 任务优先级
- `result_id`: 关联的评估结果ID
- `execute(executor)`: 异步执行方法

#### ColumnTaskAdapter (列任务适配器)
将 `EvalTask` 包装成统一接口：
- 任务类型: `"column_task"`
- 执行器: `EvalTaskExecutor`
- 优先级: 使用任务原有的优先级

#### RowTaskAdapter (行任务适配器)
将 `EvalResultRowTask` 包装成统一接口：
- 任务类型: `"row_task"`
- 执行器: `EvalRowTaskExecutor`
- 优先级: 固定为100（可配置）

### 2. 调度器核心功能

#### 任务调度逻辑
```python
async def schedule_pending_tasks(self) -> None:
    """调度待执行任务"""
    # 1. 检查并发限制
    # 2. 获取待执行的列任务和行任务
    # 3. 按优先级和result_id排序
    # 4. 启动任务执行
```

#### 任务标识管理
- 使用 `"type:id"` 格式的字符串作为任务唯一标识
- 例如: `"column_task:123"`, `"row_task:456"`, `"row_batch:789"`

#### 并发控制
- 统一的最大并发任务数限制
- 活跃任务集合管理 (`_active_tasks: Set[str]`)
- 支持列任务和行任务混合调度

### 3. 执行模式

#### 自动调度模式
调度器定期扫描待执行任务：
- 列任务: 从 `eval_tasks` 表获取 `pending` 状态的任务
- 行任务: 从 `eval_result_row_tasks` 表获取 `pending` 状态的任务
- 按优先级和创建时间排序执行

#### 强制调度模式
支持手动触发特定任务的执行：
```python
# 强制调度行任务批次
await scheduler.force_schedule_row_task_batch(result_id, dataset_item_ids)
```

### 4. 任务执行流程

#### 列任务执行流程
1. 从 `eval_tasks` 表获取待执行任务
2. 通过 `ColumnTaskAdapter` 包装
3. 使用 `EvalTaskExecutor` 执行
4. 更新任务状态和统计信息

#### 行任务执行流程
1. 从 `eval_result_row_tasks` 表获取待执行任务
2. 通过 `RowTaskAdapter` 包装
3. 使用 `EvalRowTaskExecutor` 执行单个行任务
4. 或者通过批次模式执行多个行任务

#### 行任务批次执行
```python
async def force_schedule_row_task_batch(self, result_id: int, dataset_item_ids: List[int]) -> bool:
    # 1. 检查调度槽位
    # 2. 创建批次执行任务
    # 3. 异步执行整个批次
    # 4. 管理活跃任务状态
```

### 5. 重试和容错机制

#### 列任务重试
- 支持现有的重试机制
- 基于 `next_retry_at` 字段调度重试

#### 行任务重试
- 当前暂不支持自动重试
- 可通过重置状态手动重试

#### 中断恢复
- 启动时检查中断的任务
- 分别处理列任务和行任务的中断恢复

### 6. 超时处理

#### 统一超时检查
```python
async def _cleanup_timeout_tasks(self) -> None:
    # 1. 清理超时的列任务
    # 2. 清理超时的行任务
```

#### 超时处理策略
- 列任务: 标记为 `FAILED`，记录错误信息
- 行任务: 标记为 `FAILED`，更新状态

## 使用方法

### 1. 启动调度器

#### 程序启动时自动启动
```python
from app.services.eval_task_scheduler import start_global_scheduler

await start_global_scheduler()
```

#### 手动控制调度器
```python
from app.services.eval_task_scheduler import get_scheduler

scheduler = await get_scheduler()
await scheduler.start_scheduler()  # 启动
await scheduler.pause_scheduler()  # 暂停
await scheduler.resume_scheduler() # 恢复
await scheduler.stop_scheduler()   # 停止
```

### 2. 调度行任务

#### 通过 EvalRowTaskManager
```python
from app.services.eval_row_task_manager import EvalRowTaskManager

manager = EvalRowTaskManager()

# 通过调度器执行（推荐）
await manager.execute_row_tasks_batch(request)

# 直接执行（测试用）
await manager.execute_row_tasks_directly(result_id, dataset_item_ids)
```

#### 通过调度器强制执行
```python
scheduler = await get_scheduler()
success = await scheduler.force_schedule_row_task_batch(result_id, dataset_item_ids)
```

### 3. 监控调度器状态

#### 获取状态信息
```python
status = await scheduler.get_scheduler_status()
```

返回信息包括：
- `running`: 调度器是否运行中
- `active_tasks`: 活跃任务总数
- `active_column_tasks`: 活跃列任务数
- `active_row_tasks`: 活跃行任务数
- `active_task_keys`: 活跃任务标识列表
- `max_concurrent_tasks`: 最大并发任务数

#### API 端点
```bash
# 获取调度器状态
GET /api/evaluations/scheduler/status

# 启动调度器
POST /api/evaluations/scheduler/start

# 停止调度器
POST /api/evaluations/scheduler/stop
```

## 配置选项

### 调度器配置
在 `app.core.eval_config` 中配置：
- `get_max_concurrent_tasks()`: 最大并发任务数
- `get_scheduler_interval_seconds()`: 调度检查间隔
- `get_task_timeout_minutes()`: 任务超时时间

### 任务优先级
- 列任务: 使用数据库中的 `priority` 字段
- 行任务: 默认优先级100（可在 `RowTaskAdapter` 中调整）

## 扩展指南

### 添加新任务类型
1. 创建任务适配器实现 `SchedulableTask` 接口
2. 在 `_get_pending_tasks_unified` 中添加获取逻辑
3. 在 `_execute_task_with_cleanup` 中添加执行逻辑
4. 实现相应的重试和超时处理

### 自定义执行策略
- 修改 `_get_pending_tasks_unified` 的排序逻辑
- 实现自定义的负载均衡策略
- 添加基于资源的调度决策

## 性能优化

### 数据库查询优化
- 使用索引优化任务查询
- 限制每次查询的任务数量
- 使用分页查询大量任务

### 并发控制优化
- 根据系统资源动态调整并发数
- 实现任务优先级队列
- 支持不同类型任务的独立并发限制

### 内存管理
- 及时清理完成的任务引用
- 避免长时间持有大对象
- 实现任务状态的缓存机制

## 故障排查

### 常见问题
1. **调度器不工作**: 检查是否正确启动，查看错误日志
2. **任务堆积**: 检查并发限制、任务执行时间、资源使用
3. **任务重复执行**: 检查任务标识生成、状态更新时机
4. **内存泄漏**: 检查任务清理逻辑、异常处理

### 日志分析
调度器使用结构化日志记录关键事件：
- 调度器启动/停止
- 任务调度/执行/完成
- 错误和异常信息
- 性能统计数据

### 监控指标
建议监控的关键指标：
- 活跃任务数
- 任务执行时间分布
- 成功/失败任务比例
- 调度器资源使用情况 