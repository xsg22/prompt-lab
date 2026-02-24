export interface RowTask {
  id: number;
  result_id: number;
  dataset_item_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  row_result?: 'passed' | 'unpassed' | 'failed';
  current_column_position?: number;
  execution_variables?: Record<string, any>;
  error_message?: string;
  execution_time_ms?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RowTaskProgress {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  progress_percent: number;
}

export interface RowTaskExecutionStats {
  total: number;
  passed: number;
  unpassed: number;
  failed: number;
  success_rate: number;
  completed: number;
  pending: number;
  running: number;
} 