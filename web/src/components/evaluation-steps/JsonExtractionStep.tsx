import React from 'react';
import { Form, Input, Typography, Tag, Space } from 'antd';

import type { StepProps } from './types';

const { Text } = Typography;

export const JsonExtractionStepConfig: React.FC<StepProps> = () => {
  
  
  return (
    <>
      <Form.Item label={'JSON路径'} name="json_path" rules={[{ required: true }]}>
        <Input placeholder={`输入JSON路径，例如：'data.results[0].value'`} />
      </Form.Item>
      
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">{'常用JSON路径示例：'}</Text>
        <div style={{ marginTop: 8 }}>
          <Space direction="vertical">
            <Tag color="blue">data.results[0].value</Tag>
            <Tag color="blue">choices[0].message.content</Tag>
            <Tag color="blue">response.data.items</Tag>
          </Space>
        </div>
      </div>
    </>
  );
};

export default JsonExtractionStepConfig; 