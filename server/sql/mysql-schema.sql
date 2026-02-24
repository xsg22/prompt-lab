create table if not exists alembic_version
(
    version_num varchar(32) not null
        primary key
);

create table if not exists datasets
(
    id                    int auto_increment
        primary key,
    user_id               bigint                              null,
    name                  text                                not null,
    description           text                                null,
    variables             json      default (_utf8mb4'[]')    not null comment '以JSON格式存储的变量列表',
    created_at            timestamp default CURRENT_TIMESTAMP null,
    updated_at            timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    project_id            int                                 null comment '项目id',
    eval_pipeline_id      int                                 null,
    variable_descriptions json      default (_utf8mb4'{}')    not null comment '以JSON格式存储的变量描述'
)
    comment '数据集表';

create table if not exists dataset_items
(
    id               int auto_increment
        primary key,
    dataset_id       int                                  not null,
    name             varbinary(64)                        null,
    expected_output  text                                 null,
    variables_values json       default (_utf8mb4'{}')    not null comment 'JSON存储测试用例变量值',
    is_enabled       tinyint(1) default 0                 null comment 'FALSE表示未启用，TRUE表示已启用',
    created_at       timestamp  default CURRENT_TIMESTAMP null,
    updated_at       timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    variables        text                                 null,
    metadata         text                                 null,
    constraint dataset_items_ibfk_1
        foreign key (dataset_id) references datasets (id)
            on delete cascade
)
    comment '数据集条目表';

create index dataset_id
    on dataset_items (dataset_id);

create index eval_pipeline_id
    on datasets (eval_pipeline_id);

create table if not exists evaluation_results
(
    id                 int auto_increment
        primary key,
    evaluation_id      int                                  not null,
    dataset_item_id    int                                  null,
    input              json       default (_utf8mb4'{}')    not null comment 'JSON格式，包含完整的模型输入',
    output             text                                 null comment '模型输出',
    expected_output    text                                 not null comment '期望输出',
    passed             tinyint(1) default 0                 null comment 'FALSE表示未通过，TRUE表示通过',
    evaluation_details text                                 null comment 'JSON格式，包含评估详情',
    tokens_used        int                                  null comment '消耗的token',
    execution_time     int        default -1                not null comment '接口请求时间，毫秒',
    created_at         timestamp  default CURRENT_TIMESTAMP null,
    updated_at         timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint evaluation_results_ibfk_2
        foreign key (dataset_item_id) references dataset_items (id)
            on delete set null
)
    comment '评估结果表';

create index dataset_item_id
    on evaluation_results (dataset_item_id);

create index evaluation_id
    on evaluation_results (evaluation_id);

create table if not exists project_ai_feature_configs
(
    id          int auto_increment
        primary key,
    project_id  int                                not null comment '所属项目ID',
    feature_key varchar(64)                        not null comment '功能标识',
    provider    varchar(64)                        not null comment '模型提供商',
    model_id    varchar(128)                       not null comment '模型ID',
    created_at  datetime default (now())           not null comment '创建时间',
    updated_at  datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint project_id
        unique (project_id, feature_key) comment '项目ID和功能标识唯一索引'
)
    comment 'AI功能模型配置表，存储各功能使用的模型配置';

create table if not exists projects
(
    id          int auto_increment
        primary key,
    name        varchar(255)                       not null,
    webhook_url varchar(255)                       null comment 'webhook url',
    created_at  datetime default CURRENT_TIMESTAMP null,
    updated_at  datetime default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
)
    comment '项目表';

create table if not exists model_provider_instances
(
    id                int auto_increment
        primary key,
    name              varchar(255)                       not null comment '实例名称，用户自定义',
    provider_type     varchar(50)                        not null comment '提供商类型，如openai、anthropic等',
    project_id        int                                not null comment '所属项目ID',
    config            json        default (_utf8mb4'{}') not null comment '提供商配置信息，如API密钥、base_url等',
    is_enabled        tinyint(1)  default 1              not null comment '是否启用',
    enabled_models    json        default (_utf8mb4'[]') not null comment '启用的模型ID列表',
    last_tested_at    datetime                           null comment '最后测试时间',
    connection_status varchar(20) default 'unknown'      not null comment '连接状态：connected, failed, unknown',
    error_message     text                               null comment '连接错误信息',
    created_at        datetime                           not null,
    updated_at        datetime                           not null,
    custom_models     json                               not null comment '自定义模型列表',
    constraint model_provider_instances_ibfk_1
        foreign key (project_id) references projects (id)
);

