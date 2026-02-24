import React from 'react';
import { Form, InputNumber } from 'antd';

import type { StepProps } from './types';

export const NumericDistanceStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'基准数值'} name="reference_value" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label={'最大允许差距'} name="max_distance" initialValue={10}>
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
};

export default NumericDistanceStepConfig; 