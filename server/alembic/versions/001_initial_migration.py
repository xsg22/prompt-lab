"""Initial migration - Full schema

Revision ID: 001
Revises: 
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===== 基础表（无外键依赖）=====

    op.create_table('users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password', sa.String(255), nullable=False),
        sa.Column('nickname', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('current_project_id', sa.Integer(), nullable=True, comment='当前项目id'),
        sa.Column('clerk_id', sa.String(255), nullable=True, comment='Clerk ID'),
        sa.Column('email_verified', sa.Boolean(), server_default=sa.text('0'), nullable=True, comment='Email是否验证'),
        sa.Column('avatar_url', sa.String(255), nullable=True, comment='头像URL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='email'),
        comment='用户表'
    )
    op.create_index('clerk_id', 'users', ['clerk_id'])

    op.create_table('projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('webhook_url', sa.String(255), nullable=True, comment='webhook url'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        comment='项目表'
    )

    # ===== 依赖 projects 的表 =====

    op.create_table('model_provider_instances',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False, comment='实例名称，用户自定义'),
        sa.Column('provider_type', sa.String(50), nullable=False, comment='提供商类型，如openai、anthropic等'),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='所属项目ID'),
        sa.Column('config', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='提供商配置信息，如API密钥、base_url等'),
        sa.Column('is_enabled', sa.Boolean(), server_default=sa.text('1'), nullable=False, comment='是否启用'),
        sa.Column('enabled_models', mysql.JSON(), server_default=sa.text("('[]')"), nullable=False, comment='启用的模型ID列表'),
        sa.Column('last_tested_at', sa.DateTime(), nullable=True, comment='最后测试时间'),
        sa.Column('connection_status', sa.String(20), server_default=sa.text("'unknown'"), nullable=False, comment='连接状态：connected, failed, unknown'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='连接错误信息'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('custom_models', mysql.JSON(), nullable=False, comment='自定义模型列表'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
    )
    op.create_index('ix_model_provider_instances_id', 'model_provider_instances', ['id'])
    op.create_index('project_id', 'model_provider_instances', ['project_id'])

    op.create_table('project_models',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False, comment='模型显示名称'),
        sa.Column('model_id', sa.String(255), nullable=False, comment='模型ID，用于API调用'),
        sa.Column('provider_instance_id', sa.Integer(), nullable=False, comment='关联的提供商实例ID'),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='所属项目ID'),
        sa.Column('description', sa.String(500), nullable=True, comment='模型描述'),
        sa.Column('context_window', sa.Integer(), nullable=True, comment='上下文窗口大小'),
        sa.Column('input_cost_per_token', sa.Float(), nullable=True, comment='输入token单价'),
        sa.Column('output_cost_per_token', sa.Float(), nullable=True, comment='输出token单价'),
        sa.Column('supports_streaming', sa.Boolean(), server_default=sa.text('1'), nullable=False, comment='是否支持流式输出'),
        sa.Column('supports_tools', sa.Boolean(), server_default=sa.text('0'), nullable=False, comment='是否支持工具调用'),
        sa.Column('supports_vision', sa.Boolean(), server_default=sa.text('0'), nullable=False, comment='是否支持视觉功能'),
        sa.Column('config', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='模型特定配置'),
        sa.Column('is_enabled', sa.Boolean(), server_default=sa.text('1'), nullable=False, comment='是否启用'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.ForeignKeyConstraint(['provider_instance_id'], ['model_provider_instances.id']),
    )
    op.create_index('ix_project_models_id', 'project_models', ['id'])
    op.create_index('project_id', 'project_models', ['project_id'])
    op.create_index('provider_instance_id', 'project_models', ['provider_instance_id'])

    op.create_table('project_ai_feature_configs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='所属项目ID'),
        sa.Column('feature_key', sa.String(64), nullable=False, comment='功能标识'),
        sa.Column('provider', sa.String(64), nullable=False, comment='模型提供商'),
        sa.Column('model_id', sa.String(128), nullable=False, comment='模型ID'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'feature_key', name='project_id'),
        comment='AI功能模型配置表，存储各功能使用的模型配置'
    )

    op.create_table('tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False, comment='标签名称'),
        sa.Column('color', sa.String(7), nullable=True, comment='标签颜色'),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='项目id'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
    )
    op.create_index('idx_tags_name', 'tags', ['name'])
    op.create_index('project_id', 'tags', ['project_id'])

    op.create_table('project_members',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(16), nullable=False, comment='member, admin'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        comment='项目成员表'
    )
    op.create_index('project_id', 'project_members', ['project_id'])
    op.create_index('user_id', 'project_members', ['user_id'])

    op.create_table('project_invitations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='项目id'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='邀请人id'),
        sa.Column('token', sa.String(64), nullable=False, comment='邀请token，唯一键'),
        sa.Column('role', sa.String(16), nullable=False, comment='admin, member, readonly'),
        sa.Column('is_expired', sa.Boolean(), server_default=sa.text('0'), nullable=True, comment='是否过期'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='idx_project_invitations_token'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        comment='项目邀请表'
    )
    op.create_index('project_id', 'project_invitations', ['project_id'])
    op.create_index('user_id', 'project_invitations', ['user_id'])

    op.create_table('project_api_keys',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False, comment='项目ID'),
        sa.Column('name', sa.String(255), nullable=False, comment='API Key名称'),
        sa.Column('key_hash', sa.String(255), nullable=False, comment='API Key哈希值'),
        sa.Column('status', sa.String(20), nullable=False, comment='状态：active/inactive'),
        sa.Column('expires_at', sa.DateTime(), nullable=True, comment='过期时间'),
        sa.Column('created_by', sa.Integer(), nullable=False, comment='创建者用户ID'),
        sa.Column('last_used_at', sa.DateTime(), nullable=True, comment='最后使用时间'),
        sa.Column('usage_count', sa.Integer(), nullable=False, comment='使用次数'),
        sa.Column('description', sa.Text(), nullable=True, comment='描述'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_hash', name='uq_project_api_keys_key_hash'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], name='fk_project_api_keys_project_id'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_project_api_keys_created_by'),
        comment='项目API密钥表'
    )
    op.create_index('ix_project_api_keys_project_id', 'project_api_keys', ['project_id'])
    op.create_index('ix_project_api_keys_status', 'project_api_keys', ['status'])
    op.create_index('ix_project_api_keys_expires_at', 'project_api_keys', ['expires_at'])

    # ===== 提示词相关 =====

    op.create_table('prompts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True, comment='项目id'),
        sa.Column('is_public', sa.Boolean(), server_default=sa.text('0'), nullable=False, comment='是否公开'),
        sa.Column('category', sa.String(50), nullable=True, comment='分类'),
        sa.Column('priority', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='优先级'),
        sa.Column('status', sa.String(16), server_default=sa.text("'active'"), nullable=False, comment='active, archived, draft'),
        sa.Column('is_template', sa.Boolean(), server_default=sa.text('0'), nullable=False, comment='是否为模板'),
        sa.PrimaryKeyConstraint('id'),
        comment='提示词模板表'
    )

    op.create_table('prompt_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('messages', sa.Text(), nullable=False, comment='以JSON格式存储的messages'),
        sa.Column('variables', mysql.JSON(), server_default=sa.text("('[]')"), nullable=False, comment='以JSON格式存储的变量列表'),
        sa.Column('model_name', sa.String(128), server_default=sa.text("'gpt-3.5-turbo'"), nullable=True, comment='存储实际使用的模型名称'),
        sa.Column('model_params', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='以JSON格式存储模型参数'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('prompt_id', 'version_number', name='prompt_id'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        comment='模板版本表'
    )

    op.create_table('prompt_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_id', sa.Integer(), nullable=False, comment='提示词id'),
        sa.Column('tag_id', sa.Integer(), nullable=False, comment='标签id'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        comment='提示词标签关联表'
    )
    op.create_index('prompt_id', 'prompt_tags', ['prompt_id'])
    op.create_index('tag_id', 'prompt_tags', ['tag_id'])

    op.create_table('prompt_favorites',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='用户id'),
        sa.Column('prompt_id', sa.Integer(), nullable=False, comment='提示词id'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'prompt_id', name='idx_prompt_favorites_user_prompt'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='CASCADE'),
        comment='提示词收藏表'
    )
    op.create_index('prompt_id', 'prompt_favorites', ['prompt_id'])

    op.create_table('test_cases',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_version_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('variables_values', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='以JSON格式存储的变量值'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('metadatas', mysql.JSON(), nullable=True, comment='以JSON格式存储的元数据'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['prompt_version_id'], ['prompt_versions.id'], ondelete='CASCADE'),
        comment='测试用例表'
    )
    op.create_index('prompt_version_id', 'test_cases', ['prompt_version_id'])

    op.create_table('requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('prompt_version_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(32), nullable=True, comment='输出的来源，playground、evaluation、api'),
        sa.Column('input', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='包含完整的模型输入，JSON格式'),
        sa.Column('variables_values', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='message里包含的变量值，JSON格式'),
        sa.Column('output', sa.Text(), nullable=True, comment='模型输出'),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True, comment='prompt tokens'),
        sa.Column('completion_tokens', sa.Integer(), nullable=True, comment='completion tokens'),
        sa.Column('total_tokens', sa.Integer(), nullable=True, comment='total tokens'),
        sa.Column('execution_time', sa.Integer(), server_default=sa.text('-1'), nullable=False, comment='接口请求时间，毫秒'),
        sa.Column('cost', sa.String(16), nullable=True, comment='花费'),
        sa.Column('success', sa.Boolean(), server_default=sa.text('0'), nullable=True, comment='是否成功'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('project_id', sa.Integer(), server_default=sa.text('1'), nullable=False, comment='项目id'),
        sa.Column('user_id', sa.Integer(), server_default=sa.text('1'), nullable=False, comment='用户id'),
        sa.Column('prompt_id', sa.Integer(), nullable=True, comment='提示词ID'),
        sa.PrimaryKeyConstraint('id'),
        comment='输出结果表'
    )
    op.create_index('prompt_version_id', 'requests', ['prompt_version_id'])

    # ===== 评估流水线相关 =====

    op.create_table('eval_pipelines',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    op.create_index('project_id', 'eval_pipelines', ['project_id'])
    op.create_index('user_id', 'eval_pipelines', ['user_id'])
    op.create_index('dataset_id', 'eval_pipelines', ['dataset_id'])

    # ===== 数据集相关 =====

    op.create_table('datasets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('variables', mysql.JSON(), server_default=sa.text("('[]')"), nullable=False, comment='以JSON格式存储的变量列表'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True, comment='项目id'),
        sa.Column('eval_pipeline_id', sa.Integer(), nullable=True),
        sa.Column('variable_descriptions', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='以JSON格式存储的变量描述'),
        sa.PrimaryKeyConstraint('id'),
        comment='数据集表'
    )
    op.create_index('eval_pipeline_id', 'datasets', ['eval_pipeline_id'])

    op.create_table('dataset_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('name', mysql.VARBINARY(64), nullable=True),
        sa.Column('expected_output', sa.Text(), nullable=True),
        sa.Column('variables_values', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='JSON存储测试用例变量值'),
        sa.Column('is_enabled', sa.Boolean(), server_default=sa.text('0'), nullable=True, comment='FALSE表示未启用，TRUE表示已启用'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('variables', sa.Text(), nullable=True),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        comment='数据集条目表'
    )
    op.create_index('dataset_id', 'dataset_items', ['dataset_id'])

    op.create_table('dataset_upload_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('dataset_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(32), server_default=sa.text("'pending'"), nullable=False, comment='pending, processing, completed, failed'),
        sa.Column('total_rows', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='总行数'),
        sa.Column('processed_rows', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='已处理行数'),
        sa.Column('success_rows', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='成功行数'),
        sa.Column('failed_rows', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='失败行数'),
        sa.Column('file_name', sa.String(255), nullable=False, comment='文件名'),
        sa.Column('error_details', mysql.JSON(), server_default=sa.text("('[]')"), nullable=False, comment='错误详情'),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True, comment='完成时间'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        comment='数据集上传任务表'
    )
    op.create_index('idx_upload_tasks_dataset_user', 'dataset_upload_tasks', ['dataset_id', 'user_id'])
    op.create_index('idx_upload_tasks_status', 'dataset_upload_tasks', ['status'])
    op.create_index('user_id', 'dataset_upload_tasks', ['user_id'])

    op.create_table('dataset_upload_errors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('upload_task_id', sa.Integer(), nullable=False),
        sa.Column('row_number', sa.Integer(), nullable=False, comment='行号'),
        sa.Column('error_type', sa.String(100), nullable=False, comment='错误类型'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('row_data', mysql.JSON(), nullable=True, comment='行数据'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['upload_task_id'], ['dataset_upload_tasks.id'], ondelete='CASCADE'),
        comment='数据集上传错误记录表'
    )
    op.create_index('idx_upload_errors_task', 'dataset_upload_errors', ['upload_task_id'])

    # ===== 评估结果相关 =====

    op.create_table('eval_columns',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pipeline_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('column_type', sa.Text(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('config', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pipeline_id'], ['eval_pipelines.id'], ondelete='CASCADE'),
    )
    op.create_index('pipeline_id', 'eval_columns', ['pipeline_id'])

    op.create_table('eval_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pipeline_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('run_type', sa.String(64), nullable=False, comment='执行方式, 如staging、release, scheduled'),
        sa.Column('total_count', sa.Integer(), server_default=sa.text('0'), nullable=True, comment='总评估数量'),
        sa.Column('passed_count', sa.Integer(), server_default=sa.text('0'), nullable=True, comment='通过评估数量'),
        sa.Column('failed_count', sa.Integer(), server_default=sa.text('0'), nullable=True, comment='失败评估数量'),
        sa.Column('unpassed_count', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='未通过评估数量'),
        sa.Column('success_rate', sa.Float(), server_default=sa.text('0'), nullable=True, comment='成功率'),
        sa.Column('status', sa.String(64), server_default=sa.text("'new'"), nullable=False, comment='任务执行状态, 如new, running, completed'),
        sa.Column('prompt_versions', mysql.JSON(), nullable=True, comment='评估执行时使用的提示词版本信息'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pipeline_id'], ['eval_pipelines.id'], ondelete='CASCADE'),
    )
    op.create_index('pipeline_id', 'eval_results', ['pipeline_id'])

    op.create_table('eval_cells',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pipeline_id', sa.Integer(), nullable=False),
        sa.Column('dataset_item_id', sa.Integer(), nullable=False),
        sa.Column('eval_column_id', sa.Integer(), nullable=False),
        sa.Column('result_id', sa.Integer(), nullable=False),
        sa.Column('display_value', mysql.JSON(), nullable=True, comment='显示值'),
        sa.Column('value', mysql.JSON(), nullable=True, comment='单元格的值'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('status', sa.String(64), nullable=True, comment='状态, 如new, running, completed, failed'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pipeline_id'], ['eval_pipelines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dataset_item_id'], ['dataset_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['eval_column_id'], ['eval_columns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['result_id'], ['eval_results.id'], ondelete='CASCADE'),
        comment='评估单元格'
    )
    op.create_index('dataset_item_id', 'eval_cells', ['dataset_item_id'])
    op.create_index('eval_column_id', 'eval_cells', ['eval_column_id'])
    op.create_index('pipeline_id', 'eval_cells', ['pipeline_id'])
    op.create_index('result_id', 'eval_cells', ['result_id'])

    op.create_table('eval_result_row_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('result_id', sa.Integer(), nullable=False, comment='评估结果ID'),
        sa.Column('dataset_item_id', sa.Integer(), nullable=False, comment='数据集项ID'),
        sa.Column('status', sa.String(32), server_default=sa.text("'pending'"), nullable=False, comment='任务状态：pending, running, completed, failed'),
        sa.Column('row_result', sa.String(32), nullable=True, comment='行执行结果：passed, unpassed, failed'),
        sa.Column('current_column_position', sa.Integer(), nullable=True, comment='当前执行到的列位置'),
        sa.Column('execution_variables', mysql.JSON(), nullable=True, comment='执行过程中的变量数据'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True, comment='总执行时间（毫秒）'),
        sa.Column('started_at', sa.TIMESTAMP(), nullable=True, comment='开始时间'),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True, comment='完成时间'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True, comment='创建时间'),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True, comment='更新时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('result_id', 'dataset_item_id', name='uk_result_dataset_item'),
        sa.ForeignKeyConstraint(['result_id'], ['eval_results.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dataset_item_id'], ['dataset_items.id'], ondelete='CASCADE'),
        comment='评估结果行任务表'
    )
    op.create_index('idx_dataset_item_id', 'eval_result_row_tasks', ['dataset_item_id'])
    op.create_index('idx_result_status', 'eval_result_row_tasks', ['result_id', 'status'])
    op.create_index('idx_status', 'eval_result_row_tasks', ['status'])

    op.create_table('eval_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('pipeline_id', sa.Integer(), nullable=False, comment='评估流水线ID'),
        sa.Column('result_id', sa.Integer(), nullable=False, comment='评估结果ID'),
        sa.Column('column_id', sa.Integer(), nullable=False, comment='评估列ID'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='用户ID'),
        sa.Column('task_type', sa.String(64), server_default=sa.text("'column_evaluation'"), nullable=False, comment='任务类型'),
        sa.Column('status', sa.String(32), server_default=sa.text("'pending'"), nullable=False, comment='任务状态：pending, running, paused, completed, failed, cancelled, retrying'),
        sa.Column('priority', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='任务优先级，数字越大优先级越高'),
        sa.Column('max_retries', sa.Integer(), server_default=sa.text('3'), nullable=False, comment='最大重试次数'),
        sa.Column('current_retry', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='当前重试次数'),
        sa.Column('total_items', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='总任务项数'),
        sa.Column('completed_items', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='已完成任务项数'),
        sa.Column('failed_items', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='失败任务项数'),
        sa.Column('config', mysql.JSON(), nullable=True, comment='任务配置信息'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('started_at', sa.TIMESTAMP(), nullable=True, comment='任务开始时间'),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True, comment='任务完成时间'),
        sa.Column('next_retry_at', sa.TIMESTAMP(), nullable=True, comment='下次重试时间'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True, comment='创建时间'),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True, comment='更新时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pipeline_id'], ['eval_pipelines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['column_id'], ['eval_columns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        comment='评估任务表'
    )
    op.create_index('column_id', 'eval_tasks', ['column_id'])
    op.create_index('idx_created_at', 'eval_tasks', ['created_at'])
    op.create_index('idx_next_retry', 'eval_tasks', ['next_retry_at'])
    op.create_index('idx_pipeline_column', 'eval_tasks', ['pipeline_id', 'column_id'])
    op.create_index('idx_status_priority', 'eval_tasks', ['status', 'priority'])
    op.create_index('idx_user_id', 'eval_tasks', ['user_id'])

    op.create_table('eval_task_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False, comment='任务ID'),
        sa.Column('cell_id', sa.Integer(), nullable=False, comment='评估单元格ID'),
        sa.Column('dataset_item_id', sa.Integer(), nullable=False, comment='数据集项ID'),
        sa.Column('status', sa.String(32), server_default=sa.text("'pending'"), nullable=False, comment='任务项状态：pending, running, completed, failed, skipped'),
        sa.Column('retry_count', sa.Integer(), server_default=sa.text('0'), nullable=False, comment='重试次数'),
        sa.Column('input_data', mysql.JSON(), nullable=True, comment='输入数据'),
        sa.Column('output_data', mysql.JSON(), nullable=True, comment='输出数据'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('execution_time_ms', sa.Integer(), nullable=True, comment='执行时间（毫秒）'),
        sa.Column('started_at', sa.TIMESTAMP(), nullable=True, comment='开始时间'),
        sa.Column('completed_at', sa.TIMESTAMP(), nullable=True, comment='完成时间'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True, comment='创建时间'),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True, comment='更新时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'cell_id', name='uk_task_cell'),
        sa.ForeignKeyConstraint(['task_id'], ['eval_tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cell_id'], ['eval_cells.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['dataset_item_id'], ['dataset_items.id'], ondelete='CASCADE'),
        comment='评估任务项表'
    )
    op.create_index('idx_cell_id', 'eval_task_items', ['cell_id'])
    op.create_index('idx_dataset_item_id', 'eval_task_items', ['dataset_item_id'])
    op.create_index('idx_status', 'eval_task_items', ['status'])
    op.create_index('idx_task_status', 'eval_task_items', ['task_id', 'status'])

    op.create_table('eval_task_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False, comment='任务ID'),
        sa.Column('task_item_id', sa.Integer(), nullable=True, comment='任务项ID，可为空'),
        sa.Column('level', sa.String(16), server_default=sa.text("'INFO'"), nullable=False, comment='日志级别：DEBUG, INFO, WARN, ERROR'),
        sa.Column('message', sa.Text(), nullable=False, comment='日志消息'),
        sa.Column('details', mysql.JSON(), nullable=True, comment='详细信息'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True, comment='创建时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['task_id'], ['eval_tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_item_id'], ['eval_task_items.id'], ondelete='CASCADE'),
        comment='评估任务日志表'
    )
    op.create_index('idx_created_at', 'eval_task_logs', ['created_at'])
    op.create_index('idx_level', 'eval_task_logs', ['level'])
    op.create_index('idx_task_item', 'eval_task_logs', ['task_item_id'])
    op.create_index('idx_task_level', 'eval_task_logs', ['task_id', 'level'])

    # ===== 旧版评估结果表（兼容保留）=====

    op.create_table('evaluation_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('evaluation_id', sa.Integer(), nullable=False),
        sa.Column('dataset_item_id', sa.Integer(), nullable=True),
        sa.Column('input', mysql.JSON(), server_default=sa.text("('{}')"), nullable=False, comment='JSON格式，包含完整的模型输入'),
        sa.Column('output', sa.Text(), nullable=True, comment='模型输出'),
        sa.Column('expected_output', sa.Text(), nullable=False, comment='期望输出'),
        sa.Column('passed', sa.Boolean(), server_default=sa.text('0'), nullable=True, comment='FALSE表示未通过，TRUE表示通过'),
        sa.Column('evaluation_details', sa.Text(), nullable=True, comment='JSON格式，包含评估详情'),
        sa.Column('tokens_used', sa.Integer(), nullable=True, comment='消耗的token'),
        sa.Column('execution_time', sa.Integer(), server_default=sa.text('-1'), nullable=False, comment='接口请求时间，毫秒'),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['dataset_item_id'], ['dataset_items.id'], ondelete='SET NULL'),
        comment='评估结果表'
    )
    op.create_index('dataset_item_id', 'evaluation_results', ['dataset_item_id'])
    op.create_index('evaluation_id', 'evaluation_results', ['evaluation_id'])


def downgrade() -> None:
    op.drop_table('evaluation_results')
    op.drop_table('eval_task_logs')
    op.drop_table('eval_task_items')
    op.drop_table('eval_tasks')
    op.drop_table('eval_result_row_tasks')
    op.drop_table('eval_cells')
    op.drop_table('eval_results')
    op.drop_table('eval_columns')
    op.drop_table('dataset_upload_errors')
    op.drop_table('dataset_upload_tasks')
    op.drop_table('dataset_items')
    op.drop_table('datasets')
    op.drop_table('eval_pipelines')
    op.drop_table('requests')
    op.drop_table('test_cases')
    op.drop_table('prompt_favorites')
    op.drop_table('prompt_tags')
    op.drop_table('prompt_versions')
    op.drop_table('prompts')
    op.drop_table('project_api_keys')
    op.drop_table('project_invitations')
    op.drop_table('project_members')
    op.drop_table('tags')
    op.drop_table('project_ai_feature_configs')
    op.drop_table('project_models')
    op.drop_table('model_provider_instances')
    op.drop_table('projects')
    op.drop_table('users')