create index ix_model_provider_instances_id
    on model_provider_instances (id);

create index project_id
    on model_provider_instances (project_id);

create table if not exists project_models
(
    id                    int auto_increment
        primary key,
    name                  varchar(255)                      not null comment '模型显示名称',
    model_id              varchar(255)                      not null comment '模型ID，用于API调用',
    provider_instance_id  int                               not null comment '关联的提供商实例ID',
    project_id            int                               not null comment '所属项目ID',
    description           varchar(500)                      null comment '模型描述',
    context_window        int                               null comment '上下文窗口大小',
    input_cost_per_token  float                             null comment '输入token单价',
    output_cost_per_token float                             null comment '输出token单价',
    supports_streaming    tinyint(1) default 1              not null comment '是否支持流式输出',
    supports_tools        tinyint(1) default 0              not null comment '是否支持工具调用',
    supports_vision       tinyint(1) default 0              not null comment '是否支持视觉功能',
    config                json       default (_utf8mb4'{}') not null comment '模型特定配置',
    is_enabled            tinyint(1) default 1              not null comment '是否启用',
    created_at            datetime                          not null,
    updated_at            datetime                          not null,
    constraint project_models_ibfk_1
        foreign key (project_id) references projects (id),
    constraint project_models_ibfk_2
        foreign key (provider_instance_id) references model_provider_instances (id)
);

create index ix_project_models_id
    on project_models (id);

create index project_id
    on project_models (project_id);

create index provider_instance_id
    on project_models (provider_instance_id);

create table if not exists prompts
(
    id          int auto_increment
        primary key,
    name        varchar(255)                          not null,
    description text                                  null,
    user_id     bigint                                null,
    created_at  timestamp   default CURRENT_TIMESTAMP null,
    updated_at  timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    project_id  int                                   null comment '项目id',
    is_public   tinyint(1)  default 0                 not null comment '是否公开',
    category    varchar(50)                           null comment '分类',
    priority    int         default 0                 not null comment '优先级',
    status      varchar(16) default 'active'          not null comment 'active, archived, draft',
    is_template tinyint(1)  default 0                 not null comment '是否为模板'
)
    comment '提示词模板表';

create table if not exists prompt_versions
(
    id             int auto_increment
        primary key,
    prompt_id      int                                    not null,
    version_number int                                    not null,
    messages       text                                   not null comment '以JSON格式存储的messages',
    variables      json         default (_utf8mb4'[]')    not null comment '以JSON格式存储的变量列表',
    model_name     varchar(128) default 'gpt-3.5-turbo'   null comment '存储实际使用的模型名称',
    model_params   json         default (_utf8mb4'{}')    not null comment '以JSON格式存储模型参数',
    created_at     timestamp    default CURRENT_TIMESTAMP null,
    updated_at     timestamp    default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint prompt_id
        unique (prompt_id, version_number),
    constraint prompt_versions_ibfk_1
        foreign key (prompt_id) references prompts (id)
            on delete cascade
)
    comment '模板版本表';

create table if not exists requests
(
    id                int auto_increment
        primary key,
    prompt_version_id int                                  null,
    source            varchar(32)                          null comment '输出的来源，playground、evaluation、api',
    input             json       default (_utf8mb4'{}')    not null comment '包含完整的模型输入，JSON格式',
    variables_values  json       default (_utf8mb4'{}')    not null comment 'message里包含的变量值，JSON格式',
    output            text                                 null comment '模型输出',
    prompt_tokens     int                                  null comment 'prompt tokens',
    completion_tokens int                                  null comment 'completion tokens',
    total_tokens      int                                  null comment 'total tokens',
    execution_time    int        default -1                not null comment '接口请求时间，毫秒',
    cost              varchar(16)                          null comment '花费',
    success           tinyint(1) default 0                 null comment '是否成功',
    error_message     text                                 null comment '错误信息',
    created_at        timestamp  default CURRENT_TIMESTAMP null,
    updated_at        timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    project_id        int        default 1                 not null comment '项目id',
    user_id           int        default 1                 not null comment '用户id',
    prompt_id         int                                  null comment '提示词ID'
)
    comment '输出结果表';

