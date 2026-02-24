import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Card,
  Typography,
  Divider,
  message,
  Row,
  Col,
  Tag,
  List,
} from 'antd';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';

import { DatasetsAPI } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { useProjectJump } from '@/hooks/useProjectJump';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface DataAnalysisModalProps {
  visible: boolean;
  onCancel: () => void;
  dataset: {
    id: number;
    name: string;
    description?: string | null;
    variables?: string[];
    variable_descriptions?: Record<string, string>;
  };
}

interface OutputField {
  field_name: string;
  description: string;
}

export const DataAnalysisModal: React.FC<DataAnalysisModalProps> = ({
  visible,
  onCancel,
  dataset,
}) => {
  
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { projectJumpTo } = useProjectJump();
  const [loading, setLoading] = useState(false);
  const [outputFields, setOutputFields] = useState<OutputField[]>([
    { field_name: '', description: '' }
  ]);

  const handleAddField = () => {
    setOutputFields([...outputFields, { field_name: '', description: '' }]);
  };

  const handleRemoveField = (index: number) => {
    if (outputFields.length > 1) {
      setOutputFields(outputFields.filter((_, i) => i !== index));
    }
  };

  const handleFieldChange = (index: number, field: keyof OutputField, value: string) => {
    const newFields = [...outputFields];
    newFields[index][field] = value;
    setOutputFields(newFields);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 验证输出字段
      const validFields = outputFields.filter(field => 
        field.field_name.trim() && field.description.trim()
      );
      
      if (validFields.length === 0) {
        message.error('请至少添加一个有效的输出字段');
        return;
      }

      setLoading(true);

      const response = await DatasetsAPI.createAnalysisPrompt(dataset.id, {
        analysis_description: values.analysis_description,
        output_fields: validFields,
      });

      message.success('数据分析提示词创建成功');
      
      // 跳转到提示词编辑页面
      navigate(projectJumpTo(`/prompts/${response.data.prompt_id}/editor`));
      
      onCancel();
      
    } catch (error: any) {
      console.error('创建提示词失败', error);
      message.error(error.response?.data?.detail || '创建提示词失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setOutputFields([{ field_name: '', description: '' }]);
    onCancel();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined />
          <span>{'创建数据分析提示词'}</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel}>
              {'取消'}
            </Button>
            <Button 
              type="primary" 
              onClick={handleSubmit}
              loading={loading}
            >
              {'创建提示词'}
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 4px' }}>
        {/* 数据集信息展示 */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <Title level={5}>{'数据集信息'}</Title>
          <Row gutter={[16, 8]}>
            <Col span={24}>
              <Text strong>{'名称：'}</Text>
              <Text>{dataset.name}</Text>
            </Col>
            {dataset.description && (
              <Col span={24}>
                <Text strong>{'描述：'}</Text>
                <Text>{dataset.description}</Text>
              </Col>
            )}
            {dataset.variables && dataset.variables.length > 0 && (
              <Col span={24}>
                <Text strong>{'数据字段：'}</Text>
                <div style={{ marginTop: 8 }}>
                  <List
                    size="small"
                    dataSource={dataset.variables}
                    renderItem={(variable) => (
                      <List.Item style={{ padding: '4px 0', border: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tag color="blue">{variable}</Tag>
                          {dataset.variable_descriptions?.[variable] && (
                            <Text type="secondary">
                              {dataset.variable_descriptions[variable]}
                            </Text>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Col>
            )}
          </Row>
        </Card>

        <Divider />

        {/* 分析配置表单 */}
        <Form form={form} layout="vertical">
          <Form.Item
            label={'分析描述'}
            name="analysis_description"
            rules={[
              { required: true, message: '请输入分析描述' },
              { min: 10, message: '分析描述至少需要10个字符' }
            ]}
          >
            <TextArea
              rows={4}
              placeholder={`请详细描述您希望AI如何分析这个数据集的数据。例如：
• 分析用户行为模式
• 识别数据中的异常值
• 总结关键指标和趋势
• 生成业务洞察和建议`.replace(/\\n/g, '\n')}
            />
          </Form.Item>

          <Form.Item label={'输出字段定义'} required>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              {'定义AI分析结果的输出格式。每个字段将作为JSON对象的一个属性返回。'}
            </Paragraph>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              {outputFields.map((field, index) => (
                <Card key={index} size="small" style={{ backgroundColor: '#fafafa' }}>
                  <Row gutter={16} align="middle">
                    <Col span={8}>
                      <Input
                        placeholder={'字段名（如：trend_analysis）'}
                        value={field.field_name}
                        onChange={(e) => handleFieldChange(index, 'field_name', e.target.value)}
                      />
                    </Col>
                    <Col span={12}>
                      <Input
                        placeholder={'字段描述（如：分析数据的趋势变化）'}
                        value={field.description}
                        onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveField(index)}
                        disabled={outputFields.length === 1}
                      />
                    </Col>
                  </Row>
                </Card>
              ))}
              
              <Button
                type="dashed"
                onClick={handleAddField}
                icon={<PlusOutlined />}
                style={{ width: '100%' }}
              >
                {'添加输出字段'}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Title level={5} style={{ color: '#52c41a', margin: 0 }}>
            {'温馨提示'}
          </Title>
          <Paragraph style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
            {`系统将基于您的配置生成一个专业的数据分析提示词。
生成的提示词将包含数据集的结构信息，并按照您定义的输出格式返回分析结果。
您可以在提示词编辑器中进一步自定义和优化分析逻辑。`.split('\n').map((line, index) => (
              <span key={index}>
                {line}
                {index < `系统将基于您的配置生成一个专业的数据分析提示词。
生成的提示词将包含数据集的结构信息，并按照您定义的输出格式返回分析结果。
您可以在提示词编辑器中进一步自定义和优化分析逻辑。`.split('\n').length - 1 && <br/>}
              </span>
            ))}
          </Paragraph>
        </Card>
      </div>
    </Modal>
  );
}; 