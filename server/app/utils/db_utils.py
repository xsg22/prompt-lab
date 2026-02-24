
import sqlalchemy


def to_dict(obj):
    """将 SQLAlchemy 对象转换为字典"""
    return {c.key: getattr(obj, c.key) for c in sqlalchemy.inspect(obj).mapper.column_attrs}