create index prompt_version_id
    on requests (prompt_version_id);

create table if not exists tags
(
    id         int auto_increment
        primary key,
    name       varchar(50)                        not null comment '标签名称',
    color      varchar(7)                         null comment '标签颜色',
    project_id int                                not null comment '项目id',
    created_at datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint tags_ibfk_1
        foreign key (project_id) references projects (id)
);

create table if not exists prompt_tags
(
    id         int auto_increment
        primary key,
    prompt_id  int                                not null comment '提示词id',
    tag_id     int                                not null comment '标签id',
    created_at datetime default CURRENT_TIMESTAMP null,
    updated_at datetime default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint prompt_tags_ibfk_1
        foreign key (prompt_id) references prompts (id)
            on delete cascade,
    constraint prompt_tags_ibfk_2
        foreign key (tag_id) references tags (id)
            on delete cascade
)
    comment '提示词标签关联表';

create index prompt_id
    on prompt_tags (prompt_id);

create index tag_id
    on prompt_tags (tag_id);

create index idx_tags_name
    on tags (name);

create index project_id
    on tags (project_id);

create table if not exists test_cases
(
    id                int auto_increment
        primary key,
    prompt_version_id int                                 not null,
    name              varchar(255)                        null,
    variables_values  json      default (_utf8mb4'{}')    not null comment '以JSON格式存储的变量值',
    created_at        timestamp default CURRENT_TIMESTAMP null,
    updated_at        timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    metadatas         json                                null comment '以JSON格式存储的元数据',
    constraint test_cases_ibfk_1
        foreign key (prompt_version_id) references prompt_versions (id)
            on delete cascade
)
    comment '测试用例表';

create index prompt_version_id
    on test_cases (prompt_version_id);

create table if not exists users
(
    id                 int auto_increment
        primary key,
    username           varchar(255)                         not null,
    email              varchar(255)                         null,
    password           varchar(255)                         not null,
    nickname           varchar(255)                         null,
    is_active          int        default 1                 not null,
    created_at         datetime   default CURRENT_TIMESTAMP null,
    updated_at         datetime   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    current_project_id int                                  null comment '当前项目id',
    avatar_url         varchar(255)                         null comment '头像URL',
    constraint username
        unique (username),
    constraint email
        unique (email)
)
    comment '用户表';

create table if not exists dataset_upload_tasks
(
    id             int auto_increment
        primary key,
    dataset_id     int                                   not null,
    user_id        int                                   not null,
    status         varchar(32) default 'pending'         not null comment 'pending, processing, completed, failed',
    total_rows     int         default 0                 not null comment '总行数',
    processed_rows int         default 0                 not null comment '已处理行数',
    success_rows   int         default 0                 not null comment '成功行数',
    failed_rows    int         default 0                 not null comment '失败行数',
    file_name      varchar(255)                          not null comment '文件名',
    error_details  json        default (_utf8mb4'[]')    not null comment '错误详情',
    completed_at   timestamp                             null comment '完成时间',
    created_at     timestamp   default CURRENT_TIMESTAMP null,
    updated_at     timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint dataset_upload_tasks_ibfk_1
        foreign key (dataset_id) references datasets (id)
            on delete cascade,
    constraint dataset_upload_tasks_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
)
    comment '数据集上传任务表';

create table if not exists dataset_upload_errors
(
    id             int auto_increment
        primary key,
    upload_task_id int                                 not null,
    `row_number`   int                                 not null comment '行号',
    error_type     varchar(100)                        not null comment '错误类型',
    error_message  text                                null comment '错误信息',
    row_data       json                                null comment '行数据',
    created_at     timestamp default CURRENT_TIMESTAMP null,
    updated_at     timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint dataset_upload_errors_ibfk_1
        foreign key (upload_task_id) references dataset_upload_tasks (id)
            on delete cascade
)
    comment '数据集上传错误记录表';

create index idx_upload_errors_task
    on dataset_upload_errors (upload_task_id);

create index idx_upload_tasks_dataset_user
    on dataset_upload_tasks (dataset_id, user_id);

create index idx_upload_tasks_status
    on dataset_upload_tasks (status);

create index user_id
    on dataset_upload_tasks (user_id);

