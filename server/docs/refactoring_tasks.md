# PromptLab 后端重构任务清单

## 阶段一：环境准备

- [ ] 1.1 创建新的目录结构
  - [ ] 1.1.1 创建 app/api/v1/endpoints 目录
  - [ ] 1.1.2 创建 app/core 目录
  - [ ] 1.1.3 创建 app/schemas 目录
  - [ ] 1.1.4 创建 app/services 目录
  - [ ] 1.1.5 创建 tests 目录

- [ ] 1.2 配置开发工具
  - [ ] 1.2.1 添加 Black 配置
  - [ ] 1.2.2 添加 isort 配置
  - [ ] 1.2.3 添加 Flake8 配置
  - [ ] 1.2.4 添加 mypy 配置

- [ ] 1.3 配置项目依赖
  - [ ] 1.3.1 创建 pyproject.toml
  - [ ] 1.3.2 更新 requirements.txt
  - [ ] 1.3.3 创建 .env.example

## 阶段二：基础架构重构

- [ ] 2.1 重构配置管理
  - [ ] 2.1.1 创建 app/core/config.py 使用 Pydantic BaseSettings
  - [ ] 2.1.2 迁移现有配置

- [ ] 2.2 重构日志系统
  - [ ] 2.2.1 创建 app/core/logging.py
  - [ ] 2.2.2 实现结构化日志

- [ ] 2.3 重构数据库连接
  - [ ] 2.3.1 创建 app/db/base.py
  - [ ] 2.3.2 创建 app/db/session.py
  - [ ] 2.3.3 优化连接池配置

- [ ] 2.4 重构认证系统
  - [ ] 2.4.1 创建 app/core/security.py
  - [ ] 2.4.2 实现 JWT 认证
  - [ ] 2.4.3 实现角色权限系统

- [ ] 2.5 实现依赖注入系统
  - [ ] 2.5.1 创建 app/api/deps.py
  - [ ] 2.5.2 实现常用依赖

## 阶段三：模型层重构

- [ ] 3.1 重构 ORM 模型
  - [ ] 3.1.1 创建 app/models/base.py
  - [ ] 3.1.2 重构 app/models/user.py
  - [ ] 3.1.3 重构 app/models/project.py
  - [ ] 3.1.4 重构 app/models/dataset.py
  - [ ] 3.1.5 重构 app/models/prompt.py
  - [ ] 3.1.6 重构 app/models/evaluation.py

- [ ] 3.2 创建 Pydantic 模型
  - [ ] 3.2.1 创建 app/schemas/base.py
  - [ ] 3.2.2 创建 app/schemas/user.py
  - [ ] 3.2.3 创建 app/schemas/project.py
  - [ ] 3.2.4 创建 app/schemas/dataset.py
  - [ ] 3.2.5 创建 app/schemas/prompt.py
  - [ ] 3.2.6 创建 app/schemas/evaluation.py

- [ ] 3.3 实现模型关系
  - [ ] 3.3.1 定义外键关系
  - [ ] 3.3.2
  - [ ] 3.3.3 配置级联删除

## 阶段四：服务层重构

- [ ] 4.1 实现基础服务类
  - [ ] 4.1.1 创建 app/services/base.py

- [ ] 4.2 重构用户认证服务
  - [ ] 4.2.1 创建 app/services/auth.py
  - [ ] 4.2.2 实现用户认证方法
  - [ ] 4.2.3 实现权限检查

- [ ] 4.3 重构数据集服务
  - [ ] 4.3.1 创建 app/services/dataset.py
  - [ ] 4.3.2 迁移现有功能
  - [ ] 4.3.3 优化数据库查询

- [ ] 4.4 重构提示词服务
  - [ ] 4.4.1 创建 app/services/prompt.py
  - [ ] 4.4.2 迁移现有功能
  - [ ] 4.4.3 优化数据库查询

- [ ] 4.5 重构评估服务
  - [ ] 4.5.1 创建 app/services/evaluation.py
  - [ ] 4.5.2 迁移现有功能
  - [ ] 4.5.3 优化数据库查询

