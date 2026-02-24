import logging
import sys
from typing import Any, Dict, Optional

from app.core.config import settings


class CustomFormatter(logging.Formatter):
    """自定义日志格式器，添加颜色支持"""
    
    COLORS = {
        "DEBUG": "\033[38;5;39m",  # 蓝色
        "INFO": "\033[38;5;76m",   # 绿色
        "WARNING": "\033[38;5;226m",  # 黄色
        "ERROR": "\033[38;5;196m",  # 红色
        "CRITICAL": "\033[48;5;196m\033[38;5;15m",  # 白底红字
        "RESET": "\033[0m",  # 重置
    }
    
    def format(self, record: logging.LogRecord) -> str:
        """格式化日志记录"""
        level_name = record.levelname
        log_color = self.COLORS.get(level_name, "")
        reset = self.COLORS["RESET"]
        
        formatter = logging.Formatter(
            f"{log_color}{settings.LOG_FORMAT}{reset}"
        )
        
        return formatter.format(record)


def setup_logging(log_level: Optional[str] = None) -> None:
    """配置日志系统"""
    
    level = log_level or settings.LOG_LEVEL
    
    # 创建处理器
    console_handler = logging.StreamHandler(sys.stdout)
    
    # 使用自定义格式器
    console_handler.setFormatter(CustomFormatter())
    
    # 配置根日志器
    logging.basicConfig(
        level=level,
        handlers=[console_handler],
        force=True
    )
    
    # 设置第三方库的日志级别
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    
    # 输出初始日志
    logging.info(f"日志系统初始化完成，日志级别: {level}")


def get_logger(name: str) -> logging.Logger:
    """获取命名日志器"""
    return logging.getLogger(name)


# 初始化日志系统
setup_logging() 