import { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Input, Modal, message, Divider } from 'antd';
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

import { ProjectAPI } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

const { Title, Text, Paragraph } = Typography;

interface ApiKey {
  id: number;
  name: string;
  key: string;
  lastUsed: string | null;
  createdAt: string;
}

interface ApiKeysSectionProps {
  projectId?: string;
}

export function ApiKeysSection({ projectId }: ApiKeysSectionProps) {
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadApiKeys();
    }
  }, [projectId]);

  const loadApiKeys = () => {
    setLoading(true);
    ProjectAPI.getApiKeys(parseInt(projectId!))
      .then(res => {
        setApiKeys(res.data);
      })
      .catch(err => {
        console.error('获取API密钥失败', err);
        message.error('获取API密钥失败');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      message.warning('请输入密钥名称');
      return;
    }

    setCreateLoading(true);
    ProjectAPI.createApiKey(parseInt(projectId!), newKeyName)
      .then(res => {
        setNewKeyValue(res.data.key);
        message.success('API密钥创建成功');
        loadApiKeys();
      })
      .catch(err => {
        console.error('创建API密钥失败', err);
        message.error('创建API密钥失败: ' + (err.message || '未知错误'));
      })
      .finally(() => {
        setCreateLoading(false);
      });
  };

  const handleDeleteKey = (keyId: number) => {
    Modal.confirm({
      title: '确认删除API密钥',
      content: '此操作不可逆转。使用此密钥的应用程序将无法再访问API。',
      onOk: () => {
        ProjectAPI.deleteApiKey(parseInt(projectId!), keyId)
          .then(() => {
            message.success('API密钥删除成功');
            loadApiKeys();
          })
          .catch(err => {
            console.error('删除API密钥失败', err);
            message.error('删除API密钥失败');
          });
      }
    });
  };

  const copyApiKey = async (key: string) => {
    const success = await copyToClipboard(key);
    if (success) {
      message.success('API密钥已复制到剪贴板');
    } else {
      message.error('复制失败');
    }
  };

  const closeCreateModal = () => {
    setCreateModalVisible(false);
    setNewKeyName('');
    setNewKeyValue('');
    setShowNewKey(false);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '密钥',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Text style={{ fontFamily: 'monospace' }}>
          {`${key.substring(0, 8)}...`}
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyApiKey(key)}
            style={{ marginLeft: 8 }}
          />
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (date: string | null) => (date ? new Date(date).toLocaleString() : '从未使用'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ApiKey) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteKey(record.id)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4}>API 密钥</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建API密钥
          </Button>
        </div>

        <Paragraph>
          API 密钥用于验证对此项目的请求。您可以创建和管理多个密钥。
        </Paragraph>

        <Table
          columns={columns}
          dataSource={apiKeys}
          rowKey="id"
          loading={loading}
        />

        <Divider />
        
        <div>
          <Title level={5}>使用示例</Title>
          <Paragraph>
            <pre style={{ background: '#f6f8fa', padding: '12px', borderRadius: '4px' }}>
              <code>
{`# 使用Python SDK
import PromptLab
promptlab.api_key = "pl-xxx"

`}
              </code>
            </pre>
          </Paragraph>
        </div>
      </Card>

      {/* 创建API密钥模态框 */}
      <Modal
        title="创建新的API密钥"
        open={createModalVisible}
        onCancel={closeCreateModal}
        footer={null}
      >
        {!newKeyValue ? (
          <div>
            <Input
              placeholder="输入密钥名称"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Button
              type="primary"
              loading={createLoading}
              onClick={handleCreateKey}
            >
              创建
            </Button>
          </div>
        ) : (
          <div>
            <Text type="success">API密钥创建成功！请保存此密钥，它不会再次显示。</Text>
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center' }}>
              <Input.Password
                value={newKeyValue}
                readOnly
                visibilityToggle={{ visible: showNewKey, onVisibleChange: setShowNewKey }}
                style={{ flex: 1 }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => copyApiKey(newKeyValue)}
                style={{ marginLeft: 8 }}
              >
                复制
              </Button>
            </div>
            
            <Button style={{ marginTop: 16 }} onClick={closeCreateModal}>
              完成
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
} 