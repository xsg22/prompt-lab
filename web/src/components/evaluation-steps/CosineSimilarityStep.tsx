import React from 'react';
import { Form, Input, InputNumber } from 'antd';

import type { StepProps } from './types';

export const CosineSimilarityStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'基准文本'} name="reference_text" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder={'输入计算相似度的基准文本'} />
      </Form.Item>
      <Form.Item label={'阈值'} name="threshold" initialValue={0.7}>
        <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
};

export default CosineSimilarityStepConfig; 