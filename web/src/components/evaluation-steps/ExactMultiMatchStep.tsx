import React from 'react';

import { Form, Select, Input, Button, Card, Space, Switch, Tooltip, Divider, Radio } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { StepProps } from './types';

const { Option } = Select;

// 单个匹配对配置组件
const MatchPairCard: React.FC<{
  name: number;
  restField: any;
  availableColumns: any[];
  onRemove: () => void;
  canRemove: boolean;
}> = ({ name, restField, availableColumns, onRemove, canRemove }) => {
  
  const form = Form.useFormInstance();

  // 监听JSON提取开关状态
  const inputJsonEnabled = Form.useWatch(['match_pairs', name, 'enable_input_json_extraction'], form);
  const expectedJsonEnabled = Form.useWatch(['match_pairs', name, 'enable_expected_json_extraction'], form);
  // 监听期望值类型
  const expectedValueType = Form.useWatch(['match_pairs', name, 'expected_value_type'], form) || 'column';

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={`${'匹配对'} ${name + 1}`}
      extra={
        canRemove && (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={onRemove}
          />
        )
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 输入列选择 */}
        <Form.Item
          {...restField}
          name={[name, 'input_column']}
          label={'输入列'}
          rules={[{ required: true, message: '请选择输入列' }]}
          style={{ marginBottom: 12 }}
        >
          <Select placeholder={'选择输入列'} showSearch>
            {availableColumns?.map((col) => (
              <Option key={col.id} value={col.name}>
                {col.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* 输入列JSON路径提取一行展示 */}
        <Form.Item style={{ marginBottom: 8 }}>
          <Space align="center" style={{ width: '100%' }}>
            <Switch size="small"
              checked={inputJsonEnabled}
              onChange={(checked) => {
                const matchPairs = form.getFieldValue('match_pairs') || [];
                const newPairs = [...matchPairs];
                newPairs[name] = {
                  ...newPairs[name],
                  enable_input_json_extraction: checked,
                };
                form.setFieldsValue({ match_pairs: newPairs });
              }}
            />
            <span>{'JSON路径'}</span>
            {inputJsonEnabled && (
              <Form.Item
                {...restField}
                name={[name, 'input_json_path']}
                style={{ marginBottom: 0, marginLeft: 8, flex: 1 }}
                rules={[{ required: true, message: '请输入JSON路径' }]}
              >
                <Input placeholder={'例如: user.name 或 data[0].id'} />
              </Form.Item>
            )}
            <Tooltip title={'从输入列的JSON数据中提取特定字段值进行比较'}>
              <InfoCircleOutlined style={{ color: '#1890ff', marginLeft: 8 }} />
            </Tooltip>
          </Space>
        </Form.Item>

        <Divider style={{ margin: '12px 0' }} />

        {/* 期望值类型选择 */}
        <Form.Item
          {...restField}
          name={[name, 'expected_value_type']}
          label={'期望值类型'}
          initialValue="column"
          style={{ marginBottom: 12 }}
        >
          <Radio.Group>
            <Radio value="column">{'从列获取'}</Radio>
            <Radio value="fixed_value">{'固定值'}</Radio>
          </Radio.Group>
        </Form.Item>

        {/* 根据期望值类型显示不同的输入控件 */}
        {expectedValueType === 'column' ? (
          <>
            {/* 期望值列选择 */}
            <Form.Item
              {...restField}
              name={[name, 'expected_column']}
              label={'期望值列'}
              rules={[{ required: true, message: '请选择期望值列' }]}
              style={{ marginBottom: 12 }}
            >
              <Select placeholder={'选择期望值列'} showSearch>
                {availableColumns?.map((col) => (
                  <Option key={col.id} value={col.name}>
                    {col.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* 期望值列JSON路径提取一行展示 */}
            <Form.Item style={{ marginBottom: 8 }}>
              <Space align="center" style={{ width: '100%' }}>
                <Switch size="small"
                  checked={expectedJsonEnabled}
                  onChange={(checked) => {
                    const matchPairs = form.getFieldValue('match_pairs') || [];
                    const newPairs = [...matchPairs];
                    newPairs[name] = {
                      ...newPairs[name],
                      enable_expected_json_extraction: checked,
                    };
                    form.setFieldsValue({ match_pairs: newPairs });
                  }}
                />
                <span>{'JSON路径'}</span>
                {expectedJsonEnabled && (
                  <Form.Item
                    {...restField}
                    name={[name, 'expected_json_path']}
                    style={{ marginBottom: 0, marginLeft: 8, flex: 1 }}
                    rules={[{ required: true, message: '请输入JSON路径' }]}
                  >
                    <Input placeholder={'例如: expected.name 或 result[0].value'} />
                  </Form.Item>
                )}
                <Tooltip title={'从期望值列的JSON数据中提取特定字段值进行比较'}>
                  <InfoCircleOutlined style={{ color: '#1890ff', marginLeft: 8 }} />
                </Tooltip>
              </Space>
            </Form.Item>
          </>
        ) : (
          /* 固定值输入 */
          <Form.Item
            {...restField}
            name={[name, 'fixed_expected_value']}
            label={'期望固定值'}
            rules={[{ required: true, message: '请输入期望的固定值' }]}
            style={{ marginBottom: 12 }}
          >
            <Input.TextArea 
              placeholder={'输入期望的固定值'} 
              rows={2}
              showCount
            />
          </Form.Item>
        )}
      </Space>
    </Card>
  );
};

export const ExactMultiMatchStepConfig: React.FC<StepProps> = ({ availableColumns }) => {
  
  
  return (
    <>
      {/* 基础选项 */}
      <Form.Item label={'匹配选项'} name="options" initialValue={['ignore_case', 'ignore_whitespace', 'none_as_empty']}>
        <Select mode="multiple" placeholder={'选择匹配选项'}>
          <Option value="ignore_case">{'忽略大小写'}</Option>
          <Option value="ignore_whitespace">{'忽略空白字符'}</Option>
          <Option value="none_as_empty">{'None 作为空字符串'}</Option>
        </Select>
      </Form.Item>

      <Divider />

      {/* 匹配对配置 */}
      <Form.List name="match_pairs" initialValue={[{}]}>
        {(fields, { add, remove }) => (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 500 }}>{'匹配对配置'}</span>
              <Button
                type="dashed"
                onClick={() => add()}
                icon={<PlusOutlined />}
                size="small"
              >
                {'添加匹配对'}
              </Button>
            </div>

            {fields.map(({ key, name, ...restField }) => (
              <MatchPairCard
                key={key}
                name={name}
                restField={restField}
                availableColumns={availableColumns || []}
                onRemove={() => remove(name)}
                canRemove={fields.length > 1}
              />
            ))}

            {fields.length === 0 && (
              <Card style={{ textAlign: 'center', color: '#999' }}>
                <div style={{ padding: '20px 0' }}>
                  <p>{'暂无匹配对配置'}</p>
                  <Button
                    type="primary"
                    onClick={() => add()}
                    icon={<PlusOutlined />}
                  >
                    {'添加第一个匹配对'}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </Form.List>

      <Divider />

      {/* 使用说明 */}
      <Card size="small" style={{ backgroundColor: '#f6f8fa' }}>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <strong>{'使用说明：'}</strong>
          <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
            <li>{'所有匹配对都通过时，整体评估才算成功'}</li>
            <li>{'期望值支持两种模式：'}
              <ul style={{ marginLeft: '16px' }}>
                <li><strong>{'从列获取'}</strong>：{'从列获取：从指定的数据列中获取期望值'}</li>
                <li><strong>{'固定值'}</strong>：{'固定值：直接指定一个固定的期望值'}</li>
              </ul>
            </li>
            <li>{'可以分别为输入列和期望值列启用JSON路径提取'}</li>
            <li>{'JSON路径格式：user.name（对象属性）、data[0].id（数组元素）'}</li>
            <li>{'如果某个匹配对失败，会在结果中详细记录失败原因'}</li>
          </ul>
        </div>
      </Card>
    </>
  );
};

export default ExactMultiMatchStepConfig; 