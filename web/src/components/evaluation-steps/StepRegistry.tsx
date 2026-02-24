import type { StepType } from './types';

import {
  FileTextOutlined,
  UserOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  PartitionOutlined} from '@ant-design/icons';

// 步骤类型注册表
export const getStepTypes = (): StepType[] => {
  
  return [
    {
      key: 'prompt_template',
      name: '提示词模板',
      description: '执行提示词模板并返回结果',
      icon: <FileTextOutlined />,
      category: '数据源',
      supportsInputRef: false,
      needsExecutionButton: true
    },
  // {
  //   key: 'agent',
  //   name: '智能代理',
  //   description: '运行能执行任务的智能代理',
  //   icon: <RobotOutlined />,
  //   category: '数据源',
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'custom_api',
  //   name: '自定义API',
  //   description: '调用自定义API端点',
  //   icon: <ApiOutlined />,
  //   category: '数据源',
  //   needsExecutionButton: true
  // },
    {
      key: 'human_input',
      name: '人工输入',
      description: '添加人工评估输入',
      icon: <UserOutlined />,
      category: '数据源',
      needsExecutionButton: false
    },
  // {
  //   key: 'code_execution',
  //   name: '代码执行',
  //   description: '执行自定义代码',
  //   icon: <CodeOutlined />,
  //   category: '数据源',
  //   needsExecutionButton: true
  // },
    {
      key: 'exact_match',
      name: '精确匹配',
      description: '检查文本是否完全匹配',
      icon: <CheckCircleOutlined />,
      category: '断言',
      supportsInputRef: true,
      supportsExpectedRef: true,
      needsExecutionButton: true
    },
    {
      key: 'exact_multi_match',
      name: '多项精确匹配',
      description: '检查文本是否匹配多个选项中的任意一个',
      icon: <PartitionOutlined />,
      category: '断言',
      supportsInputRef: false,
      supportsExpectedRef: false,
      needsExecutionButton: true
    },
  // {
  //   key: 'contains',
  //   name: '包含检查',
  //   description: '检查输出是否包含特定文本',
  //   icon: <BarsOutlined />,
  //   category: '评估',
  //   supportsInputRef: true,
  //   supportsExpectedRef: true,
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'regex',
  //   name: '正则匹配',
  //   description: '使用正则表达式匹配输出',
  //   icon: <FileTextOutlined />,
  //   category: '评估',
  //   supportsInputRef: true,
  //   supportsExpectedRef: true,
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'llm_assertion',
  //   name: 'LLM断言',
  //   description: '使用LLM判断输出是否符合条件',
  //   icon: <RobotOutlined />,
  //   category: '评估',
  //   supportsInputRef: true,
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'cosine_similarity',
  //   name: '余弦相似度',
  //   description: '计算两个文本的余弦相似度',
  //   icon: <CalculatorOutlined />,
  //   category: '评估',
  //   supportsInputRef: true,
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'numeric_distance',
  //   name: '数值距离',
  //   description: '计算两个数值的绝对距离',
  //   icon: <CalculatorOutlined />,
  //   category: '评估',
  //   supportsInputRef: true,
  //   needsExecutionButton: true
  // },
  {
    key: 'json_extraction',
    name: 'JSON提取',
    description: '从JSON数据中提取字段值',
    icon: <SearchOutlined />,
    category: '数据转换',
    supportsInputRef: true,
    needsExecutionButton: true
  },
  // {
  //   key: 'parse_value',
  //   name: '值解析',
  //   description: '将值转换为指定类型',
  //   icon: <SettingOutlined />,
  //   category: '数据处理',
  //   supportsInputRef: true,
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'static_value',
  //   name: '静态值',
  //   description: '返回预设的静态值',
  //   icon: <SettingOutlined />,
  //   category: '数据处理',
  //   needsExecutionButton: true
  // },
  // {
  //   key: 'type_validation',
  //   name: '类型验证',
  //   description: '验证值是否符合特定类型',
  //   icon: <CheckCircleOutlined />,
  //   category: '数据处理',
  //   supportsInputRef: true,
  //   needsExecutionButton: true
  // }
  ];
};

// 根据类型获取步骤信息
export const getStepTypeInfo = (type: string): StepType | undefined => {
  const stepTypes = getStepTypes();
  return stepTypes.find(step => step.key === type);
};

// 获取所有步骤类型
export const getAllStepTypes = (): StepType[] => {
  return getStepTypes();
};

// 按分类获取步骤类型
export const getStepTypesByCategory = (): Record<string, StepType[]> => {
  const stepTypes = getStepTypes();
  return stepTypes.reduce((acc: Record<string, StepType[]>, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {});
};

// React Hooks for easy use in components
export const useStepTypes = () => {
  
  return getStepTypes();
};

export const useStepTypeInfo = (type: string) => {
  
  return getStepTypeInfo(type);
};

export const useStepTypesByCategory = () => {
  
  return getStepTypesByCategory();
}; 