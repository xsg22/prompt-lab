"""评估任务配置管理器"""

import json
import os
from typing import Any, Dict, Optional, List
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)

class EvalTaskConfig:
    """评估任务配置管理器"""
    
    # 默认配置
    DEFAULT_CONFIG = {
        "max_concurrent_tasks": 5,  # 最大并发任务数
        "max_concurrent_items_per_task": 10,  # 每个任务最大并发项数
        "task_timeout_minutes": 30,  # 任务超时时间（分钟）
        "retry_delays": [0, 30, 120, 300],  # 重试延迟时间（秒）
        "cleanup_completed_tasks_days": 7,  # 清理已完成任务的天数
        "scheduler_interval_seconds": 5,  # 调度器检查间隔（秒）
        "log_retention_days": 30,  # 日志保留天数
    }
    
    def __init__(self, config_file: Optional[str] = None):
        """初始化配置管理器
        
        Args:
            config_file: 配置文件路径，如果为None则使用默认路径
        """
        if config_file is None:
            # 使用默认配置文件路径
            config_dir = Path(__file__).parent.parent.parent / "config"
            config_dir.mkdir(exist_ok=True)
            config_file = config_dir / "eval_task_config.json"
        
        self.config_file = Path(config_file)
        self._config = {}
        self._load_config()
    
    def _load_config(self) -> None:
        """加载配置文件"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    file_config = json.load(f)
                
                # 合并默认配置和文件配置
                self._config = {**self.DEFAULT_CONFIG, **file_config}
                logger.info(f"已加载配置文件: {self.config_file}")
            else:
                # 使用默认配置并创建配置文件
                self._config = self.DEFAULT_CONFIG.copy()
                self._save_config()
                logger.info(f"创建默认配置文件: {self.config_file}")
                
        except Exception as e:
            logger.error(f"加载配置文件失败: {str(e)}, 使用默认配置")
            self._config = self.DEFAULT_CONFIG.copy()
    
    def _save_config(self) -> None:
        """保存配置到文件"""
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self._config, f, indent=2, ensure_ascii=False)
            logger.info(f"配置已保存到: {self.config_file}")
        except Exception as e:
            logger.error(f"保存配置文件失败: {str(e)}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值
        
        Args:
            key: 配置键
            default: 默认值
            
        Returns:
            配置值
        """
        return self._config.get(key, default)
    
    def get_int(self, key: str, default: int = 0) -> int:
        """获取整数配置值"""
        value = self.get(key, default)
        try:
            return int(value)
        except (ValueError, TypeError):
            logger.warning(f"配置项 {key} 的值 {value} 不是有效整数，使用默认值 {default}")
            return default
    
    def get_float(self, key: str, default: float = 0.0) -> float:
        """获取浮点数配置值"""
        value = self.get(key, default)
        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"配置项 {key} 的值 {value} 不是有效浮点数，使用默认值 {default}")
            return default
    
    def get_list(self, key: str, default: List = None) -> List:
        """获取列表配置值"""
        if default is None:
            default = []
        
        value = self.get(key, default)
        if isinstance(value, list):
            return value
        
        # 如果是字符串，尝试解析为JSON
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        
        logger.warning(f"配置项 {key} 的值 {value} 不是有效列表，使用默认值 {default}")
        return default
    
    def get_bool(self, key: str, default: bool = False) -> bool:
        """获取布尔配置值"""
        value = self.get(key, default)
        if isinstance(value, bool):
            return value
        
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'on')
        
        return bool(value)
    
    def set(self, key: str, value: Any) -> None:
        """设置配置值
        
        Args:
            key: 配置键
            value: 配置值
        """
        self._config[key] = value
        self._save_config()
    
    def update(self, config_dict: Dict[str, Any]) -> None:
        """批量更新配置
        
        Args:
            config_dict: 配置字典
        """
        self._config.update(config_dict)
        self._save_config()
    
    def reload(self) -> None:
        """重新加载配置文件"""
        self._load_config()
    
    def get_all(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config.copy()
    
    def reset_to_default(self) -> None:
        """重置为默认配置"""
        self._config = self.DEFAULT_CONFIG.copy()
        self._save_config()
    
    # 便捷方法，用于获取常用配置
    
    def get_max_concurrent_tasks(self) -> int:
        """获取最大并发任务数"""
        return self.get_int("max_concurrent_tasks", 5)
    
    def get_max_concurrent_items_per_task(self) -> int:
        """获取每个任务最大并发项数"""
        return self.get_int("max_concurrent_items_per_task", 10)
    
    def get_task_timeout_minutes(self) -> int:
        """获取任务超时时间（分钟）"""
        return self.get_int("task_timeout_minutes", 30)
    
    def get_retry_delays(self) -> List[int]:
        """获取重试延迟时间列表"""
        return self.get_list("retry_delays", [0, 30, 120, 300])
    
    def get_cleanup_completed_tasks_days(self) -> int:
        """获取清理已完成任务的天数"""
        return self.get_int("cleanup_completed_tasks_days", 7)
    
    def get_scheduler_interval_seconds(self) -> int:
        """获取调度器检查间隔（秒）"""
        return self.get_int("scheduler_interval_seconds", 5)
    
    def get_log_retention_days(self) -> int:
        """获取日志保留天数"""
        return self.get_int("log_retention_days", 30)


# 全局配置实例
_config_instance: Optional[EvalTaskConfig] = None


def get_eval_config() -> EvalTaskConfig:
    """获取全局配置实例"""
    global _config_instance
    if _config_instance is None:
        _config_instance = EvalTaskConfig()
    return _config_instance


def reload_eval_config() -> None:
    """重新加载配置"""
    global _config_instance
    if _config_instance:
        _config_instance.reload()
    else:
        _config_instance = EvalTaskConfig() 