create table if not exists eval_pipelines
(
    id          int auto_increment
        primary key,
    name        text                                not null,
    project_id  int                                 not null,
    user_id     int                                 not null,
    description text                                null,
    dataset_id  int                                 not null,
    created_at  timestamp default CURRENT_TIMESTAMP null,
    updated_at  timestamp default CURRENT_TIMESTAMP null,
    constraint eval_pipelines_ibfk_1
        foreign key (project_id) references projects (id)
            on delete cascade,
    constraint eval_pipelines_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
);

create table if not exists eval_columns
(
    id          int auto_increment
        primary key,
    pipeline_id int                                 not null,
    name        text                                not null,
    column_type text                                not null,
    position    int                                 not null,
    config      text                                null,
    created_at  timestamp default CURRENT_TIMESTAMP null,
    updated_at  timestamp default CURRENT_TIMESTAMP null,
    constraint eval_columns_ibfk_1
        foreign key (pipeline_id) references eval_pipelines (id)
            on delete cascade
);

create index pipeline_id
    on eval_columns (pipeline_id);

create index dataset_id
    on eval_pipelines (dataset_id);

create index project_id
    on eval_pipelines (project_id);

create index user_id
    on eval_pipelines (user_id);

create table if not exists eval_results
(
    id              int auto_increment
        primary key,
    pipeline_id     int                                   not null,
    created_at      timestamp   default CURRENT_TIMESTAMP null,
    updated_at      timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    run_type        varchar(64)                           not null comment '执行方式, 如staging、release, scheduled',
    total_count     int         default 0                 null comment '总评估数量',
    passed_count    int         default 0                 null comment '通过评估数量',
    failed_count    int         default 0                 null comment '失败评估数量',
    unpassed_count  int         default 0                 not null comment '未通过评估数量',
    success_rate    float       default 0                 null comment '成功率',
    status          varchar(64) default 'new'             not null comment '任务执行状态, 如new, running, completed',
    prompt_versions json                                  null comment '评估执行时使用的提示词版本信息',
    constraint eval_results_ibfk_1
        foreign key (pipeline_id) references eval_pipelines (id)
            on delete cascade
);

create table if not exists eval_cells
(
    id              int auto_increment
        primary key,
    pipeline_id     int                                 not null,
    dataset_item_id int                                 not null,
    eval_column_id  int                                 not null,
    result_id       int                                 not null,
    display_value   json                                null comment '显示值',
    value           json                                null comment '单元格的值',
    error_message   text                                null comment '错误信息',
    status          varchar(64)                         null comment '状态, 如new, running, completed, failed',
    created_at      timestamp default CURRENT_TIMESTAMP null,
    updated_at      timestamp default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint eval_cells_ibfk_1
        foreign key (pipeline_id) references eval_pipelines (id)
            on delete cascade,
    constraint eval_cells_ibfk_2
        foreign key (dataset_item_id) references dataset_items (id)
            on delete cascade,
    constraint eval_cells_ibfk_3
        foreign key (eval_column_id) references eval_columns (id)
            on delete cascade,
    constraint eval_cells_ibfk_4
        foreign key (result_id) references eval_results (id)
            on delete cascade
)
    comment '评估单元格';

create index dataset_item_id
    on eval_cells (dataset_item_id);

create index eval_column_id
    on eval_cells (eval_column_id);

create index pipeline_id
    on eval_cells (pipeline_id);

create index result_id
    on eval_cells (result_id);

create table if not exists eval_result_row_tasks
(
    id                      int auto_increment
        primary key,
    result_id               int                                   not null comment '评估结果ID',
    dataset_item_id         int                                   not null comment '数据集项ID',
    status                  varchar(32) default 'pending'         not null comment '任务状态：pending, running, completed, failed',
    row_result              varchar(32)                           null comment '行执行结果：passed, unpassed, failed',
    current_column_position int                                   null comment '当前执行到的列位置',
    execution_variables     json                                  null comment '执行过程中的变量数据',
    error_message           text                                  null comment '错误信息',
    execution_time_ms       int                                   null comment '总执行时间（毫秒）',
    started_at              timestamp                             null comment '开始时间',
    completed_at            timestamp                             null comment '完成时间',
    created_at              timestamp   default CURRENT_TIMESTAMP null comment '创建时间',
    updated_at              timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint uk_result_dataset_item
        unique (result_id, dataset_item_id),
    constraint eval_result_row_tasks_ibfk_1
        foreign key (result_id) references eval_results (id)
            on delete cascade,
    constraint eval_result_row_tasks_ibfk_2
        foreign key (dataset_item_id) references dataset_items (id)
            on delete cascade
)
    comment '评估结果行任务表';

