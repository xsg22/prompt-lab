import React, { useState, useEffect } from 'react';

import { Form, Select, Divider, Typography } from 'antd';
import { PromptsAPI } from '@/lib/api';
import { extractDataFromResponse } from '@/lib/utils';
import type { StepProps } from './types';

const { Option } = Select;
const { Text } = Typography;

// 提示词模板配置组件
export const PromptTemplateStepConfig: React.FC<StepProps> = ({
  form,
  availableColumns,
  projectId
}) => {
  
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);

  // 加载提示词模板列表
  useEffect(() => {
    const loadTemplates = async () => {
      setLoading(true);
      try {
        const response = await PromptsAPI.getPrompts(projectId, {
          page_size: 100,
          status: 'active',
        });
        setTemplates(extractDataFromResponse(response));
      } catch (error) {
        console.error('加载提示词模板失败', error);
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadTemplates();
    }
  }, [projectId]);

  // 加载提示词模板详情
  useEffect(() => {
    const loadTemplateDetails = async () => {
      const promptId = form.getFieldValue('prompt_id');

      if (!promptId) return;

      setLoading(true);
      try {
        // 获取活跃版本
        const response = await PromptsAPI.getActiveVersion(promptId);
        const promptData = response.data;

        // 提取变量
        setSelectedPrompt(promptData);
      } catch (error) {
        console.error('加载模板详情失败', error);
      } finally {
        setLoading(false);
      }
    };

    const promptId = form.getFieldValue('prompt_id');

    if (promptId) {
      loadTemplateDetails();
    }
  }, [form.getFieldValue('prompt_id')]);

  // 处理模板选择
  const handleTemplateChange = (value: number) => {
    form.setFieldValue('prompt_id', value);

    // 触发重新加载模板详情的useEffect
    setTimeout(() => {
      const promptId = form.getFieldValue('prompt_id');
      if (promptId) {
        // 加载模板详情...
        const loadTemplateDetails = async () => {
          setLoading(true);
          try {
            const response = await PromptsAPI.getActiveVersion(promptId);
            const templateData = response.data;

            setSelectedPrompt(templateData);
          } catch (error) {
            console.error('加载模板详情失败', error);
          } finally {
            setLoading(false);
          }
        };

        loadTemplateDetails();
      }
    }, 0);
  };

  // 处理变量引用选择
  const handleVariableChange = (variable: string, value: string) => {
    const formVariables = form.getFieldValue('variable_mappings') || {};
    formVariables[variable] = value;
    form.setFieldValue('variable_mappings', formVariables);
  };

  return (
    <>
      <Form.Item
        label={'提示词模板'}
        name="prompt_id"
        rules={[{ required: true, message: '请选择提示词模板' }]}
      >
        <Select
          placeholder={'请选择提示词模板'}
          loading={loading}
          onChange={handleTemplateChange}
          showSearch
          filterOption={(input, option) =>
            (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
          }
        >
          {templates.map(template => (
            <Option key={template.id} value={template.id}>{template.name}</Option>
          ))}
        </Select>
      </Form.Item>

      {selectedPrompt && selectedPrompt.variables.length > 0 && (
        <>
          <Divider orientation="left">{'变量映射'}</Divider>
          <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
            {'为提示词中的变量选择引用值，可以使用数据集原始变量或前面列的执行结果'}
          </Text>
          {selectedPrompt.variables.map((variable: string) => (
            <Form.Item
              key={variable}
              label={variable}
              name={['variable_mappings', variable]}
            >
              <Select
                placeholder={'选择引用源'}
                allowClear
                onChange={(value) => handleVariableChange(variable, value)}
              >
                {availableColumns.length > 0 && (
                  <Select.OptGroup label={'前置列输出值'}>
                    {availableColumns.map(column => (
                      <Option key={column.name} value={`${column.name}`}>
                        {column.name}
                      </Option>
                    ))}
                  </Select.OptGroup>
                )}
              </Select>
            </Form.Item>
          ))}
        </>
      )}
    </>
  );
};

export default PromptTemplateStepConfig; 