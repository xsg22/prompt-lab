import logging
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置类"""
    
    # 基础配置
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "PromptLab API"
    VERSION: str = "1.0.0"
    PROJECT_DESCRIPTION: str = "PromptLab API"
    # CORS设置
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    # JWT设置
    SECRET_KEY: str = Field(default="change-this-to-a-random-secret-key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天
    ALGORITHM: str = "HS256"
    
    # 数据库设置
    DB_TYPE: str = Field(default="mysql")
    
    # MySQL配置
    MYSQL_HOST: str = Field(default="localhost")
    MYSQL_PORT: int = Field(default=3306)
    MYSQL_USER: str = Field(default="root")
    MYSQL_PASSWORD: str = Field(default="")
    MYSQL_DATABASE: str = Field(default="prompt_lab")
    
    # 连接池配置
    DB_POOL_SIZE: int = Field(default=10)
    DB_MAX_OVERFLOW: int = Field(default=20)
    DB_POOL_TIMEOUT: int = Field(default=30)
    DB_POOL_RECYCLE: int = Field(default=1800)  # 30分钟
    
    # 静态文件配置
    STATIC_DIR: str = Field(default="app/public")
    
    # 日志配置
    LOG_LEVEL: str = Field(default="DEBUG")
    LOG_FORMAT: str = Field(default="%(asctime)s %(levelname)s %(threadName)s %(filename)s:%(lineno)d: %(message)s")
    
    # 验证码配置
    VERIFICATION_CODE_EXPIRY: int = Field(default=600)  # 10分钟
    
    LOGIN_SECRET_KEY: str = Field(default="change-this-to-a-random-login-secret-key")
  
    # 代理配置
    HTTP_PROXY: str = Field(default="", description="HTTP代理")
    HTTPS_PROXY: str = Field(default="", description="HTTPS代理") 
    # OpenRouter 配置（用于 AI 功能，如提示词助手）
    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key")
    OPENROUTER_BASE_URL: str = Field(default="https://openrouter.ai/api/v1", description="OpenRouter Base URL")

    @property
    def MYSQL_CONNECTION_STRING(self) -> str:
        """获取MySQL连接字符串"""
        return (
            f"mysql+asyncmy://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}"
            f"@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}"
            f"?charset=utf8mb4"
        )
    
    @property
    def DATABASE_URL(self) -> str:
        """获取数据库URL（用于alembic）"""
        return self.MYSQL_CONNECTION_STRING
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# 创建设置实例
settings = Settings() 