import React from 'react';
import { Form, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const TypeValidationStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'预期类型'} name="expected_type" initialValue="string">
        <Select>
          <Option value="string">{'字符串'}</Option>
          <Option value="number">{'数字'}</Option>
          <Option value="boolean">{'布尔值'}</Option>
          <Option value="array">{'数组'}</Option>
          <Option value="object">{'对象'}</Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default TypeValidationStepConfig; 