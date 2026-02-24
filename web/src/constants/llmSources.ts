/**
 * LLM请求来源定义
 * 用于追踪和识别每个LLM调用的具体来源
 */

export const LLM_REQUEST_SOURCES = {
  // 提示词编辑器相关
  PROMPT_EDITOR_TEST: 'prompt_editor_test',           // 提示词编辑器测试运行
  PROMPT_EDITOR_TRANSLATE: 'prompt_editor_translate', // 提示词翻译功能
  
  // 测试用例生成
  TEST_CASE_GENERATOR: 'test_case_generator',         // 自动生成测试用例
  
  // 提示词优化器
  PROMPT_OPTIMIZER_EVALUATE: 'prompt_optimizer_evaluate',     // 优化器评估
  PROMPT_OPTIMIZER_OPTIMIZE: 'prompt_optimizer_optimize',     // 优化器优化分析
  PROMPT_OPTIMIZER_TEST: 'prompt_optimizer_test',             // 优化器测试运行
  
  // 提示词助手
  PROMPT_ASSISTANT_CHAT: 'prompt_assistant_chat',             // 助手聊天模式
  PROMPT_ASSISTANT_AGENT: 'prompt_assistant_agent',           // 助手智能模式
  PROMPT_ASSISTANT_INTENT: 'prompt_assistant_intent',         // 助手意图分析
  PROMPT_ASSISTANT_EDIT: 'prompt_assistant_edit',             // 助手编辑功能
  PROMPT_ASSISTANT_SUGGESTION: 'prompt_assistant_suggestion', // 助手建议生成
  PROMPT_ASSISTANT_QUICKSTART: 'prompt_assistant_quickstart', // 助手快速开始
  
  // 其他功能
  DASHBOARD: 'dashboard',                             // 仪表板通用调用
  API_TEST: 'api_test',                              // API测试
} as const;
