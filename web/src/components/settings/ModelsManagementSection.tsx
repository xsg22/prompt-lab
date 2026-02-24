import React, { useState, useEffect } from 'react';

import {
  Card,
  Typography,
  Button,
  Switch,
  Collapse,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Badge,
  Modal,
  message,
  Tooltip,
  Alert,
  Checkbox,
  List,
  Avatar,
  Spin,
  Empty,
  Popconfirm,
  Row,
  Col,
  Divider,
  InputNumber
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  CloudOutlined,
  RobotOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { ModelsAPI } from '@/lib/api';
import type { 
  ProviderDefinition, 
  ProviderInstance, 
  ProviderField, 
  DefaultModel, 
  CustomModel 
} from '@/types/llm';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

interface ModelsManagementSectionProps {
  projectId: number;
}

// 提供商图标映射
const PROVIDER_ICONS: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  azure: '☁️',
  dashscope: '🌟',
  google: '🔍',
  xai: '⚡',
  deepseek: '🌊',
  cerebras: '🧮',
  groq: '🚀',
  cohere: '🔮',
  fireworks: '🎆',
  perplexity: '🔎',
  together: '🤝',
  mistral: '🌀',
  ai21: '🏛️',
  replicate: '🔄',
  voyageai: '🛸',
  jinaai: '⚙️',
  huggingface: '🤗',
  bedrock: '🏔️',
  ollama: '🦙',
  cloudflare: '⚡',
  deepinfra: '🏗️',
  custom: '⚙️'
};

// 字段类型渲染组件
const FieldRenderer: React.FC<{
  field: ProviderField;
  value: any;
  onChange: (value: any) => void;
  showValue?: boolean;
}> = ({ field, value, onChange, showValue = true }) => {
  
  const [showPassword, setShowPassword] = useState(false);
  
  const renderField = () => {
    switch (field.type) {
      case 'password':
        return (
          <Input.Password
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            visibilityToggle={{
              visible: showPassword,
              onVisibleChange: setShowPassword,
            }}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
          />
        );
      case 'textarea':
        return (
          <Input.TextArea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        );
      case 'select':
        return (
          <Select
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            style={{ width: '100%' }}
          >
            {field.options?.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        );
      case 'number':
        return (
          <InputNumber
            value={value}
            onChange={onChange}
            placeholder={field.placeholder}
            style={{ width: '100%' }}
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  };

  if (!showValue && field.type === 'password' && value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary">••••••••</Text>
        <Button
          type="link"
          size="small"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? '隐藏' : '显示'}
        </Button>
      </div>
    );
  }

  return renderField();
};

// 模型选择组件
const ModelSelector: React.FC<{
  models: DefaultModel[];
  selectedModels: string[];
  onChange: (selected: string[]) => void;
}> = ({ models, selectedModels, onChange }) => {
  
  const handleModelToggle = (modelId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedModels, modelId]);
    } else {
      onChange(selectedModels.filter(id => id !== modelId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onChange(models.map(m => m.model_id));
    } else {
      onChange([]);
    }
  };

  const allSelected = models.length > 0 && selectedModels.length === models.length;
  const someSelected = selectedModels.length > 0 && selectedModels.length < models.length;

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Checkbox
          indeterminate={someSelected}
          checked={allSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
        >
          <Text strong>{'选择模型'} ({selectedModels.length}/{models.length})</Text>
        </Checkbox>
        <Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {selectedModels.length} {'已选择'}
          </Text>
        </Space>
      </div>
      
      <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: '6px' }}>
        {models.map(model => (
          <div
            key={model.model_id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #f5f5f5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Checkbox
              checked={selectedModels.includes(model.model_id)}
              onChange={(e) => handleModelToggle(model.model_id, e.target.checked)}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{model.name}</div>
                {model.description && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {model.description}
                  </Text>
                )}
              </div>
            </Checkbox>
            
            <Space size={4}>
              {model.context_window && (
                <Tag color="blue" style={{ fontSize: '10px' }}>
                  {model.context_window >= 1000000 ? `${(model.context_window / 1000000).toFixed(1)}M` : `${(model.context_window / 1000).toFixed(0)}K`}
                </Tag>
              )}
              {model.input_cost_per_token && (
                <Tag color="green" style={{ fontSize: '10px' }}>
                  ${model.input_cost_per_token}/1K
                </Tag>
              )}
              {model.supports_tools && (
                <Tag color="orange" style={{ fontSize: '10px' }}>
                  {'函数'}
                </Tag>
              )}
              {model.supports_vision && (
                <Tag color="purple" style={{ fontSize: '10px' }}>
                  {'视觉'}
                </Tag>
              )}
            </Space>
          </div>
        ))}
      </div>
    </div>
  );
};

