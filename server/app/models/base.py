"""
已废弃：请使用app.models下的各个模块中的模型

所有模型已经迁移到各自的模块中：
- app.models.user - 用户相关模型
- app.models.project - 项目相关模型
- app.models.prompt - 提示词相关模型  
- app.models.dataset - 数据集相关模型
- app.models.evaluation - 评估相关模型
"""

# 从各模块导入所有模型以保持向后兼容
from app.models.user import Users as UserTable
from app.models.project import Project as ProjectTable, ProjectMember, ProjectInvitation
from app.models.prompt import Prompt, PromptVersion, TestCase, Request
from app.models.dataset import Dataset as DataSet, DatasetItem as DataSetItem
from app.models.evaluation import EvalPipeline, EvalColumn, EvalResult, EvalCell

# 导入声明基类以保持向后兼容
from app.db.base import Base