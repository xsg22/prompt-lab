import React, { useState, useRef, useEffect } from 'react';
import {
  Input,
  Button,
  Typography,
  Space,
  Tooltip,
  Badge,
  theme,
  Avatar,
  Spin,
  Card,
  message,
  Divider
} from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  ClearOutlined,
  MessageOutlined,
  ArrowUpOutlined,
  LoadingOutlined,
  RocketOutlined,
  CopyOutlined,
  ReloadOutlined,
  StopOutlined,
  SettingOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { usePromptAssistant } from './hooks/usePromptAssistant';
import ModeToggle from './components/ModeToggle';
import ActionProposalCard from './components/ActionProposalCard';
import StreamingMessage from './components/StreamingMessage';
import type { ChatMessage, AssistantContext } from '@/types/promptAssistant';


const { Text } = Typography;
const { TextArea } = Input;

interface AssistantChatProps {
  projectId: number;
  promptId: number;
  promptVersionId: number;
  context: AssistantContext;
  style?: React.CSSProperties;
  height?: string;
  disabled?: boolean;
  onContextUpdate?: (newContext: AssistantContext) => void;
}

const AssistantChat: React.FC<AssistantChatProps> = ({
  projectId,
  promptId,
  promptVersionId,
  context,
  style,
  height = 'calc(100vh - 250px)',
  disabled = false,
  onContextUpdate
}) => {
  // 所有 hooks 必须在组件顶层调用
  
  const { token } = theme.useToken();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const isUserScrollingRef = useRef(false);
  const {
    messages,
    isLoading,
    isThinking,
    isInitialized,
    mode,
    isStreaming,
    replySuggestions,
    pendingActions,
    // isLoadingSuggestions,
    sendMessage,
    sendChatMessage,
    switchMode,
    applyActionProposal,
    rejectActionProposal,
    regenerateLastResponse,
    clearChat,
    cancelRequest
  } = usePromptAssistant({
    projectId,
    promptId,
    promptVersionId,
    context,
    onContextUpdate
  });

  // 检查是否滚动到底部
  const isScrolledToBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 50; // 允许50px的误差
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  };

  // 自动滚动到底部
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (shouldAutoScroll && !isUserScrollingRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  // 处理用户滚动事件
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // 防抖处理，避免过于频繁的检查
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      const isAtBottom = isScrolledToBottom();
      setShouldAutoScroll(isAtBottom);
      isUserScrollingRef.current = false;
    }, 50);
  };

  // 检测用户主动滚动
  const handleUserScroll = () => {
    isUserScrollingRef.current = true;
    handleScroll();
  };

  // 监听消息变化和流式更新
  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // 监听流式内容变化，更频繁地滚动
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        scrollToBottom('auto'); // 流式时使用更快的滚动
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [isStreaming, shouldAutoScroll]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 发送消息 - 根据模式选择发送方法
  const handleSendMessage = (message?: string) => {
    const value = (message !== undefined ? message : inputValue).trim();
    if (!value || isLoading || disabled) return;
    
    // 重置自动滚动状态
    resetAutoScroll();
    
    // 根据模式选择发送方法
    if (mode === 'chat') {
      sendChatMessage(value); // Chat模式使用流式发送
    } else {
      sendMessage(value); // Agent模式使用结构化发送
    }
    setInputValue('');
  };

  // 处理动作应用
  const handleApplyAction = async (proposalId: string) => {
   
    try {
      
      // 应用修改并获取新的上下文
      await applyActionProposal(proposalId);
      
    } catch (error) {
      console.error('应用操作失败', error);
    }
  };

  // 重置自动滚动状态 - 当发送新消息时
  const resetAutoScroll = () => {
    setShouldAutoScroll(true);
    isUserScrollingRef.current = false;
  };

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 根据提示词内容判断是否为空
  const isPromptEmpty = !context.currentMessages || 
    context.currentMessages.length === 0 || 
    context.currentMessages.every(msg => !msg.content.trim());

  // 根据提示词名称生成针对性建议
  const generateContextualSuggestions = (promptName?: string) => {
    if (isPromptEmpty) {
      // 当提示词为空时，根据标题提供针对性指导
      if (promptName && promptName !== '提示词编辑器') {
        const title = promptName.toLowerCase();
        
        // 根据标题关键词判断场景
        if (title.includes('翻译') || title.includes('translate')) {
          return [
            '如何为"{{name}}"设计一个好的翻译提示词？',
            '翻译提示词应该包含哪些要素？',
            '给我一个翻译任务的提示词模板'
          ];
        } else if (title.includes('总结') || title.includes('摘要') || title.includes('summary')) {
          return [
            '如何为"{{name}}"设计一个高质量的总结提示词？',
            '总结类提示词的最佳实践是什么？',
            '给我一个文本总结的提示词模板'
          ];
        } else if (title.includes('写作') || title.includes('创作') || title.includes('生成') || title.includes('写')) {
          return [
            '如何为"{{name}}"设计一个创作类提示词？',
            '写作类提示词应该如何构建？',
            '给我一个内容生成的提示词模板'
          ];
        } else if (title.includes('分析') || title.includes('分类') || title.includes('判断')) {
          return [
            '如何为"{{name}}"设计一个分析类提示词？',
            '分析判断类任务的提示词要点是什么？',
            '给我一个分析分类的提示词模板'
          ];
        } else if (title.includes('客服') || title.includes('对话') || title.includes('聊天')) {
          return [
            '如何为"{{name}}"设计一个对话类提示词？',
            '对话机器人的提示词应该如何写？',
            '给我一个客服对话的提示词模板'
          ];
        } else {
          return [
            '如何为"{{name}}"快速编写一个有效的提示词？',
            '给我一个通用的提示词模板',
            '基于任务名称，这个提示词应该包含什么？'
          ];
        }
      } else {
        return [
          '如何快速编写一个有效的提示词？',
          '给我一个通用的提示词模板',
          '什么是好的提示词结构？'
        ];
      }
    } else {
      // 当有提示词内容时，提供优化建议
      return [
        '分析当前提示词有什么问题',
        '如何让回答更加准确？',
        '推荐一些变量设计'
      ];
    }
  };

  // 根据提示词内容状态设置不同的初始建议
  const initialSuggestions = generateContextualSuggestions(context.promptName);

  // 复制消息内容
  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('复制成功');
    } catch {
      message.error('复制失败');
    }
  };

  // 重试生成答案 - 直接重新生成最后一条助手回复
  const handleRetry = () => {
    regenerateLastResponse();
  };

  // 消息渲染
  const renderMessage = (message: ChatMessage, idx: number) => {
    const isUser = message.role === 'user';
    const isSystem = message.type === 'system';
    const isAssistant = message.role === 'assistant';
    const isStreaming = message.isStreaming;
    const isActionProposal = message.type === 'action_proposal';
    const isError = message.error; // 新增：是否为错误消息

    // 流式消息特殊渲染
    if (isAssistant && isStreaming) {
      return (
        <StreamingMessage
          key={message.id}
          content={message.content}
          isStreaming={true}
          timestamp={message.timestamp}
          tokenColor={token.colorSuccess}
        />
      );
    }

    // 动作提案消息特殊渲染
    if (isActionProposal && pendingActions.length > 0) {
      return (
        <div key={message.id}>
          {/* 普通消息 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: 16
            }}
          >
            <div
              style={{
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12
              }}
            >
              <Avatar
                size="small"
                icon={<RobotOutlined />}
                style={{
                  backgroundColor: token.colorSuccess,
                  flexShrink: 0
                }}
              />
              <div
                style={{
                  backgroundColor: '#f5f5f5',
                  borderRadius: 12,
                  padding: '8px 12px',
                  position: 'relative'
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    p: ({ children }) => <div style={{ margin: 0, lineHeight: '1.5' }}>{children}</div>
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          
          {/* 动作提案卡片 */}
          {pendingActions.map(proposal => (
            <ActionProposalCard
              key={proposal.id}
              proposal={proposal}
              onApply={handleApplyAction}
              onReject={rejectActionProposal}
              disabled={disabled || isLoading}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 16
        }}
      >
        <div
          style={{
            maxWidth: '80%',
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 12
          }}
        >
          {/* 头像 */}
          <Avatar
            size="small"
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? token.colorPrimary : token.colorSuccess,
              flexShrink: 0
            }}
          />
          {/* 消息内容 */}
          <div
            style={{
              background: isSystem ? 'transparent' :
                isUser ? token.colorPrimary : 
                isError ? '#ffebee' : token.colorFillQuaternary, // 错误消息使用红色背景
              color: isSystem ? token.colorText :
                isUser ? '#fff' : 
                isError ? '#d32f2f' : token.colorText, // 错误消息使用红色文字
              padding: '12px 16px',
              borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: '14px',
              lineHeight: '1.5',
              position: 'relative',
              boxShadow: token.boxShadowTertiary,
              minWidth: 0,
              border: isError ? '1px solid #f5c6cb' : 'none' // 错误消息添加红色边框
            }}
          >

            {isSystem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Spin
                  indicator={<LoadingOutlined style={{ fontSize: 14, color: token.colorText }} />}
                  spinning={isThinking}
                />
                <Text style={{ fontSize: '14px', color: token.colorText }}>
                  {message.content}
                </Text>
              </div>
            )}

            {!isSystem && (
              <div>
                {/* 支持 Markdown 渲染 */}
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      // 自定义代码块样式
                      code: ({ node, inline, className, children, ...props }: any) => {
                        if (inline) {
                          return (
                            <code
                              style={{
                                background: isUser ? 'rgba(255,255,255,0.2)' : token.colorFillSecondary,
                                padding: '2px 4px',
                                borderRadius: '4px',
                                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                                fontSize: '13px'
                              }}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }

                        return (
                          <pre
                            style={{
                              background: isUser ? 'rgba(255,255,255,0.1)' : token.colorFillTertiary,
                              padding: '12px',
                              borderRadius: '6px',
                              overflow: 'auto',
                              margin: '8px 0',
                              fontSize: '13px',
                              fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                            }}
                          >
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      },
                      // 自定义链接样式
                      a: ({ children, href, ...props }: any) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: isUser ? 'rgba(255,255,255,0.9)' : token.colorPrimary,
                            textDecoration: 'underline'
                          }}
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      // 自定义段落样式
                      p: ({ children, ...props }: any) => (
                        <p style={{ margin: '8px 0' }} {...props}>
                          {children}
                        </p>
                      ),
                      // 自定义列表样式
                      ul: ({ children, ...props }: any) => (
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children, ...props }: any) => (
                        <ol style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                          {children}
                        </ol>
                      ),
                      // 自定义表格样式
                      table: ({ children, ...props }: any) => (
                        <table
                          style={{
                            borderCollapse: 'collapse',
                            width: '100%',
                            margin: '8px 0',
                            fontSize: '13px'
                          }}
                          {...props}
                        >
                          {children}
                        </table>
                      ),
                      th: ({ children, ...props }: any) => (
                        <th
                          style={{
                            border: `1px solid ${token.colorBorder}`,
                            padding: '8px',
                            background: token.colorFillTertiary,
                            textAlign: 'left'
                          }}
                          {...props}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children, ...props }: any) => (
                        <td
                          style={{
                            border: `1px solid ${token.colorBorder}`,
                            padding: '8px'
                          }}
                          {...props}
                        >
                          {children}
                        </td>
                      ),
                      // 自定义引用块样式
                      blockquote: ({ children, ...props }: any) => (
                        <blockquote
                          style={{
                            borderLeft: `4px solid ${token.colorPrimary}`,
                            paddingLeft: '12px',
                            margin: '8px 0',
                            background: isUser ? 'rgba(255,255,255,0.1)' : token.colorFillTertiary,
                            borderRadius: '0 4px 4px 0'
                          }}
                          {...props}
                        >
                          {children}
                        </blockquote>
                      )
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}

                {/* 助理消息操作按钮 - 放在内容下方 */}
                {isAssistant && (
                  <div style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 8,
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    justifyContent: 'flex-start'
                  }}>
                    <Tooltip title={'复制内容'}>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(message.content)}
                        style={{
                          color: token.colorTextSecondary,
                          height: 28,
                          fontSize: '10px',
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                          background: 'transparent',
                          border: `1px solid ${token.colorBorder}`
                        }}
                      >
                        {'复制'}
                      </Button>
                    </Tooltip>
                    {/* 只在最后一条助手消息显示重试按钮 */}
                    {idx === messages.length - 1 && (
                      <Tooltip title={'重新生成'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={handleRetry}
                          disabled={isLoading || isThinking}
                          style={{
                            color: token.colorTextSecondary,
                            height: 28,
                            fontSize: '10px',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            borderRadius: '6px',
                            transition: 'all 0.2s ease',
                            background: 'transparent',
                            border: `1px solid ${token.colorBorder}`
                          }}
                        >
                          {'重试'}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };



  const renderPlaceholder = () => (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '64px', marginBottom: 16 }}>🐶</div>
      <Text style={{ fontSize: '18px', fontWeight: 500, display: 'block', marginBottom: 8 }}>
        {'你好！我是小白，你的智能提示词助理'}
      </Text>
      <Text style={{ fontSize: '14px', color: token.colorTextSecondary, display: 'block', marginBottom: 32 }}>
        {'我可以帮助你编写和优化AI提示词，让你的AI对话更加精准有效'}
      </Text>

      {/* 快速回复 */}
      <div>
        <Text style={{ fontSize: '13px', color: token.colorTextSecondary, marginBottom: 16, display: 'block' }}>
          💡 {'你可以这样问我：'}
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {initialSuggestions.map((reply, index) => (
            <Button
              key={index}
              type="text"
              size="middle"
              onClick={() => handleSendMessage(reply)}
              disabled={disabled || isLoading}
              style={{
                fontSize: '13px',
                // width: '100%',
                textAlign: 'left',
                height: 'auto',
                padding: '4px 16px',
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: 12,
                color: token.colorText,
                transition: 'all 0.2s ease',
                boxShadow: `0 1px 2px ${token.colorBorder}20`
              }}
            >
              {reply}
            </Button>
          ))}
        </Space>
      </div>
    </div>
  );

  // 只在 return 里做条件渲染
  if (!isInitialized) {
    return (
      <Card
        style={{ ...style, height }}
        styles={{
          body: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%'
          }
        }}
      >
        <Text style={{ color: '#666' }}>{'初始化助理中...'}</Text>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <RocketOutlined style={{ color: '#52c41a' }} />
          <span>{'提示词助理 - 小白'}</span>
          {messages.length > 0 && (
            <Badge
              count={messages.length}
              size="small"
              style={{ backgroundColor: '#1890ff' }}
            />
          )}
          <Divider type="vertical" />
          <ModeToggle
            mode={mode}
            onChange={switchMode}
            disabled={disabled || isLoading}
          />
        </Space>
      }
      extra={
        <Space>
          
          {pendingActions.length > 0 && (
            <Badge count={pendingActions.length} size="small">
              <Tooltip title={'待处理的修改提案'}>
                <SettingOutlined style={{ color: token.colorWarning }} />
              </Tooltip>
            </Badge>
          )}

          <Badge count={messages.length} size="small" style={{ backgroundColor: token.colorPrimary }}>
            <MessageOutlined style={{ color: token.colorTextSecondary, fontSize: 16 }} />
          </Badge>

          <Tooltip title={'清空对话'}>
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={clearChat}
              disabled={messages.length === 0 || isLoading}
              style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
        </Space>
      }
      style={{ ...style, height }}
      styles={{
        body: { height: 'calc(100% - 57px)', padding: 0 }
      }}
    >
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: token.colorBgContainer
      }}>

        {/* 消息列表 */}
        <div
          ref={messagesContainerRef}
          onScroll={handleUserScroll}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: messages.length === 0 ? 0 : '16px',
            background: token.colorBgContainer
          }}
        >
          {messages.length === 0 ? (
            renderPlaceholder()
          ) : (
            <div>
              {messages.map((msg, idx) => renderMessage(msg, idx))}

              {/* 思考状态 - 只在非流式模式下显示 */}
              {isThinking && !isStreaming && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: 16
                }}>
                  <div style={{
                    maxWidth: '80%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12
                  }}>
                    <Avatar
                      size="small"
                      icon={<RobotOutlined />}
                      style={{
                        backgroundColor: token.colorSuccess,
                        flexShrink: 0
                      }}
                    />
                    <div style={{
                      background: token.colorFillQuaternary,
                      color: token.colorText,
                      padding: '12px 16px',
                      borderRadius: '16px 16px 16px 4px',
                      fontSize: '14px',
                      lineHeight: 1.5,
                      boxShadow: token.boxShadowTertiary
                    }}>
                      <Space>
                        <Spin size="small" />
                        <Text>{'正在思考中...'}</Text>
                      </Space>
                    </div>
                  </div>
                </div>
              )}

              {/* 回复建议 - 竖向展示，跟在最后一条消息后 */}
              {messages.length > 0 && !isLoading && !isThinking && replySuggestions.length > 0 && (
                <div style={{
                  marginTop: 12,
                  marginLeft: 44, // 与助手消息对齐
                  marginBottom: 8
                }}>

                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {replySuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        type="text"
                        size="small"
                        onClick={() => handleSendMessage(suggestion)}
                        disabled={disabled || isLoading}
                        style={{
                          fontSize: '12px',
                          height: 'auto',
                          padding: '6px 12px',
                          border: `1px dashed ${token.colorBorder}`,
                          borderRadius: 8,
                          background: 'transparent',
                          color: token.colorText,
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Space>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div
          style={{
            padding: '16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            borderRadius: '0 0 8px 8px'
          }}
        >
          <div style={{ position: 'relative', width: '100%' }}>
            <div
              style={{
                position: 'relative',
                background: token.colorBgContainer,
                borderRadius: '16px',
                border: `1px solid ${token.colorBorder}`,
                transition: 'all 0.2s ease'
              }}
            >
              <TextArea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={disabled ? '功能暂不可用' : '输入你的问题... (Enter 发送，Shift+Enter 换行)'}
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={disabled || isLoading}
                style={{
                  fontSize: '14px',
                  paddingRight: 48, // 预留按钮空间
                  paddingLeft: 16,
                  paddingTop: 12,
                  paddingBottom: 12,
                  resize: 'none',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '16px',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                styles={{
                  textarea: {
                    border: 'none !important',
                    boxShadow: 'none !important',
                    background: 'transparent !important'
                  }
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                {/* 发送/取消按钮 */}
                <Button
                  type="primary"
                  icon={isLoading ? <StopOutlined /> : <ArrowUpOutlined />}
                  onClick={isLoading ? cancelRequest : () => handleSendMessage()}
                  disabled={(!inputValue.trim() && !isLoading) || disabled}
                  style={{
                    height: 32,
                    width: 32,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: isLoading 
                      ? token.colorError 
                      : (inputValue.trim() ? token.colorPrimary : token.colorFillSecondary),
                    borderColor: isLoading 
                      ? token.colorError 
                      : (inputValue.trim() ? token.colorPrimary : token.colorFillSecondary),
                    boxShadow: isLoading 
                      ? `0 2px 8px ${token.colorError}30`
                      : (inputValue.trim() ? `0 2px 8px ${token.colorPrimary}30` : 'none'),
                    transition: 'all 0.2s ease'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AssistantChat; 
