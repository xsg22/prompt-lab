import os
from pathlib import Path
from typing import Dict, Any

def get_db_config() -> Dict[str, Any]:
    """获取数据库配置"""

    # 数据库配置
    DB_CONFIG = {
        # 数据库类型: mysql
        "db_type": os.environ.get("DB_TYPE", "mysql"),
        
        # MySQL 配置
        "mysql": {
            "host": os.environ.get("MYSQL_HOST", "localhost"),
            "port": int(os.environ.get("MYSQL_PORT", 3306)),
            "user": os.environ.get("MYSQL_USER", "root"),
            "password": os.environ.get("MYSQL_PASSWORD", ""),
            "database": os.environ.get("MYSQL_DATABASE", "prompt_lab"),
        }
    }
    db_type = DB_CONFIG["db_type"]
    if db_type not in ["mysql"]:
        raise ValueError(f"不支持的数据库类型: {db_type}")
    
    return {
        "type": db_type,
        "config": DB_CONFIG[db_type]
    } 