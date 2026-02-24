// 提示词助理相关类型定义

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'system' | 'action_proposal';
  mode?: 'chat' | 'agent'; // 新增：消息模式
  streamingContent?: string; // 新增：流式输出内容
  isStreaming?: boolean; // 新增：是否正在流式输出
  error?: boolean; // 新增：是否为错误消息
}

// 新增：助理操作模式
export type AssistantMode = 'chat' | 'agent';

// 新增：修改操作类型
export interface PromptModification {
  id: string;
  type: 'add_message' | 'modify_message' | 'delete_message' | 'reorder_messages' | 'add_variable' | 'modify_variable' | 'delete_variable';
  target: {
    messageIndex?: number;
    messageId?: string;
    variableName?: string;
  };
  change: {
    newContent?: string;
    newRole?: 'system' | 'user' | 'assistant';
    newOrder?: number;
    variableInfo?: {
      name: string;
      description?: string;
      defaultValue?: string;
      required?: boolean;
    };
  };
  preview?: string; // 修改预览
  reasoning: string; // 修改理由
}

// 新增：动作提案
export interface ActionProposal {
  id: string;
  title: string;
  description: string;
  modifications: PromptModification[];
  confidence: number;
  tags: string[];
  estimatedImpact: 'low' | 'medium' | 'high';
  category: 'structure' | 'content' | 'variables' | 'optimization';
  previewDiff?: string; // 差异预览
  isApproved?: boolean;
  isApplied?: boolean;
}

export interface Suggestion {
  id: string;
  type: 'prompt_improvement' | 'variable_suggestion' | 'template_recommendation' | 'structure_optimization';
  title: string;
  content: string;
  proposedChanges?: ProposedChange[];
  reasoning: string;
  confidence: number; // 0-100
  tags: string[];
  isApplied?: boolean;
  // 新增：区分模式
  mode: 'chat' | 'agent';
  actionProposal?: ActionProposal; // Agent模式下的具体修改提案
}

export interface ProposedChange {
  type: 'add_message' | 'modify_message' | 'delete_message' | 'add_variable' | 'modify_variable';
  messageIndex?: number;
  oldContent?: string;
  newContent?: string;
  role?: string;
  variableName?: string;
  variableDescription?: string;
}

export interface AssistantState {
  messages: ChatMessage[];
  suggestions: Suggestion[];
  isLoading: boolean;
  isThinking: boolean;
  currentSuggestion: Suggestion | null;
  // 新增状态
  mode: AssistantMode;
  isStreaming: boolean;
  pendingActions: ActionProposal[];
  replySuggestions: string[];
  isLoadingSuggestions: boolean;
  shouldGenerateSuggestions?: boolean; // 新增：标记是否需要生成回复建议
}

export interface AssistantContext {
  currentMessages: Array<{
    role: string;
    content: string;
    order: number;
  }>;
  variables: string[];
  testCases: any[];
  userGoal?: string;
  domain?: string;
  language: 'zh' | 'en' | 'compare';
  promptName?: string; // 提示词名称
}

export interface QuickActionItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: () => void;
  disabled?: boolean;
}

// 助理能力类型
export type AssistantCapability = 
  | 'prompt_analysis'      // 提示词分析
  | 'structure_suggestion' // 结构建议  
  | 'variable_optimization' // 变量优化
  | 'template_generation'  // 模板生成
  | 'best_practices'       // 最佳实践
  | 'troubleshooting';     // 问题诊断

// 扩展用户意图类型
export type UserIntent = 
  | 'improve_prompt'       // 改进提示词 (可能是agent)
  | 'create_template'      // 创建模板 (可能是agent)
  | 'add_variables'        // 添加变量 (可能是agent)
  | 'fix_issues'          // 修复问题 (可能是agent)
  | 'optimize_performance' // 优化性能 (可能是agent)
  | 'modify_content'       // 修改内容 (agent)
  | 'restructure_prompt'   // 重构提示词 (agent)
  | 'general_question'     // 一般问题 (chat)
  | 'consultation'         // 咨询建议 (chat)
  | 'explanation';         // 解释说明 (chat)

// 新增：响应类型
export interface AssistantResponse {
  mode: AssistantMode;
  content: string;
  actionProposal?: ActionProposal;
  suggestions?: Suggestion[];
  requiresApproval?: boolean;
}

export interface AssistantConfig {
  maxChatHistory: number;
  suggestionLimit: number;
  autoSuggest: boolean;
  showConfidence: boolean;
  // 新增配置
  defaultMode: AssistantMode;
  enableStreaming: boolean;
  enablePreview: boolean;
} 