import React from 'react';
import { Form, Input, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const RegexStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'正则表达式'} name="regex_pattern" rules={[{ required: true }]}>
        <Input placeholder={'输入正则表达式'} />
      </Form.Item>
      <Form.Item label={'忽略大小写'} name="ignore_case" initialValue={true}>
        <Select>
          <Option value={true}>{'是'}</Option>
          <Option value={false}>{'否'}</Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default RegexStepConfig; 