# PromptLab 后端服务

这是PromptLab应用的后端服务，基于FastAPI开发。

## 环境要求

- Python 3.8+
- pip包管理器

## 安装

1. 创建虚拟环境（可选但推荐）

```bash
python -m venv .venv
```

2. 激活虚拟环境

- Windows:
```bash
.venv\Scripts\activate
```

- Linux/MacOS:
```bash
source .venv/bin/activate
```

3. 安装依赖

```bash
pip install -r requirements.txt
```

## 启动服务

有两种方式启动服务：

### 方法1：使用start.py脚本

```bash
python start.py
```

### 方法2：直接使用uvicorn

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后访问：http://localhost:8000

API文档可通过以下地址访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc 

## 数据库配置

PromptLab支持1种数据库:

1. MySQL 

### 数据库类型配置

通过环境变量 `DB_TYPE` 设置数据库类型：

```bash
# 使用 MySQL
export DB_TYPE=mysql
```


### MySQL 配置

使用 MySQL 时，需要配置以下环境变量：

```bash
export DB_TYPE=mysql
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=prompt_lab
```

### 初始化数据库

运行以下命令初始化数据库：

```bash
# 确保在server目录
cd server

# 初始化数据库
python -m app.db.init_db
```

该命令会根据配置的数据库类型，创建相应的数据库和表。

## 安装依赖

为支持MySQL，需安装pymysql：

```bash
pip install pymysql
``` 