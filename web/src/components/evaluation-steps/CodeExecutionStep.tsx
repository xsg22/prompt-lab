import React from 'react';
import { Form, Select, Input } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const CodeExecutionStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'代码语言'} name="language" initialValue="python">
        <Select>
          <Option value="python">Python</Option>
          <Option value="javascript">JavaScript</Option>
        </Select>
      </Form.Item>
      <Form.Item label={'代码'} name="code" rules={[{ required: true }]}>
        <Input.TextArea rows={8} placeholder={'输入代码，可以通过data变量访问所有列数据'} />
      </Form.Item>
    </>
  );
};

export default CodeExecutionStepConfig; 