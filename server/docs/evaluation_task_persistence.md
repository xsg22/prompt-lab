# 评估任务持久化技术设计文档

## 1. 项目背景

### 1.1 现状分析

当前的评估系统存在以下问题：

1. **任务执行不可靠**：评估任务在内存中执行，服务重启或异常会导致任务丢失
2. **无法恢复**：任务失败后无法自动重试或手动恢复
3. **状态不透明**：任务执行状态无法持久化跟踪
4. **资源浪费**：重复的任务无法有效管理

### 1.2 目标

设计一个可靠的评估任务执行系统，具备以下特性：

1. **持久化存储**：任务状态和进度持久化到数据库
2. **故障恢复**：服务重启后能够恢复未完成的任务
3. **重试机制**：支持失败任务的自动重试
4. **状态管理**：完整的任务生命周期状态管理
5. **并发控制**：支持多个任务并发执行
6. **监控能力**：提供任务执行监控和统计

## 2. 技术方案设计

### 2.1 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Layer     │    │  Task Manager   │    │  Task Worker    │
│                 │    │                 │    │                 │
│ - 创建任务      │───▶│ - 任务调度      │───▶│ - 任务执行      │
│ - 查询状态      │    │ - 状态管理      │    │ - 结果更新      │
│ - 取消任务      │    │ - 重试控制      │    │ - 错误处理      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer                               │
│                                                                 │
│ - eval_tasks (任务表)                                          │
│ - eval_task_items (任务项表)                                   │
│ - eval_task_logs (任务日志表)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据库设计

#### 2.2.1 评估任务表 (eval_tasks)

```sql
CREATE TABLE eval_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pipeline_id INT NOT NULL,
    column_id INT NOT NULL,
    user_id INT NOT NULL,
    task_type VARCHAR(64) NOT NULL DEFAULT 'column_evaluation',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    priority INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    current_retry INT NOT NULL DEFAULT 0,
    total_items INT NOT NULL DEFAULT 0,
    completed_items INT NOT NULL DEFAULT 0,
    failed_items INT NOT NULL DEFAULT 0,
    config JSON,
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    next_retry_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (pipeline_id) REFERENCES eval_pipelines(id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES eval_columns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_status_priority (status, priority),
    INDEX idx_next_retry (next_retry_at),
    INDEX idx_pipeline_column (pipeline_id, column_id)
);
```

#### 2.2.2 评估任务项表 (eval_task_items)

```sql
CREATE TABLE eval_task_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    cell_id INT NOT NULL,
    dataset_item_id INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    input_data JSON,
    output_data JSON,
    error_message TEXT,
    execution_time_ms INT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES eval_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (cell_id) REFERENCES eval_cells(id) ON DELETE CASCADE,
    FOREIGN KEY (dataset_item_id) REFERENCES dataset_items(id) ON DELETE CASCADE,
    
    INDEX idx_task_status (task_id, status),
    INDEX idx_cell_id (cell_id),
    UNIQUE KEY uk_task_cell (task_id, cell_id)
);
```

#### 2.2.3 评估任务日志表 (eval_task_logs)

```sql
CREATE TABLE eval_task_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    task_item_id INT NULL,
    level VARCHAR(16) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (task_id) REFERENCES eval_tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (task_item_id) REFERENCES eval_task_items(id) ON DELETE CASCADE,
    
    INDEX idx_task_level (task_id, level),
    INDEX idx_created_at (created_at)
);
```

### 2.3 任务状态定义

#### 2.3.1 任务状态 (eval_tasks.status)

- `pending`: 等待执行
- `running`: 正在执行
- `paused`: 已暂停
- `completed`: 已完成
- `failed`: 执行失败
- `cancelled`: 已取消
- `retrying`: 重试中

#### 2.3.2 任务项状态 (eval_task_items.status)

- `pending`: 等待执行
- `running`: 正在执行
- `completed`: 执行成功
- `failed`: 执行失败
- `skipped`: 已跳过

### 2.4 核心组件设计

#### 2.4.1 任务管理器 (TaskManager)

