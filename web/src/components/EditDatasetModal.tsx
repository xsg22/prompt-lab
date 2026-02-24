import { useState, useEffect } from "react"
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  message,
  Spin,
  Card,
  Typography} from "antd"

import { DatasetsAPI } from '@/lib/api'
import { useParams } from "react-router-dom"

const { TextArea } = Input
const { Option } = Select
const { Text } = Typography

interface EditDatasetModalProps {
  open: boolean;
  onClose: () => void;
  datasetId?: string;  // 如果是编辑模式，会提供datasetId
  onSaved: () => void;  // 保存成功后的回调
}



export function EditDatasetModal({
  open,
  onClose,
  datasetId,
  onSaved
}: EditDatasetModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [variables, setVariables] = useState<string[]>([])
  const [variableValues, setVariableValues] = useState<string[]>([])
  const [variableDescriptions, setVariableDescriptions] = useState<Record<string, string>>({})
  const projectId = useParams().projectId

  // 加载数据集详情
  const fetchDatasetDetails = async () => {
    if (!datasetId) return

    try {
      setInitialLoading(true)
      const response = await DatasetsAPI.getDataset(Number(datasetId));

      const data = response.data;

      // 设置表单初始值
      form.setFieldsValue({
        name: data.name,
        description: data.description || '',
        // promptId: data.prompt_id,
        // versionId: data.prompt_version_id,
        // evaluationStrategy: data.evaluation_strategy || 'exact',
        // evaluationConfig: data.evaluation_config ? JSON.stringify(data.evaluation_config, null, 2) : '{}',
      })

      // 设置选中的提示词和版本
      // setSelectedPromptId(data.prompt_id)
      // setSelectedVersionId(data.prompt_version_id)

      // 加载版本列表
      // await fetchPromptVersions(data.prompt_id)

      // 设置变量
      if (data.variables) {
        setVariables(data.variables)
        setVariableValues(data.variables)
      }

      // 设置变量描述
      if (data.variable_descriptions) {
        setVariableDescriptions(data.variable_descriptions)
      }

      // 设置评估策略和策略配置
      // setEvaluationStrategy(data.evaluation_strategy || 'exact')
      // setEvaluationConfig(data.evaluation_config ? JSON.stringify(data.evaluation_config, null, 2) : '{}')
    } catch (error) {
      console.error('操作失败', error)
      message.error('加载数据集详情失败')
    } finally {
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    if (open) {

      if (datasetId) {
        fetchDatasetDetails()
      } else {
        form.resetFields()
        setVariables([])
        setVariableValues([])
        setVariableDescriptions({})
      }
    }
  }, [open, datasetId, projectId])

  const handleVariablesChange = (values: string[]) => {
    setVariableValues(values);
    
    // 更新变量描述，移除不存在的变量，为新变量添加空描述
    const newDescriptions: Record<string, string> = {};
    values.forEach(variable => {
      newDescriptions[variable] = variableDescriptions[variable] || '';
    });
    setVariableDescriptions(newDescriptions);
  }

  const handleVariableDescriptionChange = (variable: string, description: string) => {
    setVariableDescriptions(prev => ({
      ...prev,
      [variable]: description
    }));
  }

  const handleSubmit = async () => {
    try {
      await form.validateFields()
      const values = form.getFieldsValue()

      setLoading(true)

      const payload = {
        project_id: Number(projectId),
        name: values.name,
        description: values.description,
        // promptId: selectedPromptId,
        // promptVersionId: selectedVersionId,
        // evaluationStrategy: values.evaluationStrategy,
        // evaluationConfig: values.evaluationConfig ? JSON.parse(values.evaluationConfig) : {},
        variables: variableValues,
        variable_descriptions: variableDescriptions,
      };


      if (datasetId) {
        // 更新现有数据集
        await DatasetsAPI.updateDataset(Number(datasetId), payload);
      } else {
        // 创建新数据集
        await DatasetsAPI.createDataset(payload);
      }

      message.success(`数据集${datasetId ? '更新' : '创建'}成功`)
      onClose()
      onSaved()
    } catch (error) {
      console.error('操作失败', error)
      message.error(`数据集${datasetId ? '更新' : '创建'}失败`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={datasetId ? '编辑数据集' : '创建数据集'}
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {'取消'}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
        >
          {datasetId ? '保存' : '创建'}
        </Button>
      ]}
    >
      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <Spin />
          <div style={{ marginTop: 12 }}>{'加载数据集信息中...'}</div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={'数据集名称'}
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder={'输入数据集名称'} />
          </Form.Item>

          <Form.Item
            name="description"
            label={'数据集描述'}
          >
            <TextArea placeholder={'输入数据集描述（可选）'} />
          </Form.Item>

          {/* <Form.Item
            name="promptId"
            label="关联提示词"
            rules={[{ required: false, message: '请选择关联的提示词' }]}
          >
            <Select
              placeholder="选择关联的提示词"
              onChange={handlePromptChange}
            >
              {prompts.map(prompt => (
                <Option key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="versionId"
            label="提示词版本"
            rules={[{ required: false, message: '请选择提示词版本' }]}
          >
            <Select
              placeholder="选择提示词版本"
              disabled={!selectedPromptId}
              onChange={handleVersionChange}
            >
              {versions.map(version => (
                <Option key={version.id} value={version.id}>
                  v{version.version_number}
                </Option>
              ))}
            </Select>
          </Form.Item> */}

          <Form.Item
            name="variables"
            label={'变量列表'}
          >
            <Select
              mode="tags"
              placeholder={'选择或输入变量名称'}
              defaultValue={variables}
              onChange={handleVariablesChange}
            >
              {variables.map(variable => (
                <Option key={variable} value={variable}>{variable}</Option>
              ))}
            </Select>
          </Form.Item>

          {/* 变量描述输入区域 */}
          {variableValues.length > 0 && (
            <Form.Item label={'变量描述'}>
              <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                {'为每个变量添加描述，帮助用户理解变量的用途和格式要求'}
              </Text>
              <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                {variableValues.map((variable, index) => (
                  <div key={variable} style={{ marginBottom: index === variableValues.length - 1 ? 0 : 12 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>
                      {variable}
                    </Text>
                    <Input
                      placeholder={`为 ${variable} 变量添加描述`}
                      value={variableDescriptions[variable] || ''}
                      onChange={(e) => handleVariableDescriptionChange(variable, e.target.value)}
                    />
                  </div>
                ))}
              </Card>
            </Form.Item>
          )}

          {/* {variables.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>变量列表：</Text>
              <div style={{ marginTop: 8 }}>
                <Space wrap>
                  {variables.map(variable => (
                    <div key={variable} style={{
                      background: '#f5f5f5',
                      padding: '4px 8px',
                      borderRadius: 4
                    }}>
                      {variable}
                    </div>
                  ))}
                </Space>
              </div>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  这些变量将用于创建数据集条目，您稍后可以为每个条目设置不同的变量值。
                </Text>
              </div>
            </div>
          )} */}

          {/* <Form.Item
            name="evaluationStrategy"
            label="评估策略"
            rules={[{ required: true, message: '请选择评估策略' }]}
          >
            <Select
              value={evaluationStrategy}
              onChange={value => {
                setEvaluationStrategy(value)
                form.setFieldValue('evaluationStrategy', value)
              }}
            >
              <Option value="exact">精确匹配</Option>
              <Option value="keyword">关键词匹配</Option>
              <Option value="json">JSON结构匹配</Option>
              <Option value="prompt">提示词评估</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="evaluationConfig"
            label="策略配置 (JSON)"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve()
                  try {
                    JSON.parse(value)
                    return Promise.resolve()
                  } catch {
                    return Promise.reject('请输入合法的JSON格式')
                  }
                },
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请输入策略配置（JSON格式，可选）"
              value={evaluationConfig}
              onChange={e => {
                setEvaluationConfig(e.target.value)
                form.setFieldValue('evaluationConfig', e.target.value)
              }}
            />
          </Form.Item> */}
        </Form>
      )}
    </Modal>
  )
} 