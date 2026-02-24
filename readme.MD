# PromptLab

PromptLab 是一个开源的 AI 提示词工程平台，用于创建、测试和评估 LLM 提示词。

## 功能特性

- **提示词编辑器** - 专业的提示词创建和编辑环境，支持变量模板、版本控制
- **数据集管理** - 管理测试数据集，支持批量导入 CSV、可视化预览
- **评估流水线** - 构建自动化评估流水线，支持多种评估策略（精确匹配、正则、LLM 断言等）
- **多模型支持** - 通过统一接口接入 OpenAI、Anthropic、DeepSeek 等主流 LLM 提供商
- **项目协作** - 多项目管理，支持团队成员邀请和权限控制
- **提示词助手** - AI 辅助优化提示词
- **国际化** - 支持中文/英文双语界面

## 技术栈

**后端:** Python + FastAPI + SQLAlchemy + MySQL + Alembic

**前端:** React 19 + TypeScript + Vite + Ant Design + Tailwind CSS

## 快速开始

### 前置条件

- Python 3.9+
- Node.js 18+
- MySQL 8.0+

### 1. 克隆项目

```bash
git clone https://github.com/your-org/promptlab.git
cd promptlab
```

### 2. 配置数据库

创建 MySQL 数据库：

```sql
CREATE DATABASE prompt_lab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

你可以选择以下两种方式之一初始化数据库表结构：

**方式 A：直接执行 SQL 脚本（推荐）**

```bash
mysql -u root -p prompt_lab < server/sql/mysql-schema.sql
```

**方式 B：使用 Alembic 迁移**

```bash
cd server
alembic upgrade head
```

### 3. 启动后端

```bash
cd server

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库连接信息

# 启动服务
python main.py
```

后端服务默认运行在 `http://localhost:8000`

### 4. 启动前端

```bash
cd web

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5173`，API 请求会自动代理到后端。

### 5. 构建生产版本

```bash
cd web
npm run build
```

构建产物会输出到 `server/app/public/`，后端会自动提供静态文件服务。

## 环境变量

### 后端 (`server/.env`)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SECRET_KEY` | JWT 签名密钥 | (需要修改) |
| `MYSQL_HOST` | MySQL 主机 | `localhost` |
| `MYSQL_PORT` | MySQL 端口 | `3306` |
| `MYSQL_USER` | MySQL 用户 | `root` |
| `MYSQL_PASSWORD` | MySQL 密码 | (空) |
| `MYSQL_DATABASE` | 数据库名 | `prompt_lab` |
| `OPENROUTER_API_KEY` | OpenRouter API Key（用于 AI 功能） | (空) |

### 前端 (`web/.env.local`)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `http://localhost:8000` |

## 项目结构

```
promptlab/
├── server/                 # 后端 (FastAPI)
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置
│   │   ├── models/        # 数据库模型
│   │   ├── schemas/       # Pydantic 数据模型
│   │   ├── services/      # 业务逻辑
│   │   └── utils/         # 工具函数
│   ├── alembic/           # 数据库迁移
│   ├── sql/               # SQL 脚本
│   └── requirements.txt
├── web/                    # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── contexts/      # React Context
│   │   ├── i18n/          # 国际化
│   │   ├── lib/           # 工具库
│   │   └── types/         # TypeScript 类型
│   └── package.json
└── README.md
```

## License

[MIT](LICENSE)
