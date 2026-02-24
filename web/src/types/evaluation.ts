export interface EvalResult {
    id: number;
    pipeline_id: number;
    run_type: string;
    created_at: string;
    updated_at: string;
    status?: string; // 状态, 如new, running, completed
    // 新增统计字段
    total_count?: number;
    passed_count?: number;
    failed_count?: number;
    unpassed_count?: number;
    success_rate?: number;
    // 提示词版本信息
    prompt_versions?: {[key: string]: {
        prompt_id: number;
        prompt_name: string;
        version_id?: number;
        version_number: number;
        column_id: number;
        column_name: string;
        error?: string;
    }};
  }