create index idx_dataset_item_id
    on eval_result_row_tasks (dataset_item_id);

create index idx_result_status
    on eval_result_row_tasks (result_id, status);

create index idx_status
    on eval_result_row_tasks (status);

create index pipeline_id
    on eval_results (pipeline_id);

create table if not exists eval_tasks
(
    id              int auto_increment
        primary key,
    pipeline_id     int                                     not null comment '评估流水线ID',
    result_id       int                                     not null comment '评估结果ID',
    column_id       int                                     not null comment '评估列ID',
    user_id         int                                     not null comment '用户ID',
    task_type       varchar(64) default 'column_evaluation' not null comment '任务类型',
    status          varchar(32) default 'pending'           not null comment '任务状态：pending, running, paused, completed, failed, cancelled, retrying',
    priority        int         default 0                   not null comment '任务优先级，数字越大优先级越高',
    max_retries     int         default 3                   not null comment '最大重试次数',
    current_retry   int         default 0                   not null comment '当前重试次数',
    total_items     int         default 0                   not null comment '总任务项数',
    completed_items int         default 0                   not null comment '已完成任务项数',
    failed_items    int         default 0                   not null comment '失败任务项数',
    config          json                                    null comment '任务配置信息',
    error_message   text                                    null comment '错误信息',
    started_at      timestamp                               null comment '任务开始时间',
    completed_at    timestamp                               null comment '任务完成时间',
    next_retry_at   timestamp                               null comment '下次重试时间',
    created_at      timestamp   default CURRENT_TIMESTAMP   null comment '创建时间',
    updated_at      timestamp   default CURRENT_TIMESTAMP   null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint eval_tasks_ibfk_1
        foreign key (pipeline_id) references eval_pipelines (id)
            on delete cascade,
    constraint eval_tasks_ibfk_2
        foreign key (column_id) references eval_columns (id)
            on delete cascade,
    constraint eval_tasks_ibfk_3
        foreign key (user_id) references users (id)
            on delete cascade
)
    comment '评估任务表';

create table if not exists eval_task_items
(
    id                int auto_increment
        primary key,
    task_id           int                                   not null comment '任务ID',
    cell_id           int                                   not null comment '评估单元格ID',
    dataset_item_id   int                                   not null comment '数据集项ID',
    status            varchar(32) default 'pending'         not null comment '任务项状态：pending, running, completed, failed, skipped',
    retry_count       int         default 0                 not null comment '重试次数',
    input_data        json                                  null comment '输入数据',
    output_data       json                                  null comment '输出数据',
    error_message     text                                  null comment '错误信息',
    execution_time_ms int                                   null comment '执行时间（毫秒）',
    started_at        timestamp                             null comment '开始时间',
    completed_at      timestamp                             null comment '完成时间',
    created_at        timestamp   default CURRENT_TIMESTAMP null comment '创建时间',
    updated_at        timestamp   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint uk_task_cell
        unique (task_id, cell_id),
    constraint eval_task_items_ibfk_1
        foreign key (task_id) references eval_tasks (id)
            on delete cascade,
    constraint eval_task_items_ibfk_2
        foreign key (cell_id) references eval_cells (id)
            on delete cascade,
    constraint eval_task_items_ibfk_3
        foreign key (dataset_item_id) references dataset_items (id)
            on delete cascade
)
    comment '评估任务项表';

create index idx_cell_id
    on eval_task_items (cell_id);

create index idx_dataset_item_id
    on eval_task_items (dataset_item_id);

create index idx_status
    on eval_task_items (status);

create index idx_task_status
    on eval_task_items (task_id, status);

