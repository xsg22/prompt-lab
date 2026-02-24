import React from 'react';
import { Form, Input } from 'antd';

import type { StepProps } from './types';

export const StaticValueStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'静态值'} name="static_value" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder={'输入要返回的静态值'} />
      </Form.Item>
    </>
  );
};

export default StaticValueStepConfig; 