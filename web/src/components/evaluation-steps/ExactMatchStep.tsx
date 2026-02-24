import React from 'react';
import { Form, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const ExactMatchStepConfig: React.FC<StepProps> = () => {
  

  return (
    <>
      <Form.Item label={'选项'} name="options" initialValue={['ignore_case']}>
        <Select mode="multiple">
          <Option value="ignore_case">{'忽略大小写'}</Option>
          <Option value="ignore_whitespace">{'忽略空白字符'}</Option>
        </Select>
      </Form.Item>
    </>
  );
};

export default ExactMatchStepConfig; 