create table if not exists eval_task_logs
(
    id           int auto_increment
        primary key,
    task_id      int                                   not null comment '任务ID',
    task_item_id int                                   null comment '任务项ID，可为空',
    level        varchar(16) default 'INFO'            not null comment '日志级别：DEBUG, INFO, WARN, ERROR',
    message      text                                  not null comment '日志消息',
    details      json                                  null comment '详细信息',
    created_at   timestamp   default CURRENT_TIMESTAMP null comment '创建时间',
    constraint eval_task_logs_ibfk_1
        foreign key (task_id) references eval_tasks (id)
            on delete cascade,
    constraint eval_task_logs_ibfk_2
        foreign key (task_item_id) references eval_task_items (id)
            on delete cascade
)
    comment '评估任务日志表';

create index idx_created_at
    on eval_task_logs (created_at);

create index idx_level
    on eval_task_logs (level);

create index idx_task_item
    on eval_task_logs (task_item_id);

create index idx_task_level
    on eval_task_logs (task_id, level);

create index column_id
    on eval_tasks (column_id);

create index idx_created_at
    on eval_tasks (created_at);

create index idx_next_retry
    on eval_tasks (next_retry_at);

create index idx_pipeline_column
    on eval_tasks (pipeline_id, column_id);

create index idx_status_priority
    on eval_tasks (status, priority);

create index idx_user_id
    on eval_tasks (user_id);

create table if not exists project_api_keys
(
    id           int auto_increment comment '主键ID'
        primary key,
    project_id   int          not null comment '项目ID',
    name         varchar(255) not null comment 'API Key名称',
    key_hash     varchar(255) not null comment 'API Key哈希值',
    status       varchar(20)  not null comment '状态：active/inactive',
    expires_at   datetime     null comment '过期时间',
    created_by   int          not null comment '创建者用户ID',
    last_used_at datetime     null comment '最后使用时间',
    usage_count  int          not null comment '使用次数',
    description  text         null comment '描述',
    created_at   datetime     not null comment '创建时间',
    updated_at   datetime     not null comment '更新时间',
    constraint uq_project_api_keys_key_hash
        unique (key_hash),
    constraint fk_project_api_keys_created_by
        foreign key (created_by) references users (id),
    constraint fk_project_api_keys_project_id
        foreign key (project_id) references projects (id)
)
    comment '项目API密钥表';

create index ix_project_api_keys_expires_at
    on project_api_keys (expires_at);

create index ix_project_api_keys_project_id
    on project_api_keys (project_id);

create index ix_project_api_keys_status
    on project_api_keys (status);

create table if not exists project_invitations
(
    id         int auto_increment
        primary key,
    project_id int                                  not null comment '项目id',
    user_id    int                                  not null comment '邀请人id',
    token      varchar(64)                          not null comment '邀请token，唯一键',
    role       varchar(16)                          not null comment 'admin, member, readonly',
    is_expired tinyint(1) default 0                 null comment '是否过期',
    created_at datetime   default CURRENT_TIMESTAMP null,
    updated_at datetime   default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint idx_project_invitations_token
        unique (token),
    constraint project_invitations_ibfk_1
        foreign key (project_id) references projects (id)
            on delete cascade,
    constraint project_invitations_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
)
    comment '项目邀请表';

create index project_id
    on project_invitations (project_id);

create index user_id
    on project_invitations (user_id);

create table if not exists project_members
(
    id         int auto_increment
        primary key,
    project_id int                                not null,
    user_id    int                                not null,
    role       varchar(16)                        not null comment 'member, admin',
    created_at datetime default CURRENT_TIMESTAMP null,
    updated_at datetime default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint project_members_ibfk_1
        foreign key (project_id) references projects (id)
            on delete cascade,
    constraint project_members_ibfk_2
        foreign key (user_id) references users (id)
            on delete cascade
)
    comment '项目成员表';

create index project_id
    on project_members (project_id);

create index user_id
    on project_members (user_id);

create table if not exists prompt_favorites
(
    id         int auto_increment
        primary key,
    user_id    int                                not null comment '用户id',
    prompt_id  int                                not null comment '提示词id',
    created_at datetime default CURRENT_TIMESTAMP null,
    updated_at datetime default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint idx_prompt_favorites_user_prompt
        unique (user_id, prompt_id),
    constraint prompt_favorites_ibfk_1
        foreign key (user_id) references users (id)
            on delete cascade,
    constraint prompt_favorites_ibfk_2
        foreign key (prompt_id) references prompts (id)
            on delete cascade
)
    comment '提示词收藏表';

create index prompt_id
    on prompt_favorites (prompt_id);

