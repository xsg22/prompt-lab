import React from 'react';
import { Form, Input, Radio } from 'antd';

import type { StepProps } from './types';

export const LlmAssertionStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'断言提示词'} name="assertion_prompt" rules={[{ required: true }]}>
        <Input.TextArea 
          rows={4} 
            placeholder={`输入LLM用于断言的提示词，例如：'判断输出是否包含主要观点?'`} 
        />
      </Form.Item>
      <Form.Item label={'输出格式'} name="output_format" initialValue="true_false">
        <Radio.Group>
          <Radio value="true_false">{'是/否'}</Radio>
          <Radio value="score">{'评分(0-10)'}</Radio>
        </Radio.Group>
      </Form.Item>
    </>
  );
};

export default LlmAssertionStepConfig; 