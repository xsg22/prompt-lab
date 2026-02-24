// 导出类型定义
export * from './types';

// 导出注册组件
export { 
  getStepTypes,
  getStepTypeInfo, 
  getAllStepTypes, 
  getStepTypesByCategory,
  useStepTypes,
  useStepTypeInfo,
  useStepTypesByCategory
} from './StepRegistry';

// 导出结果展示组件
export { default as StepResultDisplay } from './StepResultDisplay';

// 导出步骤配置组件
export { default as PromptTemplateStepConfig } from './PromptTemplateStep';
export { default as HumanInputStepConfig, HumanInputResult } from './HumanInputStep';
export { default as CustomApiStepConfig } from './CustomApiStep';
export { default as CodeExecutionStepConfig } from './CodeExecutionStep';
export { default as ExactMatchStepConfig } from './ExactMatchStep';
export { default as ExactMultiMatchStepConfig } from './ExactMultiMatchStep';
export { default as ContainsStepConfig } from './ContainsStep';
export { default as RegexStepConfig } from './RegexStep';
export { default as LlmAssertionStepConfig } from './LlmAssertionStep';
export { default as CosineSimilarityStepConfig } from './CosineSimilarityStep';
export { default as NumericDistanceStepConfig } from './NumericDistanceStep';
export { default as JsonExtractionStepConfig } from './JsonExtractionStep';
export { default as ParseValueStepConfig } from './ParseValueStep';
export { default as StaticValueStepConfig } from './StaticValueStep';
export { default as TypeValidationStepConfig } from './TypeValidationStep';

// 获取步骤配置组件
import { Empty } from 'antd';
import React from 'react';


// 导入所有配置组件
import PromptTemplateStepConfig from './PromptTemplateStep';
import HumanInputStepConfig from './HumanInputStep';
import CustomApiStepConfig from './CustomApiStep';
import CodeExecutionStepConfig from './CodeExecutionStep';
import ExactMatchStepConfig from './ExactMatchStep';
import ExactMultiMatchStepConfig from './ExactMultiMatchStep';
import ContainsStepConfig from './ContainsStep';
import RegexStepConfig from './RegexStep';
import LlmAssertionStepConfig from './LlmAssertionStep';
import CosineSimilarityStepConfig from './CosineSimilarityStep';
import NumericDistanceStepConfig from './NumericDistanceStep';
import JsonExtractionStepConfig from './JsonExtractionStep';
import ParseValueStepConfig from './ParseValueStep';
import StaticValueStepConfig from './StaticValueStep';
import TypeValidationStepConfig from './TypeValidationStep';

// 不支持的步骤类型组件
const UnsupportedStepType: React.FC = () => {
  
  return React.createElement(Empty, { 
    description: '暂不支持此步骤类型的配置' 
  });
};

export const getStepConfigComponent = (type: string) => {
  switch(type) {
    case 'prompt_template':
      return PromptTemplateStepConfig;
    case 'human_input':
      return HumanInputStepConfig;
    case 'custom_api':
      return CustomApiStepConfig;
    case 'code_execution':
      return CodeExecutionStepConfig;
    case 'exact_match':
      return ExactMatchStepConfig;
    case 'exact_multi_match':
      return ExactMultiMatchStepConfig;
    case 'contains':
      return ContainsStepConfig;
    case 'regex':
      return RegexStepConfig;
    case 'llm_assertion':
      return LlmAssertionStepConfig;
    case 'cosine_similarity':
      return CosineSimilarityStepConfig;
    case 'numeric_distance':
      return NumericDistanceStepConfig;
    case 'json_extraction':
      return JsonExtractionStepConfig;
    case 'parse_value':
      return ParseValueStepConfig;
    case 'static_value':
      return StaticValueStepConfig;
    case 'type_validation':
      return TypeValidationStepConfig;
    default:
      return UnsupportedStepType;
  }
}; 