- [ ] 4.6 重构项目服务
  - [ ] 4.6.1 创建 app/services/project.py
  - [ ] 4.6.2 迁移现有功能
  - [ ] 4.6.3 优化数据库查询

- [ ] 4.7 重构 LLM 服务
  - [ ] 4.7.1 创建 app/services/llm.py
  - [ ] 4.7.2 封装 API 调用
  - [ ] 4.7.3 实现错误处理和重试机制

## 阶段五：API 层重构

- [ ] 5.1 实现 API 路由聚合
  - [ ] 5.1.1 创建 app/api/v1/api.py

- [ ] 5.2 重构认证 API
  - [ ] 5.2.1 创建 app/api/v1/endpoints/auth.py
  - [ ] 5.2.2 实现登录、注册、刷新令牌接口

- [ ] 5.3 重构用户 API
  - [ ] 5.3.1 创建 app/api/v1/endpoints/users.py
  - [ ] 5.3.2 实现用户管理接口

- [ ] 5.4 重构项目 API
  - [ ] 5.4.1 创建 app/api/v1/endpoints/projects.py
  - [ ] 5.4.2 实现项目管理接口

- [ ] 5.5 重构数据集 API
  - [ ] 5.5.1 创建 app/api/v1/endpoints/datasets.py
  - [ ] 5.5.2 实现数据集管理接口

- [ ] 5.6 重构提示词 API
  - [ ] 5.6.1 创建 app/api/v1/endpoints/prompts.py
  - [ ] 5.6.2 实现提示词管理接口

- [ ] 5.7 重构评估 API
  - [ ] 5.7.1 创建 app/api/v1/endpoints/evaluations.py
  - [ ] 5.7.2 实现评估管理接口

- [ ] 5.8 重构 LLM API
  - [ ] 5.8.1 创建 app/api/v1/endpoints/llm.py
  - [ ] 5.8.2 实现 LLM 调用接口

- [ ] 5.9 实现统一响应处理
  - [ ] 5.9.1 创建 app/api/v1/errors.py
  - [ ] 5.9.2 实现统一错误处理

## 阶段六：其他功能重构

- [ ] 6.1 重构请求中间件
  - [ ] 6.1.1 创建请求处理中间件
  - [ ] 6.1.2 实现响应格式化中间件

- [ ] 6.2 重构静态文件服务
  - [ ] 6.2.1 配置静态文件路由
  - [ ] 6.2.2 实现 SPA 中间件

- [ ] 6.3 实现数据库迁移
  - [ ] 6.3.1 设置 Alembic
  - [ ] 6.3.2 创建初始迁移脚本

## 阶段七：测试与文档

- [ ] 7.1 编写单元测试
  - [ ] 7.1.1 创建 tests/conftest.py
  - [ ] 7.1.2 为服务编写测试
  - [ ] 7.1.3 为工具函数编写测试

- [ ] 7.2 编写集成测试
  - [ ] 7.2.1 为 API 端点编写测试
  - [ ] 7.2.2 测试认证和授权

- [ ] 7.3 更新 API 文档
  - [ ] 7.3.1 为所有端点添加文档注释
  - [ ] 7.3.2 配置 FastAPI 文档路由

## 阶段八：性能优化

- [ ] 8.1 数据库优化
  - [ ] 8.1.1 优化数据库查询
  - [ ] 8.1.2 添加适当的索引

- [ ] 8.2 缓存优化
  - [ ] 8.2.1 实现响应缓存
  - [ ] 8.2.2 实现数据缓存

- [ ] 8.3 性能测试
  - [ ] 8.3.1 编写性能测试
  - [ ] 8.3.2 进行负载测试

## 阶段九：部署与维护

- [ ] 9.1 容器化
  - [ ] 9.1.1 创建 Dockerfile
  - [ ] 9.1.2 创建 docker-compose.yml

- [ ] 9.2 CI/CD 配置
  - [ ] 9.2.1 配置自动测试
  - [ ] 9.2.2 配置自动部署

- [ ] 9.3 监控配置
  - [ ] 9.3.1 集成日志监控
  - [ ] 9.3.2 集成性能监控 