import React from 'react';
import { Form, Input, Select } from 'antd';

import type { StepProps } from './types';

const { Option } = Select;

export const CustomApiStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'API端点URL'} name="endpoint_url" rules={[{ required: true }]}>
        <Input placeholder={'请输入API端点URL'} />
      </Form.Item>
      <Form.Item label={'请求头'} name="headers">
        <Input.TextArea rows={3} placeholder={'JSON格式的请求头'} />
      </Form.Item>
      <Form.Item label={'请求方法'} name="method" initialValue="POST">
        <Select>
          <Option value="GET">GET</Option>
          <Option value="POST">POST</Option>
          <Option value="PUT">PUT</Option>
        </Select>
      </Form.Item>
      <Form.Item label={'请求体'} name="body">
        <Input.TextArea rows={3} placeholder={'JSON格式的请求体'} />
      </Form.Item>
    </>
  );
};

export default CustomApiStepConfig; 