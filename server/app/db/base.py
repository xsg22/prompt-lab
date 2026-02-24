from datetime import datetime
from typing import Any, Dict, TypeVar

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.ext.declarative import as_declarative, declared_attr


@as_declarative()
class Base:
    """SQLAlchemy 声明基类"""
    
    # 强制子类定义这些属性
    __name__: str
    
    # ID列
    id = Column(Integer, primary_key=True, index=True)
    
    # 自动生成表名
    @declared_attr
    def __tablename__(cls) -> str:
        """根据类名自动生成表名"""
        return cls.__name__.lower()
    
    def to_dict(self) -> Dict[str, Any]:
        """将模型转换为字典"""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }


class TimestampMixin:
    """时间戳混入类"""
    
    created_at = Column(
        DateTime, nullable=False, default=datetime.now
    )
    updated_at = Column(
        DateTime, nullable=False, default=datetime.now
    )


ModelType = TypeVar("ModelType", bound=Base)
"""模型类型变量，用于类型提示""" 