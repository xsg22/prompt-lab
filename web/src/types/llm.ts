
export interface LLMCallResponse {
    cost: number;
    execution_time: number;
    message: string;
    tokens: {
        prompt: number;
        completion: number;
        total: number;
    };
    params: any;
}

// 原有的ModelConfig保持不变
export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  language?: 'zh' | 'en' | 'compare';
}

// 新增：提供商配置字段定义
export interface ProviderField {
  key: string;           // 字段key，如 'api_key', 'base_url'
  name: string;         // 显示名称
  type: 'input' | 'password' | 'select' | 'number' | 'textarea' | 'url' | 'boolean';
  required: boolean;     // 是否必填
  placeholder?: string;  // 占位符
  description?: string;  // 字段说明
  options?: Array<{label: string, value: string}>; // select类型的选项
  default?: string | number; // 默认值
}

// 新增：默认模型信息
export interface DefaultModel {
  model_id: string;            // 模型ID，如 'gpt-4o'
  name: string;          // 显示名称，如 'GPT-4o'
  description?: string;  // 模型描述
  context_window?: number; // 上下文窗口大小
  input_cost_per_token?: number;   // 输入价格（每1K tokens）
  output_cost_per_token?: number;  // 输出价格（每1K tokens）
  supports_streaming?: boolean; // 是否支持流式输出
  supports_tools?: boolean; // 是否支持函数调用
  supports_vision?: boolean;    // 是否支持视觉
  max_tokens?: number;    // 最大输出tokens
}


// 新增：提供商定义
export interface ProviderDefinition {
  id: string;            // 提供商ID，如 'openai'
  name: string;          // 显示名称，如 'OpenAI'
  description?: string;  // 提供商描述
  icon?: string;         // 图标URL或emoji
  website?: string;      // 官网链接
  fields: ProviderField[]; // 配置字段
  default_models: DefaultModel[]; // 默认模型列表
  support_custom_models: boolean;  // 是否支持自定义模型
}

// 新增：用户配置的提供商实例
export interface ProviderInstance {
  id: number;            // 实例ID
  provider_type: string;    // 提供商ID
  name?: string;         // 自定义名称
  config: Record<string, any>; // 配置值
  is_enabled: boolean;      // 是否启用
  enabled_models: string[]; // 启用的模型ID列表
  custom_models: CustomModel[]; // 自定义模型
  createdAt: string;
  updatedAt: string;
}

// 新增：自定义模型
export interface CustomModel {
  id: number;
  name: string;          // 显示名称
  model_id: string;      // 实际调用的模型ID
  description?: string;
  context_window?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  supports_streaming?: boolean;
  supports_tools?: boolean;
  supports_vision?: boolean;
  max_tokens?: number;
}


// 新增：可用模型（用于前端选择）
export interface AvailableModel {
  id: string;            // 唯一标识
  provider_type: string;    // 提供商ID
  provider_name: string;  // 提供商名称
  model_id: string;       // 模型ID
  name: string;          // 显示名称
  description?: string;
  type: 'default' | 'custom'; // 模型类型
  context_window?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  supports_streaming?: boolean;
  supports_tools?: boolean;
  supports_vision?: boolean;
  max_tokens?: number;
}

// 新增：模型调用配置
export interface ModelCallConfig extends ModelConfig {
  providerInstanceId: number; // 使用的提供商实例ID
}
