import React from 'react';
import { Form, Input, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const ContainsStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'包含内容'} name="contains_text" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder={'输入应包含的文本'} />
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

export default ContainsStepConfig; 