```python
class EvalTaskManager:
    """评估任务管理器"""
    
    async def create_task(self, pipeline_id: int, column_id: int, user_id: int, 
                         config: Dict[str, Any]) -> EvalTask:
        """创建评估任务"""
        
    async def start_task(self, task_id: int) -> bool:
        """启动任务"""
        
    async def pause_task(self, task_id: int) -> bool:
        """暂停任务"""
        
    async def cancel_task(self, task_id: int) -> bool:
        """取消任务"""
        
    async def retry_task(self, task_id: int) -> bool:
        """重试任务"""
        
    async def get_task_status(self, task_id: int) -> Dict[str, Any]:
        """获取任务状态"""
        
    async def cleanup_completed_tasks(self, days: int = 7) -> int:
        """清理已完成的任务"""
```

#### 2.4.2 任务执行器 (TaskExecutor)

```python
class EvalTaskExecutor:
    """评估任务执行器"""
    
    async def execute_task(self, task_id: int) -> bool:
        """执行任务"""
        
    async def execute_task_item(self, task_item_id: int) -> bool:
        """执行单个任务项"""
        
    async def handle_task_failure(self, task_id: int, error: Exception) -> None:
        """处理任务失败"""
        
    async def update_progress(self, task_id: int) -> None:
        """更新任务进度"""
```

#### 2.4.3 任务调度器 (TaskScheduler)

```python
class EvalTaskScheduler:
    """评估任务调度器"""
    
    async def start_scheduler(self) -> None:
        """启动调度器"""
        
    async def stop_scheduler(self) -> None:
        """停止调度器"""
        
    async def schedule_pending_tasks(self) -> None:
        """调度待执行任务"""
        
    async def schedule_retry_tasks(self) -> None:
        """调度重试任务"""
        
    async def recover_interrupted_tasks(self) -> None:
        """恢复中断的任务"""
```

### 2.5 重试机制设计

#### 2.5.1 重试策略

1. **指数退避**：重试间隔逐渐增加
   - 第1次重试：立即
   - 第2次重试：30秒后
   - 第3次重试：2分钟后
   - 第4次重试：5分钟后

2. **最大重试次数**：默认3次，可配置

3. **重试条件**：
   - 网络错误
   - 临时性API错误
   - 超时错误
   - 不重试：配置错误、权限错误等

#### 2.5.2 重试实现

```python
async def calculate_next_retry_time(retry_count: int) -> datetime:
    """计算下次重试时间"""
    delays = [0, 30, 120, 300]  # 秒
    delay = delays[min(retry_count, len(delays) - 1)]
    return datetime.now() + timedelta(seconds=delay)

async def should_retry(error: Exception, retry_count: int, max_retries: int) -> bool:
    """判断是否应该重试"""
    if retry_count >= max_retries:
        return False
    
    # 根据错误类型判断
    if isinstance(error, (NetworkError, TimeoutError, TemporaryAPIError)):
        return True
    
    return False
```

### 2.6 并发控制

#### 2.6.1 任务级并发

- 同一时间最多执行N个任务（可配置，默认5个）
- 使用信号量控制并发数量
- 优先级队列调度

#### 2.6.2 任务项级并发

- 单个任务内的任务项可并发执行
- 每个任务最多M个并发项（可配置，默认10个）
- 避免对同一资源的并发访问

### 2.7 监控和日志

#### 2.7.1 任务监控指标

- 任务总数、成功数、失败数
- 平均执行时间
- 重试次数统计
- 错误类型分布

#### 2.7.2 日志记录

- 任务生命周期事件
- 错误详情和堆栈
- 性能指标
- 用户操作记录

## 3. 实施计划

### 3.1 第一阶段：数据库设计和基础模型

1. 创建数据库表结构
2. 实现ORM模型
3. 创建基础的CRUD操作

### 3.2 第二阶段：任务管理核心功能

1. 实现TaskManager类
2. 实现任务创建和状态管理
3. 实现基础的任务执行逻辑

### 3.3 第三阶段：任务执行和重试机制

1. 实现TaskExecutor类
2. 实现重试机制
3. 实现错误处理和恢复

