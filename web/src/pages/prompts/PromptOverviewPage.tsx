import { useState, useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  Typography,
  Button,
  Card,
  Space,
  Row,
  Col,
  Empty,
  message,
  Badge,
  Tag,
  Timeline,
  Divider,
  Progress,
  Dropdown,
  Modal
} from "antd"
import {
  FileTextOutlined,
  EditOutlined,
  HistoryOutlined,
  BranchesOutlined,
  CopyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  ExpandOutlined
} from "@ant-design/icons"
import { PromptsAPI } from '@/lib/api'
import { copyToClipboard } from '@/lib/utils'
import { useProjectJump } from "@/hooks/useProjectJump"
import { HeightController } from '../../utils/heightControl'

const { Text } = Typography

interface PromptVersion {
  id: number;
  prompt_id: number;
  version_number: number;
  variables: string[];
  created_at: string;
  messages?: Message[];
  model_name?: string;
  model_params?: any;
}

interface Message {
  id: number;
  prompt_version_id: number;
  role: string;
  content: string;
  order: number;
  created_at: string;
}

// 消息内容显示组件
const MessageContentDisplay: React.FC<{ 
  content: string; 
  onCopy: (text: string) => void;
  maxHeight?: string;
}> = ({ content, onCopy, maxHeight = '200px' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  if (!content.trim()) {
    return <Text type="secondary">暂无内容</Text>;
  }
  
  const isLongContent = content.length > 300 || content.split('\n').length > 6;
  
  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        background: '#f8f9fa',
        padding: '12px',
        borderRadius: '4px',
        fontSize: '13px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        maxHeight: isLongContent ? maxHeight : 'none',
        overflow: isLongContent ? 'hidden' : 'visible',
        position: 'relative',
        wordBreak: 'break-word'
      }}>
        {content}
        {isLongContent && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '20px',
            background: 'linear-gradient(transparent, #f8f9fa)',
            display: 'flex',
            alignItems: 'end',
            justifyContent: 'center',
            paddingBottom: '2px',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: '9px', color: '#999' }}>...</span>
          </div>
        )}
      </div>
      
      {/* 放大按钮 - 鼠标悬停时显示 */}
      {isLongContent && (
        <Button
          type="text"
          size="small"
          icon={<ExpandOutlined />}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '12px',
            height: '24px',
            width: '24px',
            padding: 0,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onClick={() => setIsModalVisible(true)}
        />
      )}
      
      {/* 内容展开模态框 */}
      <Modal
        title="消息内容"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button 
            key="copy" 
            icon={<CopyOutlined />}
            onClick={() => {
              onCopy(content);
              setIsModalVisible(false);
            }}
          >
            复制内容
          </Button>,
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
        style={{ top: 20 }}
      >
        <div style={{
          maxHeight: '60vh',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontSize: '13px',
          lineHeight: '1.5',
          padding: '16px',
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '6px',
          fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, Courier, monospace'
        }}>
          {content}
        </div>
      </Modal>
    </div>
  );
};

