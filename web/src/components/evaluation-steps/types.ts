import type { ReactNode } from 'react';
import type { FormInstance } from 'antd';

// 步骤类型定义
export interface StepType {
  key: string;        // 步骤类型唯一标识
  name: string;       // 步骤类型显示名称
  description: string; // 步骤类型描述
  icon: ReactNode;     // 步骤类型图标
  category: string;    // 步骤分类
  supportsInputRef?: boolean; // 是否支持变量引用
  supportsExpectedRef?: boolean; // 是否支持期望值引用
  needsExecutionButton?: boolean; // 是否需要执行按钮
}

// 步骤配置组件的props
export interface StepProps {
  form: FormInstance;  // antd表单实例
  availableColumns: any[]; // 可用的前序列
  projectId: number;   // 项目ID
  previousColumns?: any[]; // 前序列（可选）
}

// 步骤配置
export interface StepConfig {
  [key: string]: any;
}

// 步骤执行结果
export interface StepResult {
  output?: any;        // 输出结果
  passed?: boolean;    // 是否通过
  details?: any;       // 详细信息
  error?: string;      // 错误信息
}

export interface EvalCellDTO {
  column_name: string;
  created_at: string;
  dataset_item_id: number;
  display_value: {
    value: string;
  } | null;
  error_message: string | null;
  eval_column_id: number;
  id: number;
  pipeline_id: number;
  result_id: number;
  status: string;
  updated_at: string;
  value: {
    value: any;
  };
}

// 结果展示组件的props
export interface CellResultProps {
  cell: EvalCellDTO;
  status?: string | null;           // 状态
  stepType: string;         // 步骤类型
  column: any;              // 列数据
  onSaveHumanInput?: (value: any) => void; // 保存人工输入的回调
} 