### 3.4 第四阶段：调度器和并发控制

1. 实现TaskScheduler类
2. 实现并发控制
3. 实现任务优先级调度

### 3.5 第五阶段：监控和优化

1. 实现监控指标收集
2. 实现任务清理机制
3. 性能优化和测试

## 4. 技术细节

### 4.1 事务管理

- 使用数据库事务确保数据一致性
- 任务状态更新和结果保存在同一事务中
- 避免长事务，及时提交

### 4.2 错误处理

- 分类错误类型（可重试/不可重试）
- 记录详细错误信息
- 提供错误恢复建议

### 4.3 性能优化

- 使用批量操作减少数据库访问
- 实现任务项的批量更新
- 使用连接池管理数据库连接
- 实现任务结果缓存

### 4.4 安全考虑

- 任务权限验证
- 敏感数据加密存储
- 防止任务重复提交
- 资源使用限制

## 5. 配置参数

```python
class EvalTaskConfig:
    # 并发控制
    MAX_CONCURRENT_TASKS = 5
    MAX_CONCURRENT_ITEMS_PER_TASK = 10
    
    # 重试配置
    DEFAULT_MAX_RETRIES = 3
    RETRY_DELAYS = [0, 30, 120, 300]  # 秒
    
    # 清理配置
    COMPLETED_TASK_RETENTION_DAYS = 7
    FAILED_TASK_RETENTION_DAYS = 30
    
    # 监控配置
    METRICS_COLLECTION_INTERVAL = 60  # 秒
    LOG_LEVEL = "INFO"
```

## 6. API接口设计

### 6.1 任务管理接口

```python
# 创建任务
POST /api/eval-tasks
{
    "pipeline_id": 1,
    "column_id": 2,
    "config": {...}
}

# 获取任务状态
GET /api/eval-tasks/{task_id}

# 获取任务列表
GET /api/eval-tasks?pipeline_id=1&status=running

# 暂停任务
POST /api/eval-tasks/{task_id}/pause

# 恢复任务
POST /api/eval-tasks/{task_id}/resume

# 取消任务
POST /api/eval-tasks/{task_id}/cancel

# 重试任务
POST /api/eval-tasks/{task_id}/retry
```

### 6.2 监控接口

```python
# 获取任务统计
GET /api/eval-tasks/stats

# 获取任务日志
GET /api/eval-tasks/{task_id}/logs

# 获取系统健康状态
GET /api/eval-tasks/health
```

## 7. 测试策略

### 7.1 单元测试

- 任务管理器功能测试
- 重试机制测试
- 错误处理测试

### 7.2 集成测试

- 端到端任务执行测试
- 并发执行测试
- 故障恢复测试

### 7.3 性能测试

- 大量任务并发执行
- 长时间运行稳定性
- 内存和CPU使用监控

## 8. 部署和运维

### 8.1 部署要求

- 数据库版本：MySQL 8.0+
- Python版本：3.9+
- 内存要求：至少2GB
- 磁盘空间：根据任务量确定

### 8.2 监控告警

- 任务失败率过高告警
- 任务执行时间过长告警
- 系统资源使用告警
- 数据库连接异常告警

### 8.3 备份策略

- 定期备份任务数据
- 保留关键任务的执行日志
- 实现数据恢复机制

## 9. 风险评估

### 9.1 技术风险

- 数据库性能瓶颈
- 内存泄漏风险
- 并发竞争条件

### 9.2 业务风险

- 任务执行时间过长
- 资源消耗过大
- 用户体验影响

### 9.3 缓解措施

- 实现资源限制和监控
- 提供任务优先级控制
- 实现优雅降级机制

## 10. 总结

本设计方案通过引入持久化的任务管理系统，解决了当前评估系统的可靠性问题。主要改进包括：

1. **可靠性提升**：任务状态持久化，支持故障恢复
2. **用户体验改善**：提供实时的任务进度和状态反馈
3. **系统稳定性**：通过重试机制和错误处理提高成功率
4. **运维友好**：提供完整的监控和日志记录

该方案采用渐进式实施策略，可以在不影响现有功能的前提下逐步部署和优化。 