// 自定义模型管理组件
const CustomModelManager: React.FC<{
  instanceId: number;
  customModels?: CustomModel[];
  onRefresh: () => void;
  projectId: number;
}> = ({ instanceId, customModels, onRefresh, projectId }) => {
  
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      if (editingModel) {
        // 更新模型时不需要provider_instance_id
        const updateData = {
          name: values.name,
          description: values.description,
          context_window: values.contextWindow,
          max_tokens: values.maxTokens,
          input_cost_per_token: values.inputPrice,
          output_cost_per_token: values.outputPrice,
          config: {}
        };
        await ModelsAPI.updateCustomModel(projectId, editingModel.id, updateData);
        message.success('自定义模型已更新');
      } else {
        // 创建模型时需要provider_instance_id
        const createData = {
          name: values.name,
          model_id: values.modelId,
          provider_instance_id: instanceId,
          description: values.description,
          context_window: values.contextWindow,
          max_tokens: values.maxTokens,
          input_cost_per_token: values.inputPrice,
          output_cost_per_token: values.outputPrice,
          config: {}
        };
        await ModelsAPI.createCustomModel(projectId, createData);
        message.success('自定义模型已添加');
      }
      
      setModalVisible(false);
      setEditingModel(null);
      form.resetFields();
      onRefresh();
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (model: CustomModel) => {
    setEditingModel(model);
    // 字段映射：将model_id映射为表单期望的modelId
    form.setFieldsValue({
      ...model,
      modelId: model.model_id,
      contextWindow: model.context_window,
      maxTokens: model.max_tokens,
      inputPrice: model.input_cost_per_token,
      outputPrice: model.output_cost_per_token
    });
    setModalVisible(true);
  };

  const handleDelete = async (modelId: number) => {
    try {
      await ModelsAPI.deleteCustomModel(projectId, modelId);
      message.success('自定义模型已删除');
      onRefresh();
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('删除自定义模型失败');
    }
  };

  const openAddModal = () => {
    setEditingModel(null);
    form.resetFields();
    setModalVisible(true);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>{'自定义模型'} ({customModels?.length || 0})</Text>
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={openAddModal}
        >
          {'添加模型'}
        </Button>
      </div>

      {customModels && customModels.length > 0 ? (
        <List
          size="small"
          dataSource={customModels}
          renderItem={model => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(model)}
                />,
                <Popconfirm
                  title={'删除自定义模型'}
                  description={'确认删除此自定义模型？'}
                  onConfirm={() => handleDelete(model.id)}
                  okText={'删除'}
                  cancelText={'取消'}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  />
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                title={model.name}
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {'模型ID'}: {model.model_id}
                    </Text>
                    {model.description && (
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {model.description}
                        </Text>
                      </div>
                    )}
                  </div>
                }
              />
              <Space>
                {model.context_window && (
                  <Tag color="blue" style={{ fontSize: '10px' }}>
                    {model.context_window >= 1000000 ? `${(model.context_window / 1000000).toFixed(1)}M` : `${(model.context_window / 1000).toFixed(0)}K`}
                  </Tag>
                )}
                {model.input_cost_per_token && (
                  <Tag color="green" style={{ fontSize: '10px' }}>
                    ${model.input_cost_per_token}/1K
                  </Tag>
                )}
              </Space>
            </List.Item>
          )}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={'暂无自定义模型'}
          style={{ margin: '12px 0' }}
        />
      )}

      <Modal
        title={editingModel ? '编辑自定义模型' : '添加自定义模型'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingModel(null);
          form.resetFields();
        }}
        onOk={handleSubmit}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={'显示名称'}
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder={'例如：GPT-4 Turbo'} />
          </Form.Item>

          <Form.Item
            name="modelId"
            label={'模型ID'}
            rules={[{ required: true, message: '请输入模型ID' }]}
            tooltip={'提供商API中使用的模型标识符'}
          >
            <Input placeholder={'例如：gpt-4-turbo-preview'} />
          </Form.Item>

          <Form.Item name="description" label={'模型描述'}>
            <Input.TextArea rows={2} placeholder={'描述这个模型的特点和用途'} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contextWindow" label={'上下文窗口'}>
                <InputNumber
                  placeholder="128000"
                  style={{ width: '100%' }}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxTokens" label={'最大输出令牌'}>
                <InputNumber
                  placeholder="4096"
                  style={{ width: '100%' }}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="inputPrice" label={'输入价格 ($/1K tokens)'}>
                <InputNumber
                  placeholder="0.01"
                  step={0.001}
                  precision={6}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="outputPrice" label={'输出价格 ($/1K tokens)'}>
                <InputNumber
                  placeholder="0.03"
                  step={0.001}
                  precision={6}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export function ModelsManagementSection({ projectId }: ModelsManagementSectionProps) {
  
  const [providerDefinitions, setProviderDefinitions] = useState<ProviderDefinition[]>([]);
  const [providerInstances, setProviderInstances] = useState<ProviderInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderDefinition | null>(null);
  const [editingInstance, setEditingInstance] = useState<ProviderInstance | null>(null);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState<number | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [definitionsRes, instancesRes] = await Promise.all([
        ModelsAPI.getProviderDefinitions(),
        ModelsAPI.getProviderInstances(projectId)
      ]);
      
      setProviderDefinitions(definitionsRes.data);
      setProviderInstances(instancesRes.data);
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('加载模型数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureProvider = (provider: ProviderDefinition, instance?: ProviderInstance) => {
    setSelectedProvider(provider);
    setEditingInstance(instance || null);
    
    if (instance) {
      // 编辑现有实例
      form.setFieldsValue({
        name: instance.name,
        enabledModels: instance.enabled_models,
        ...instance.config
      });
      setSelectedModels(instance.enabled_models || []);
    } else {
      // 创建新实例
      form.resetFields();
      // 设置默认值
      const defaultValues: any = { enabledModels: [], provider_type: provider.id, name: provider.id };
      provider.fields.forEach(field => {
        if (field.default !== undefined) {
          defaultValues[field.key] = field.default;
        }
      });
      form.setFieldsValue(defaultValues);
      setSelectedModels([]);
    }
    
    setConfigModalVisible(true);
  };

  const handleSubmitConfig = async () => {
    try {
      const values = await form.validateFields();
      const { enabledModels, ...config } = values;
      
      // 验证至少选择一个模型
      if (selectedModels.length === 0) {
        message.error('请至少选择一个模型');
        return;
      }
      
      if (editingInstance) {
        // 更新现有实例
        await ModelsAPI.updateProviderInstance(projectId, editingInstance.id, {
          name: values.name,
          config,
          is_enabled: values.is_enabled,
          enabled_models: selectedModels
        });
        message.success('提供商配置已更新');
      } else {
        // 创建新实例
        await ModelsAPI.createProviderInstance(projectId, {
          provider_type: selectedProvider!.id,
          name: values.name,
          config,
          enabled_models: selectedModels
        });
        message.success('提供商配置成功');
      }
      
      setConfigModalVisible(false);
      setSelectedProvider(null);
      setEditingInstance(null);
      form.resetFields();
      setSelectedModels([]);
      loadData();
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('配置提供商失败');
    }
  };

  const handleTestConnection = async (instanceId: number) => {
    try {
      setTesting(instanceId);
    //   {
    //     "success": false,
    //     "message": "连接测试失败",
    //     "latency": 0.010967254638671875,
    //     "error_details": "无法连接到API端点"
    // }
      const res = await ModelsAPI.testProviderInstance(projectId, instanceId);
      console.log(res);
      if (res.data.success) {
        message.success('连接测试成功');
      } else {
        message.error(res.data.error_details);
      }
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('连接测试失败');
    } finally {
      setTesting(null);
    }
  };

  const handleToggleProvider = async (instanceId: number, enabled: boolean) => {
    try {
      await ModelsAPI.updateProviderInstance(projectId, instanceId, { is_enabled: enabled });
      message.success(enabled ? '提供商已启用' : '提供商已禁用');
      loadData();
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('切换提供商状态失败');
    }
  };

  const handleDeleteProvider = async (instanceId: number) => {
    try {
      await ModelsAPI.deleteProviderInstance(projectId, instanceId);
      message.success('提供商已删除');
      loadData();
    } catch (error: any) {
      console.error('操作失败', error);
      message.error('删除提供商失败');
    }
  };

  // 获取提供商实例
  const getProviderInstance = (providerId: string) => {
    return providerInstances.find(instance => instance.provider_type === providerId);
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>{'加载模型数据中...'}</Text>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8 }}>
            <RobotOutlined style={{ marginRight: 8 }} />
            {'模型管理'}
          </Title>
          <Paragraph style={{ marginBottom: 16 }}>
            {'配置和管理您的AI模型提供商，启用所需的模型来满足不同的使用场景。'}
          </Paragraph>
          
          <Alert
            type="info"
            message={'配置建议'}
            description={'建议配置多个提供商以确保服务稳定性，不同提供商的模型各有特色，可以满足不同的使用需求。'}
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>

        <Collapse
          ghost
          expandIconPosition="end"
          style={{ background: 'white' }}
        >
          {/* 对提供商进行排序：已配置的在前，未配置的在后 */}
          {[...providerDefinitions]
            .sort((a, b) => {
              const aConfigured = !!getProviderInstance(a.id);
              const bConfigured = !!getProviderInstance(b.id);
              
              // 已配置的排在前面
              if (aConfigured && !bConfigured) return -1;
              if (!aConfigured && bConfigured) return 1;
              
              // 如果都已配置或都未配置，按名称排序
              return a.name.localeCompare(b.name);
            })
            .map(provider => {
            const instance = getProviderInstance(provider.id);
            const isConfigured = !!instance;
            const isEnabled = instance?.is_enabled || false;
            const enabledModelsCount = instance?.enabled_models.length || 0;
            const totalModelsCount = provider.default_models.length + (instance?.custom_models?.length || 0);

            return (
              <Panel
                key={provider.id}
                header={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space size={12}>
                      <Avatar size={32} style={{ backgroundColor: '#f0f0f0' }}>
                        {PROVIDER_ICONS[provider.id] || '🤖'}
                      </Avatar>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ fontSize: '16px' }}>{provider.name}</Text>
                          {isConfigured && (
                            <Badge
                              status={isEnabled ? 'success' : 'default'}
                              text={isEnabled ? '已启用' : '已禁用'}
                            />
                          )}
                          {!isConfigured && (
                            <Tag color="orange">{'未配置'}</Tag>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {provider.description || '暂无描述'}
                        </Text>
                      </div>
                    </Space>
                    
                    <Space size={8} onClick={(e) => e.stopPropagation()}>
                      {isConfigured && (
                        <>
                          <Tag color="blue" style={{ fontSize: '11px' }}>
                            {enabledModelsCount}/{totalModelsCount} {'模型'}
                          </Tag>
                          <Switch
                            size="small"
                            checked={isEnabled}
                            onChange={(checked) => handleToggleProvider(instance.id, checked)}
                          />
                        </>
                      )}
                      <Button
                        type="primary"
                        size="small"
                        icon={isConfigured ? <SettingOutlined /> : <PlusOutlined />}
                        onClick={() => handleConfigureProvider(provider, instance)}
                      >
                        {isConfigured ? '配置' : '添加'}
                      </Button>
                    </Space>
                  </div>
                }
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  background: isEnabled ? '#f6ffed' : 'white'
                }}
              >
                {isConfigured && instance ? (
                  <div style={{ padding: '0 16px' }}>
                    {/* 配置信息 */}
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: '13px' }}>{'配置信息'}</Text>
                      <div style={{ marginTop: 8, background: '#fafafa', padding: '12px', borderRadius: '6px' }}>
                        <Row gutter={[16, 8]}>
                          {provider.fields.map(field => {
                            const value = instance.config[field.key];
                            if (!value) return null;
                            
                            return (
                              <Col span={12} key={field.key}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {field.name}:
                                  </Text>
                                  <div style={{ marginTop: 2 }}>
                                    <FieldRenderer 
                                      field={field} 
                                      value={value} 
                                      onChange={() => {}} 
                                      showValue={false}
                                    />
                                  </div>
                                </div>
                              </Col>
                            );
                          })}
                        </Row>
                      </div>
                    </div>

                    {/* 启用的模型 */}
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ fontSize: '13px' }}>
                        {'启用的模型'} ({enabledModelsCount})
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <Space wrap size={[4, 4]}>
                          {instance.enabled_models.map(modelId => {
                            const model = provider.default_models.find(m => m.model_id === modelId) ||
                                         instance.custom_models?.find(m => m.model_id === modelId);
                            return (
                              <Tag key={modelId} color="blue" style={{ fontSize: '11px' }}>
                                {model?.name || modelId}
                              </Tag>
                            );
                          })}
                        </Space>
                      </div>
                    </div>

                    {/* 自定义模型管理 */}
                    {provider.support_custom_models && (
                      <div style={{ marginBottom: 16 }}>
                        <CustomModelManager
                          instanceId={instance.id}
                          customModels={instance.custom_models || []}
                          onRefresh={loadData}
                          projectId={projectId}
                        />
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Button
                          size="small"
                          icon={<LinkOutlined />}
                          loading={testing === instance.id}
                          onClick={() => handleTestConnection(instance.id)}
                        >
                          {'测试连接'}
                        </Button>
                        {provider.website && (
                          <Button
                            type="link"
                            size="small"
                            href={provider.website}
                            target="_blank"
                            icon={<CloudOutlined />}
                          >
                            {'官网'}
                          </Button>
                        )}
                      </Space>
                      
                      <Popconfirm
                        title={'确认删除提供商？'}
                        description={'删除后将无法使用该提供商的模型，请确认操作。'}
                        onConfirm={() => handleDeleteProvider(instance.id)}
                        okText={'删除'}
                        cancelText={'取消'}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        >
                          {'删除提供商'}
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CloudOutlined style={{ fontSize: '24px', color: '#d9d9d9', marginBottom: 8 }} />
                    <div>
                      <Text type="secondary">{'尚未配置此提供商'}</Text>
                    </div>
                    <Button
                      type="primary"
                      style={{ marginTop: 12 }}
                      onClick={() => handleConfigureProvider(provider)}
                    >
                      {'立即配置'}
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </Collapse>
      </Card>

      {/* 配置模态框 */}
      <Modal
        title={
          <Space>
            {selectedProvider && PROVIDER_ICONS[selectedProvider.id]}
            <span>{editingInstance ? '编辑提供商' : '配置提供商'} {selectedProvider?.name}</span>
          </Space>
        }
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          setSelectedProvider(null);
          setEditingInstance(null);
          form.resetFields();
          setSelectedModels([]);
        }}
        onOk={handleSubmitConfig}
        width={800}
        destroyOnClose
      >
        {selectedProvider && (
          <Form form={form} layout="vertical">
            <Alert
              type="info"
              message={'配置提供商信息'}
              description={selectedProvider.description}
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              name="name"
              label={'配置名称'}
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder={`${selectedProvider.name} 配置`} defaultValue={selectedProvider.id} />
            </Form.Item>

            <Divider orientation="left">{'认证配置'}</Divider>
            
            {selectedProvider.fields.map(field => (
              <Form.Item
                key={field.key}
                name={field.key}
                label={
                  <Space>
                    {field.name}
                    {field.required && <Text type="danger">{'*'}</Text>}
                    {field.description && (
                      <Tooltip title={field.description}>
                        <InfoCircleOutlined style={{ color: '#999' }} />
                      </Tooltip>
                    )}
                  </Space>
                }
                rules={field.required ? [{ required: true, message: `请输入${field.name}` }] : []}
              >
                <FieldRenderer 
                  field={field} 
                  value={form.getFieldValue(field.key)} 
                  onChange={(value) => form.setFieldValue(field.key, value)}
                />
              </Form.Item>
            ))}

            <Divider orientation="left">{'模型选择'}</Divider>
            
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>{'选择要启用的模型'}</Text>
                <Text type="danger" style={{ marginLeft: 4 }}>{'*'}</Text>
              </div>
              <ModelSelector
                models={selectedProvider.default_models}
                selectedModels={selectedModels}
                onChange={setSelectedModels}
              />
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
} 