import React from 'react';
import { Form, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const ParseValueStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'目标类型'} name="target_type" initialValue="number">
        <Select>
          <Option value="number">{'数字'}</Option>
          <Option value="boolean">{'布尔值'}</Option>
          <Option value="string">{'字符串'}</Option>
          <Option value="json">JSON</Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default ParseValueStepConfig; 