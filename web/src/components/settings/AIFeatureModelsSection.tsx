import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Select,
  Button,
  Space,
  message,
  Spin,
  Alert,
  Divider,
  Row,
  Col,
  Tooltip,
} from 'antd';
import { SaveOutlined, InfoCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { AIFeaturesAPI, ModelsAPI } from '@/lib/api';
import type { AvailableModel } from '@/types/llm';

const { Title, Text, Paragraph } = Typography;
const { Option, OptGroup } = Select;

interface AIFeatureConfig {
  id: number;
  project_id: number;
  feature_key: string;
  provider: string;
  model_id: string;
  label?: string;
}

interface AIFeatureModelsSectionProps {
  projectId: number;
}

// 功能分组定义（用于UI展示）
const FEATURE_GROUPS = [
  {
    groupLabel: '提示词编辑功能',
    features: [
      {
        key: 'translate',
        label: '提示词翻译',
        description: '将提示词在中英文之间互译',
      },
      {
        key: 'test_case_generator',
        label: '测试用例生成',
        description: '自动生成测试用例（正常、边界、异常）',
      },
      {
        key: 'prompt_optimizer',
        label: '提示词优化',
        description: '分析并优化提示词质量和效果',
      },
    ],
  },
  {
    groupLabel: 'AI助手功能',
    features: [
      {
        key: 'prompt_assistant_chat',
        label: 'AI助手对话（标准）',
        description: '用于主对话回复和Agent模式，推荐使用能力较强的模型',
      },
      {
        key: 'prompt_assistant_mini',
        label: 'AI助手辅助任务（快速）',
        description: '用于意图识别、提示词编辑、回复建议等轻量任务，可使用速度更快的小模型',
      },
    ],
  },
  {
    groupLabel: '评估功能',
    features: [
      {
        key: 'evaluation_llm',
        label: '评估 LLM 裁判',
        description: '用于 LLM_JUDGE 类型评估列的模型裁判调用',
      },
    ],
  },
];

export function AIFeatureModelsSection({ projectId }: AIFeatureModelsSectionProps) {
  const [configs, setConfigs] = useState<Record<string, AIFeatureConfig>>({});
  const [pendingConfigs, setPendingConfigs] = useState<Record<string, { provider: string; model_id: string }>>({});
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configsRes, modelsRes] = await Promise.all([
        AIFeaturesAPI.getFeatureConfigs(projectId),
        ModelsAPI.getAvailableModels(projectId),
      ]);

      const configMap: Record<string, AIFeatureConfig> = {};
      const pendingMap: Record<string, { provider: string; model_id: string }> = {};
      for (const cfg of configsRes.data as AIFeatureConfig[]) {
        configMap[cfg.feature_key] = cfg;
        pendingMap[cfg.feature_key] = { provider: cfg.provider, model_id: cfg.model_id };
      }
      setConfigs(configMap);
      setPendingConfigs(pendingMap);
      setAvailableModels(modelsRes.data);
    } catch (err: any) {
      message.error('加载AI功能模型配置失败：' + (err?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleModelChange = (featureKey: string, modelId: string) => {
    const model = availableModels.find(m => `${m.provider_type}::${m.model_id}` === modelId);
    if (!model) return;
    setPendingConfigs(prev => ({
      ...prev,
      [featureKey]: { provider: model.provider_type, model_id: model.model_id },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configList = Object.entries(pendingConfigs).map(([feature_key, { provider, model_id }]) => ({
        feature_key,
        provider,
        model_id,
      }));
      await AIFeaturesAPI.updateFeatureConfigs(projectId, configList);
      message.success('AI功能模型配置已保存');
      await loadData();
    } catch (err: any) {
      message.error('保存失败：' + (err?.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  // 按提供商分组可用模型，用于 Select 的 OptGroup
  const modelsByProvider = availableModels.reduce<Record<string, AvailableModel[]>>((acc, m) => {
    const key = m.provider_name || m.provider_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const getSelectValue = (featureKey: string) => {
    const pending = pendingConfigs[featureKey];
    if (!pending) return undefined;
    return `${pending.provider}::${pending.model_id}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const hasModels = availableModels.length > 0;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8 }} />
            AI功能模型配置
          </Title>
          <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>
            为各AI功能模块指定使用的模型。模型选项来自项目已配置的提供商。
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSave}
          disabled={!hasModels}
        >
          保存配置
        </Button>
      </div>

      {!hasModels && (
        <Alert
          type="warning"
          showIcon
          message="尚未配置任何模型"
          description='请先在"模型管理"页签中添加提供商和模型，然后回此处选择各功能使用的模型。'
          style={{ marginBottom: 16 }}
        />
      )}

      {FEATURE_GROUPS.map((group, gi) => (
        <Card
          key={gi}
          title={group.groupLabel}
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '8px 24px 16px' }}
        >
          {group.features.map((feature, fi) => (
            <React.Fragment key={feature.key}>
              {fi > 0 && <Divider style={{ margin: '8px 0' }} />}
              <Row align="middle" style={{ padding: '12px 0' }} gutter={16}>
                <Col span={8}>
                  <Space direction="vertical" size={0}>
                    <Text strong>{feature.label}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {feature.description}
                    </Text>
                  </Space>
                </Col>
                <Col span={14}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="请选择模型"
                    value={getSelectValue(feature.key)}
                    onChange={(val) => handleModelChange(feature.key, val)}
                    disabled={!hasModels}
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.children ?? option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {Object.entries(modelsByProvider).map(([providerName, models]) => (
                      <OptGroup key={providerName} label={providerName}>
                        {models.map(m => (
                          <Option key={`${m.provider_type}::${m.model_id}`} value={`${m.provider_type}::${m.model_id}`}>
                            {m.name || m.model_id}
                            {m.type === 'custom' && (
                              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>自定义</Text>
                            )}
                          </Option>
                        ))}
                      </OptGroup>
                    ))}
                  </Select>
                </Col>
                <Col span={2} style={{ textAlign: 'right' }}>
                  <Tooltip title={`当前配置：${configs[feature.key]?.provider ?? '-'} / ${configs[feature.key]?.model_id ?? '默认'}`}>
                    <InfoCircleOutlined style={{ color: '#8c8c8c', cursor: 'pointer' }} />
                  </Tooltip>
                </Col>
              </Row>
            </React.Fragment>
          ))}
        </Card>
      ))}
    </div>
  );
}
