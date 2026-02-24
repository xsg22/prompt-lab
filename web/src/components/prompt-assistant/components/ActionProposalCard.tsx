import React, { useState } from 'react';

import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  Tag, 
  Divider, 
  Collapse, 
  Badge,
  Alert,
  Modal} from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  EyeOutlined, 
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ActionProposal, PromptModification } from '@/types/promptAssistant';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface ActionProposalCardProps {
  proposal: ActionProposal;
  onApply: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string) => void;
  disabled?: boolean;
}

const ActionProposalCard: React.FC<ActionProposalCardProps> = ({
  proposal,
  onApply,
  onReject,
  disabled = false
}) => {
  
  const [showPreview, setShowPreview] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // 影响级别颜色映射
  const impactColors = {
    low: 'green',
    medium: 'orange', 
    high: 'red'
  };

  // 影响级别文本映射
  const impactTexts = {
    low: '低影响',
    medium: '中等影响',
    high: '高影响'
  };

  // 修改类型图标映射
  const modificationIcons = {
    add_message: <EditOutlined style={{ color: '#52c41a' }} />,
    modify_message: <EditOutlined style={{ color: '#1890ff' }} />,
    delete_message: <CloseOutlined style={{ color: '#ff4d4f' }} />,
    reorder_messages: <EditOutlined style={{ color: '#722ed1' }} />,
    add_variable: <EditOutlined style={{ color: '#52c41a' }} />,
    modify_variable: <EditOutlined style={{ color: '#1890ff' }} />,
    delete_variable: <CloseOutlined style={{ color: '#ff4d4f' }} />
  };

  // 修改类型文本映射
  const modificationTexts = {
    add_message: '添加消息',
    modify_message: '修改消息',
    delete_message: '删除消息',
    reorder_messages: '重新排序消息',
    add_variable: '添加变量',
    modify_variable: '修改变量',
    delete_variable: '删除变量'
  };

  // 处理应用提案
  const handleApply = () => {
    Modal.confirm({
      title: '确认应用修改',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>{'您确定要应用这个修改提案吗？'}</p>
          <p style={{ color: '#999', fontSize: '12px' }}>
            {'此操作将直接修改您的提示词内容。'}
          </p>
        </div>
      ),
      okText: '应用',
      cancelText: '取消',
      onOk: async () => {
        setIsApplying(true);
        try {
          await onApply(proposal.id);
        } catch (error) {
          console.error('应用修改失败', error);
        } finally {
          setIsApplying(false);
        }
      }
    });
  };

  // 处理拒绝提案
  const handleReject = () => {
    onReject(proposal.id);
  };

  // 渲染修改详情
  const renderModification = (mod: PromptModification, index: number) => (
    <div key={mod.id || index} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {modificationIcons[mod.type]}
        <Text strong>{modificationTexts[mod.type]}</Text>
        {mod.target.messageIndex !== undefined && (
          <Tag>{`消息 #${mod.target.messageIndex + 1}`}</Tag>
        )}
        {mod.target.variableName && (
          <Tag color="blue">{mod.target.variableName}</Tag>
        )}
      </div>
      
      {mod.reasoning && (
        <Paragraph style={{ fontSize: '12px', color: '#666', margin: '4px 0' }}>
          {mod.reasoning}
        </Paragraph>
      )}
      
      {mod.preview && (
        <Alert
          message={'修改预览'}
          description={
            <pre style={{ 
              fontSize: '11px', 
              margin: 0, 
              whiteSpace: 'pre-wrap',
              backgroundColor: '#f5f5f5',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {mod.preview}
            </pre>
          }
          type="info"
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );

  return (
    <>
      <Card
        size="small"
        style={{ 
          margin: '8px 0',
          border: proposal.isApplied ? '1px solid #52c41a' : '1px solid #d9d9d9'
        }}
        bodyStyle={{ padding: '12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: '14px' }}>{proposal.title}</Text>
              <Tag color={impactColors[proposal.estimatedImpact]}>
                {impactTexts[proposal.estimatedImpact]}
              </Tag>
              <Badge count={proposal.confidence} color="#1890ff" />
            </div>
            
            <Paragraph 
              style={{ 
                fontSize: '12px', 
                color: '#666', 
                margin: 0,
                lineHeight: '1.4'
              }}
            >
              {proposal.description}
            </Paragraph>
          </div>
        </div>

        {proposal.tags.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Space size={4} wrap>
              {proposal.tags.map(tag => (
                <Tag key={tag} color="geekblue">{tag}</Tag>
              ))}
            </Space>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        {/* 修改摘要 */}
        <div style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: '12px', color: '#999' }}>
            {`共 ${proposal.modifications.length} 项修改`}
          </Text>
        </div>

        {/* 修改详情折叠面板 */}
        <Collapse size="small" ghost>
          <Panel 
            header={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <InfoCircleOutlined style={{ fontSize: '12px' }} />
                <span style={{ fontSize: '12px' }}>{'查看修改详情'}</span>
              </div>
            } 
            key="details"
          >
            {proposal.modifications.map(renderModification)}
          </Panel>
        </Collapse>

        {/* 操作按钮 */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => setShowPreview(true)}
            disabled={disabled}
          >
            {'预览差异'}
          </Button>
          
          <Space size={8}>
            <Button
              size="small"
              onClick={handleReject}
              disabled={disabled || proposal.isApplied}
            >
              {'拒绝'}
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              size="small"
              loading={isApplying}
              onClick={handleApply}
              disabled={disabled || proposal.isApplied}
            >
              {proposal.isApplied ? '已应用' : '应用修改'}
            </Button>
          </Space>
        </div>
      </Card>

      {/* 预览差异弹窗 */}
      <Modal
        title={`修改预览 - ${proposal.title}`}
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        footer={[
          <Button key="close" onClick={() => setShowPreview(false)}>
            {'关闭'}
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<CheckOutlined />}
            loading={isApplying}
            onClick={() => {
              setShowPreview(false);
              handleApply();
            }}
            disabled={disabled || proposal.isApplied}
          >
            {'应用修改'}
          </Button>
        ]}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {proposal.previewDiff ? (
            <pre style={{ 
              fontSize: '12px',
              backgroundColor: '#f5f5f5',
              padding: '12px',
              borderRadius: '4px',
              whiteSpace: 'pre-wrap'
            }}>
              {proposal.previewDiff}
            </pre>
          ) : (
            <div>
              {proposal.modifications.map(renderModification)}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default ActionProposalCard; 