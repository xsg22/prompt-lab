/**
 * 数据集相关类型定义
 */

// 数据集
export interface Dataset {
  id: string;
  name: string;
  description: string;
  prompt_id: number;
  prompt_version_id: number;
  created_at: string;
  updated_at: string;
  variables?: string[];
}

// 数据集条目
export interface DatasetItem {
  id: string;
  dataset_id: string;
  name: string;
  expected_output: string;
  variables_values: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
  updated_at?: string;
} 