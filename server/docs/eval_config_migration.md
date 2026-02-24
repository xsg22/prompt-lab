# 评估任务配置系统迁移文档

## 概述

本次迁移将评估任务的配置管理从数据库表改为配置文件管理，简化了系统架构并提高了配置管理的灵活性。

## 变更内容

### 1. 移除数据库表

- 删除了 `eval_task_config` 表
- 移除了相关的模型、Schema和API端点

### 2. 新增配置文件系统

- 创建了 `app/core/eval_config.py` 配置管理器
- 配置文件位置：`server/config/eval_task_config.json`
- 支持热重载和动态更新

### 3. 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `max_concurrent_tasks` | 5 | 最大并发任务数 |
| `max_concurrent_items_per_task` | 10 | 每个任务最大并发项数 |
| `task_timeout_minutes` | 30 | 任务超时时间（分钟） |
| `retry_delays` | [0, 30, 120, 300] | 重试延迟时间（秒） |
| `cleanup_completed_tasks_days` | 7 | 清理已完成任务的天数 |
| `scheduler_interval_seconds` | 5 | 调度器检查间隔（秒） |
| `log_retention_days` | 30 | 日志保留天数 |

## 使用方法

### 获取配置

```python
from app.core.eval_config import get_eval_config

config = get_eval_config()

# 获取具体配置项
max_tasks = config.get_max_concurrent_tasks()
timeout = config.get_task_timeout_minutes()

# 获取任意配置项
value = config.get("custom_key", default_value)
```

### 更新配置

```python
# 设置单个配置项
config.set("max_concurrent_tasks", 10)

# 批量更新配置
config.update({
    "max_concurrent_tasks": 10,
    "task_timeout_minutes": 60
})
```

### 重新加载配置

```python
from app.core.eval_config import reload_eval_config

# 重新加载配置文件
reload_eval_config()
```

## 迁移步骤

### 1. 数据库迁移

运行迁移脚本删除 `eval_task_config` 表：

```bash
# 如果使用Alembic
alembic upgrade head

# 或者手动执行SQL
DROP TABLE eval_task_config;
```

### 2. 配置文件初始化

配置文件会在首次使用时自动创建，也可以手动创建：

```bash
mkdir -p server/config
cp server/config/eval_task_config.json.example server/config/eval_task_config.json
```

### 3. 验证迁移

运行测试脚本验证配置系统：

```bash
python test_config.py
```

## 优势

1. **简化架构**：移除了数据库依赖，减少了系统复杂度
2. **提高性能**：配置读取不再需要数据库查询
3. **便于管理**：配置文件可以版本控制，便于部署和回滚
4. **支持热重载**：可以在运行时重新加载配置
5. **类型安全**：提供了类型化的配置获取方法

## 注意事项

1. **配置文件权限**：确保配置文件有适当的读写权限
2. **备份配置**：在修改配置前建议备份原配置文件
3. **配置验证**：系统会自动验证配置值的类型和范围
4. **默认值**：如果配置文件不存在或配置项缺失，会使用默认值

## 兼容性

- 保持了原有的API接口兼容性
- `EvalTaskManager.get_config()` 方法仍然可用，但现在从配置文件读取
- 调度器和执行器的行为保持不变

## 故障排除

### 配置文件不存在

系统会自动创建默认配置文件，无需手动干预。

### 配置值无效

系统会记录警告日志并使用默认值，确保系统正常运行。

### 权限问题

确保应用程序对配置目录有读写权限：

```bash
chmod 755 server/config
chmod 644 server/config/eval_task_config.json
``` 