export default function PromptOverviewPage() {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<PromptVersion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [englishMessages, setEnglishMessages] = useState<Message[]>([]);
  const [_, setLoading] = useState(true);
  const [promptName, setPromptName] = useState<string>("Prompt");
  
  // 新增：语言模式状态
  const [languageMode, setLanguageMode] = useState<'zh' | 'en' | 'compare'>('zh');
  
  // 窗口尺寸变化时强制重新渲染
  const [, forceUpdate] = useState({});

  const params = useParams();
  const [searchParams] = useSearchParams();
  const { projectJumpTo } = useProjectJump();
  const promptId = params.id as string;
  const versionParam = searchParams.get('version');
  const navigate = useNavigate();

  // 动态计算消息内容显示高度
  const getMessageMaxHeight = (role: string, language: string = 'zh'): string => {
    const baseConfig = HeightController.getResponsiveBaseConfig(role);
    
    // 计算基础高度：每行约24px
    const lineHeight = 24;
    const baseHeight = baseConfig.maxRows * lineHeight;
    
    // 根据语言模式调整
    const languageMultiplier = language === 'compare' ? 0.8 : 1.0;
    
    // 最终高度
    const finalHeight = Math.round(baseHeight * languageMultiplier);
    
    // 确保最小高度和最大高度
    const minHeight = 120; // 最小5行
    const maxHeight = 600; // 最大25行
    
    return `${Math.max(minHeight, Math.min(maxHeight, finalHeight))}px`;
  };

  // 窗口大小变化监听
  useEffect(() => {
    const handleResize = () => {
      forceUpdate({});
    };

    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150); // 防抖处理
    };

    window.addEventListener('resize', debouncedResize);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      if (!promptId) return;

      try {
        setLoading(true);

        // 加载提示词基本信息
        const promptResponse = await PromptsAPI.getPrompt(Number(promptId));
        if (promptResponse.data.name) {
          setPromptName(promptResponse.data.name);
        }

        // 加载版本列表
        const response = await PromptsAPI.getVersions(Number(promptId));
        const versionList = response.data as PromptVersion[];

        setVersions(versionList);

        if (versionList.length > 0) {
          // 根据URL参数选择版本，否则选择最新版本（第一个）
          const targetVersion = versionParam
            ? versionList.find(v => v.id.toString() === versionParam)
            : versionList[0]; // 版本列表已按时间倒序排列，第一个是最新版本
          const selectedVersion = targetVersion || versionList[0];

          setActiveVersion(selectedVersion);
          
          // 处理双语消息数据
          if (selectedVersion.messages && Array.isArray(selectedVersion.messages)) {
            setMessages(selectedVersion.messages);
          }

          // 加载双语数据
          if (selectedVersion.model_params?.bilingual_data) {
            const bilingualData = selectedVersion.model_params.bilingual_data;
            if (bilingualData.chinese_messages) {
              setMessages(bilingualData.chinese_messages);
            }
            if (bilingualData.english_messages) {
              setEnglishMessages(bilingualData.english_messages);
            }
            // 根据保存的语言设置语言模式
            if (selectedVersion.model_params.language) {
              setLanguageMode(selectedVersion.model_params.language);
            }
          } else {
            // 如果没有双语数据，清空英文消息
            setEnglishMessages([]);
          }

          // 如果没有version参数，自动更新URL为最新版本
          if (!versionParam && selectedVersion) {
            const url = new URL(window.location.href);
            url.searchParams.set('version', selectedVersion.id.toString());
            window.history.replaceState({}, '', url.toString());
          }
        }

        setLoading(false);
      } catch (error) {
              console.error("加载版本失败:", error);
      message.error('加载版本失败');
      setLoading(false);
      }
    };

    loadData();
  }, [promptId, versionParam]);

  // 处理版本切换
  const handleVersionClick = (version: PromptVersion) => {
    setActiveVersion(version);
    
    // 处理双语消息数据
    if (version.messages && Array.isArray(version.messages)) {
      setMessages(version.messages);
    }

    // 加载双语数据
    if (version.model_params?.bilingual_data) {
      const bilingualData = version.model_params.bilingual_data;
      if (bilingualData.chinese_messages) {
        setMessages(bilingualData.chinese_messages);
      }
      if (bilingualData.english_messages) {
        setEnglishMessages(bilingualData.english_messages);
      }
      // 根据保存的语言设置语言模式
      if (version.model_params.language) {
        setLanguageMode(version.model_params.language);
      }
    } else {
      // 如果没有双语数据，清空英文消息
      setEnglishMessages([]);
      // 如果当前是英文或对照模式，切换到中文模式
      if (languageMode === 'en' || languageMode === 'compare') {
        setLanguageMode('zh');
      }
    }

    const url = new URL(window.location.href);
    url.searchParams.set('version', version.id.toString());
    window.history.pushState({}, '', url.toString());
  };

  // 处理编辑按钮点击
  const handleEditClick = () => {
    if (!promptId || !activeVersion) return;

    navigate(projectJumpTo(`prompts/${promptId}/editor?version=${activeVersion.id}`));
  };

  // 复制功能
  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      message.success('复制成功');
    } else {
      message.error('复制失败');
    }
  };

  // 语言模式切换
  const switchToLanguageMode = (mode: 'zh' | 'en' | 'compare') => {
    setLanguageMode(mode);
  };

  // 获取消息角色信息
  const getRoleInfo = (role: string) => {
    const roleMap: Record<string, { name: string; icon: string; color: string }> = {
      system: { name: 'System', icon: '⚙️', color: '#722ed1' },
      user: { name: 'User', icon: '👤', color: '#1890ff' },
      assistant: { name: 'Assistant', icon: '🤖', color: '#52c41a' },
      function: { name: 'Function', icon: '⚡', color: '#fa8c16' }
    };
    return roleMap[role.toLowerCase()] || { name: role, icon: '💬', color: '#d9d9d9' };
  };

  // 根据语言模式获取要显示的消息
  const getDisplayMessages = () => {
    switch (languageMode) {
      case 'zh':
        return messages;
      case 'en':
        return englishMessages.length > 0 ? englishMessages : messages;
      case 'compare':
        return messages; // 对照模式会同时显示两种语言
      default:
        return messages;
    }
  };

  // 检查是否有双语数据
  const hasBilingualData = englishMessages.length > 0;

  return (
    <div style={HeightController.getContainerStyle()}>
      {/* 简化的顶部状态栏 */}
      <Card style={HeightController.getToolbarStyle()}>
        <Row align="middle" style={{ height: '100%' }}>
          <Col flex="auto">
            <Space size={12}>
              <div>
                <Text strong style={{ fontSize: '16px' }}>📖 {promptName} - 概览</Text>
              </div>

              <Divider type="vertical" style={{ height: 24 }} />

              <Space size={8}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <BranchesOutlined /> {versions.length}版本
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <BulbOutlined /> {activeVersion?.variables?.length || 0}变量
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <FileTextOutlined /> {getDisplayMessages().length}消息
                </Text>
                {hasBilingualData && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    🌐 双语版本
                  </Text>
                )}
              </Space>
            </Space>
          </Col>

          <Col>
            <Space size={8}>
              {/* 语言模式切换 - 只在有双语数据时显示 */}
              {hasBilingualData && (
                <Space size={4}>
                  <Button
                    size="small"
                    type={languageMode === 'zh' ? 'primary' : 'default'}
                    onClick={() => switchToLanguageMode('zh')}
                  >
                    中文
                  </Button>
                  <Button
                    size="small"
                    type={languageMode === 'en' ? 'primary' : 'default'}
                    onClick={() => switchToLanguageMode('en')}
                  >
                    English
                  </Button>
                  <Button
                    size="small"
                    type={languageMode === 'compare' ? 'primary' : 'default'}
                    onClick={() => switchToLanguageMode('compare')}
                  >
                    对照
                  </Button>
                </Space>
              )}
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={handleEditClick}
                disabled={!activeVersion}
              >
                编辑选中
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        {/* 左侧：版本历史 */}
        <Col span={6}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>版本历史</span>
                <Badge count={versions.length} size="small" />
              </Space>
            }
            style={HeightController.getCardStyle()}
            bodyStyle={HeightController.getCardBodyStyle()}
          >
            <Timeline
              mode="left"
              items={versions.map((version) => {
                const isActive = activeVersion?.id === version.id;
                const hasVersionBilingualData = version.model_params?.bilingual_data;
                return {
                  dot: isActive ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ClockCircleOutlined />,
                  color: isActive ? 'green' : 'gray',
                  children: (
                    <Card
                      size="small"
                      style={{
                        cursor: 'pointer',
                        border: isActive ? '2px solid #52c41a' : '1px solid #f0f0f0',
                        backgroundColor: isActive ? '#f6ffed' : 'white'
                      }}
                      onClick={() => handleVersionClick(version)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text strong>Version {version.version_number}</Text>
                        <Text style={{ fontSize: '11px', color: '#999' }}>
                          {new Date(version.created_at).toLocaleString()}
                        </Text>
                      </div>
                      <Space size={4} wrap>
                        <Tag color="blue" style={{ fontSize: '10px' }}>
                          {version.variables?.length || 0}变量
                        </Tag>
                        <Tag color="green" style={{ fontSize: '10px' }}>
                          {version.messages?.length || 0}消息
                        </Tag>
                        {hasVersionBilingualData && (
                          <Tag color="orange" style={{ fontSize: '10px' }}>
                            🌐 双语
                          </Tag>
                        )}
                      </Space>
                      {activeVersion?.id === version.id && (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      )}
                    </Card>
                  )
                };
              })}
            />
          </Card>
        </Col>

        {/* 右侧：版本内容 */}
        <Col span={18}>
          {activeVersion ? (
            <div>
              <Row gutter={16}>
                {/* 消息内容 */}
                <Col span={16}>
                  <Card
                    title={
                      <Space>
                        <FileTextOutlined />
                        <span>消息内容</span>
                        <Badge count={getDisplayMessages().length} size="small" />
                        {hasBilingualData && (
                          <Tag color={languageMode === 'zh' ? 'blue' : languageMode === 'en' ? 'green' : 'orange'} style={{ fontSize: '10px' }}>
                            {languageMode === 'zh' ? '中文' : languageMode === 'en' ? 'English' : '对照模式'}
                          </Tag>
                        )}
                      </Space>
                    }
                    style={HeightController.getCardStyle()}
                    bodyStyle={HeightController.getCardBodyStyle()}
                  >
                    {languageMode === 'compare' && hasBilingualData ? (
                      // 对照模式：显示中英文对比
                      <div>
                        {messages.map((message, index) => {
                          const roleInfo = getRoleInfo(message.role);
                          const enMsg = englishMessages[index] || { role: message.role, content: "", order: message.order };
                          
                          return (
                            <Card
                              key={index}
                              size="small"
                              style={{
                                marginBottom: 12,
                                borderLeft: `4px solid ${roleInfo.color}`
                              }}
                              title={
                                <Space size={8}>
                                  <span style={{ fontSize: '14px' }}>{roleInfo.icon}</span>
                                  <Text strong style={{ fontSize: '13px' }}>{roleInfo.name}</Text>
                                  <Badge count={index + 1} size="small" style={{ backgroundColor: roleInfo.color }} />
                                </Space>
                              }
                              extra={
                                <Space size={4}>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => handleCopy(message.content)}
                                  />
                                  <Dropdown
                                    menu={{
                                      items: [
                                        {
                                          key: 'copy-chinese',
                                          label: '复制中文',
                                          onClick: () => handleCopy(message.content)
                                        },
                                        {
                                          key: 'copy-english',
                                          label: '复制英文',
                                          onClick: () => handleCopy(enMsg.content)
                                        }
                                      ]
                                    }}
                                    trigger={['click']}
                                  >
                                    <Button type="text" size="small">
                                      更多
                                    </Button>
                                  </Dropdown>
                                </Space>
                              }
                            >
                              <Row gutter={8}>
                                <Col span={12}>
                                  <div style={{ marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: '11px' }}>🇨🇳 中文版本</Text>
                                  </div>
                                  <MessageContentDisplay 
                                    content={message.content} 
                                    onCopy={handleCopy}
                                    maxHeight={getMessageMaxHeight(message.role, 'compare')}
                                  />
                                </Col>
                                <Col span={12}>
                                  <div style={{ marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: '11px' }}>🇺🇸 English Version</Text>
                                  </div>
                                  <MessageContentDisplay 
                                    content={enMsg.content} 
                                    onCopy={handleCopy}
                                    maxHeight={getMessageMaxHeight(message.role, 'compare')}
                                  />
                                </Col>
                              </Row>
                              <div style={{ marginTop: 8, fontSize: '11px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                                <span>💡 双语对照模式</span>
                                <span>中文: {message.content.length} 字符 | 英文: {enMsg.content.length} 字符</span>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      // 单语言模式
                      <div>
                        {getDisplayMessages().filter(message => message.content.length > 0).map((message, index) => {
                          const roleInfo = getRoleInfo(message.role);
                          
                          return (
                            <Card
                              key={index}
                              size="small"
                              style={{
                                marginBottom: 12,
                                borderLeft: `4px solid ${roleInfo.color}`
                              }}
                              title={
                                <Space size={8}>
                                  <span style={{ fontSize: '14px' }}>{roleInfo.icon}</span>
                                  <Text strong style={{ fontSize: '13px' }}>{roleInfo.name}</Text>
                                  <Badge count={index + 1} size="small" style={{ backgroundColor: roleInfo.color }} />
                                  {hasBilingualData && (
                                    <Tag color={languageMode === 'zh' ? 'blue' : 'green'} style={{ fontSize: '10px' }}>
                                      {languageMode === 'zh' ? '中文' : 'English'}
                                    </Tag>
                                  )}
                                </Space>
                              }
                              extra={
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => handleCopy(message.content)}
                                />
                              }
                            >
                              <MessageContentDisplay 
                                content={message.content} 
                                onCopy={handleCopy}
                                maxHeight={getMessageMaxHeight(message.role, languageMode)}
                              />
                            </Card>
                          );
                        })}
                      </div>
                    )}

                    {getDisplayMessages().length === 0 && (
                      <Empty
                        description="此版本暂无消息内容"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </Card>
                </Col>

                {/* 配置信息 */}
                <Col span={8}>
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    {/* 模型配置 */}
                    <Card
                      title={
                        <Space>
                          <ThunderboltOutlined />
                          <span>模型配置</span>
                        </Space>
                      }
                      size="small"
                    >
                      {activeVersion.model_name ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                          <div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>模型名称</Text>
                            <div style={{ fontWeight: 500 }}>{activeVersion.model_name}</div>
                          </div>

                          {activeVersion.model_params && (
                            <>
                              <Divider style={{ margin: '8px 0' }} />
                              <div>
                                <Text type="secondary" style={{ fontSize: '11px' }}>参数配置</Text>
                                <div style={{ marginTop: 4 }}>
                                  {/* 过滤language和bilingual_data */}
                                  {Object.entries(activeVersion.model_params)
                                    .filter(([key]) => key !== 'language' && key !== 'bilingual_data')
                                    .map(([key, value]) => (
                                      <div key={key} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        marginBottom: 4,
                                        fontSize: '12px'
                                      }}>
                                        <Text type="secondary">{key}:</Text>
                                        <Text>{String(value)}</Text>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </>
                          )}
                        </Space>
                      ) : (
                        <Empty description="暂无模型配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>

                    {/* 变量信息 */}
                    <Card
                      title={
                        <Space>
                          <BulbOutlined />
                          <span>变量列表</span>
                          <Badge count={activeVersion.variables?.length || 0} size="small" />
                        </Space>
                      }
                      size="small"
                    >
                      {activeVersion.variables && activeVersion.variables.length > 0 ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={4}>
                          {activeVersion.variables.map((variable, index) => (
                            <Tag
                              key={index}
                              color="blue"
                              style={{
                                margin: '2px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleCopy(`{{${variable}}}`)}
                            >
                              {variable}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Empty description="暂无变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Card>

                    {/* 统计信息 */}
                    <Card
                      title={
                        <Space>
                          <ExperimentOutlined />
                          <span>统计信息</span>
                        </Space>
                      }
                      size="small"
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff' }}>
                            {messages.reduce((sum, msg) => sum + msg.content.length, 0)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#999' }}>总字符数</div>
                        </div>

                        <Progress
                          percent={100}
                          size="small"
                          status="success"
                          format={() => '完整版本'}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: 8 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#52c41a' }}>{messages.length}</div>
                            <div style={{ color: '#999' }}>消息数</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#722ed1' }}>{activeVersion.variables?.length || 0}</div>
                            <div style={{ color: '#999' }}>变量数</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: '#fa8c16' }}>100%</div>
                            <div style={{ color: '#999' }}>完整度</div>
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Space>
                </Col>
              </Row>
            </div>
          ) : (
            <Card style={HeightController.getCardStyle()}>
              <Empty description="选择版本查看内容" />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
} 